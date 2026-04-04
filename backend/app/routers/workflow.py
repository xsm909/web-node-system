from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
import inspect
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, field_validator
from datetime import datetime
import uuid
import json
import re
from ..core.database import get_db
from ..core.security import require_role, get_current_user
from ..models.user import User
from ..models.workflow import Workflow, WorkflowExecution, WorkflowStatus
from ..models.node import NodeType
from ..services.executor import execute_workflow
from ..models.report import ObjectParameter
from ..models import LockData
from sqlalchemy import exists, and_
from ..core.locks import raise_if_locked, check_is_locked
from ..internal_libs import projects_lib

router = APIRouter(prefix="/workflows", tags=["workflows"])
workflow_access = Depends(require_role("manager", "admin", "client"))
manager_access = Depends(require_role("manager", "admin"))
admin_access = Depends(require_role("admin"))


from ..schemas.object_parameter import ObjectParameterCreate, ObjectParameterOut
from sqlalchemy import text
from ..core.system_parameters import inject_system_params, get_system_parameters
import re


# Schemas are consolidated below (lines 47+)

class WorkflowBase(BaseModel):
    name: str
    status: Optional[str] = "draft"
    owner_id: str
    category: Optional[str] = "general"


class WorkflowRename(BaseModel):
    name: str
    category: Optional[str] = None


class WorkflowOut(WorkflowBase):
    id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    parameters: List[ObjectParameterOut] = []
    is_locked: bool = False

    class Config:
        from_attributes = True


class WorkflowCreate(WorkflowBase):
    project_id: Optional[uuid.UUID] = None
    graph: dict = {
            "nodes": [
                {
                    "id": "node_start", 
                    "type": "start", 
                    "position": {"x": 100, "y": 100}, 
                    "deletable": False,
                    "data": {"label": "Start", "nodeType": "Start"}
                }
            ], 
            "edges": []
        }
    workflow_data: Optional[dict] = None
    parameters: Optional[List[ObjectParameterCreate]] = []

    @field_validator('graph', 'workflow_data', mode='before')
    @classmethod
    def parse_json_str(cls, v):
        """Safely parse JSON string fields into dicts."""
        if v is None:
            return {}
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v


class WorkflowUpdate(BaseModel):
    graph: Optional[dict] = None
    workflow_data: Optional[dict] = None
    parameters: Optional[List[ObjectParameterCreate]] = None


class WorkflowDetail(WorkflowOut):
    graph: dict
    workflow_data: Optional[dict] = None

    @field_validator('graph', 'workflow_data', mode='before')
    @classmethod
    def parse_json_str(cls, v):
        """Safely parse JSON string fields into dicts."""
        if v is None:
            return {}
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v


class NodeTypeOut(BaseModel):
    id: uuid.UUID
    name: str
    version: str
    description: Optional[str] = ""
    code: str
    input_schema: dict
    output_schema: dict
    parameters: list
    category: Optional[str] = None
    icon: Optional[str] = "task"
    is_async: bool
    show_in_toolbar: bool = False
    is_locked: bool = False

    class Config:
        from_attributes = True


class NodeExecutionOut(BaseModel):
    id: uuid.UUID
    node_id: str
    status: str
    output: Optional[dict] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True


class ExecutionOut(BaseModel):
    id: uuid.UUID
    workflow_id: uuid.UUID
    status: str
    result_summary: Optional[str] = None
    logs: list = []
    started_at: datetime
    finished_at: Optional[datetime] = None
    current_runtime_data: Optional[dict] = None
    node_results: List[NodeExecutionOut] = []

    class Config:
        from_attributes = True

    @field_validator('current_runtime_data', 'logs', mode='before')
    @classmethod
    def parse_json_str(cls, v):
        """Safely parse JSON string fields into dicts/lists."""
        if v is None:
            return {} if 'runtime' in str(v) else []
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except Exception:
                return {}
        return v


@router.get("/users", response_model=List[dict])
def get_assigned_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    if current_user.role == "admin":
        return [{"id": u.id, "username": u.username} for u in db.query(User).filter(User.role == "client").all()]
    return [{"id": u.id, "username": u.username} for u in current_user.assigned_clients]


@router.get("/users/{user_id}/workflows", response_model=List[WorkflowOut])
def get_user_workflows(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    # Admins can see everything, other users can see their own
    if current_user.role != "admin":
        if user_id != str(current_user.id):
             raise HTTPException(status_code=403, detail="Access denied")
    
    current_project_id = projects_lib.get_project_id()

    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == Workflow.id,
        LockData.entity_type == "workflows"
    ).exists()

    query = db.query(Workflow, is_locked_subquery.label("is_locked")).filter(Workflow.owner_id == user_id)

    if current_project_id:
        # In project mode: see ONLY project items
        query = query.filter(Workflow.project_id == current_project_id)
    else:
        # Outside project mode: see ONLY general items
        query = query.filter(Workflow.project_id == None)

    results = query.all()
    
    response = []
    for wf, is_locked in results:
        wf_dict = WorkflowOut.model_validate(wf).model_dump()
        wf_dict["is_locked"] = is_locked
        response.append(wf_dict)
    return response


@router.post("/workflows", response_model=WorkflowDetail)
def create_workflow(data: WorkflowCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    owner_id = data.owner_id or str(current_user.id)
    
    # Permission check for owner_id
    if owner_id != str(current_user.id) and current_user.role != "admin":
        if owner_id == "common":
             # Only admin can create common workflows
             raise HTTPException(status_code=403, detail="Only admin can create common workflows")
        
        # Manager can create for assigned clients
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if owner_id not in client_ids:
             raise HTTPException(status_code=403, detail="Access denied")

    current_project_id = projects_lib.get_project_id()
    current_project_owner = projects_lib.get_project_owner()
    
    final_owner_id = data.owner_id
    
    if current_project_id and current_project_owner:
        # In project mode: force ownership to project owner if currently common or missing
        if not final_owner_id or final_owner_id == "common":
            final_owner_id = str(current_project_owner)
    else:
        # Not in project mode: default to current user if missing or common
        if not final_owner_id or final_owner_id == "common":
            final_owner_id = str(current_user.id)

    new_wf = Workflow(
        name=data.name,
        category=data.category,
        owner_id=final_owner_id,
        project_id=data.project_id or current_project_id,
        created_by=current_user.id,
        graph=data.graph or {
            "nodes": [
                {
                    "id": "node_start", 
                    "type": "start", 
                    "position": {"x": 100, "y": 100}, 
                    "deletable": False,
                    "data": {"label": "Start", "nodeType": "Start"}
                }
            ], 
            "edges": []
        },
        workflow_data=data.workflow_data or {},
        status=WorkflowStatus.draft
    )
    db.add(new_wf)
    db.commit()
    db.refresh(new_wf)
    
    if data.parameters is not None:
        for p in data.parameters:
            param_data = p.model_dump()
            param_data.pop('id', None)
            param_data.pop('object_id', None)
            param_data.pop('object_name', None)
            param = ObjectParameter(**param_data, object_id=new_wf.id, object_name="workflows")
            db.add(param)
        db.commit()
        db.refresh(new_wf)
        
    wf_dict = WorkflowDetail.model_validate(new_wf).model_dump()
    wf_dict["is_locked"] = False
    return wf_dict


@router.get("/workflows/{workflow_id}", response_model=WorkflowDetail)
def get_workflow(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    is_locked = db.query(exists().where(and_(
        LockData.entity_id == workflow_id,
        LockData.entity_type == "workflows"
    ))).scalar()

    # Enforce strict ownership: only creator/owner, admin, or if project matches current context
    current_project_id = projects_lib.get_project_id()
    is_project_match = current_project_id and wf.project_id == current_project_id

    if current_user.role != "admin" and wf.owner_id != str(current_user.id) and not is_project_match:
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
             raise HTTPException(status_code=403, detail="Access denied")
    
    wf_dict = WorkflowDetail.model_validate(wf).model_dump()
    wf_dict["is_locked"] = is_locked
    return wf_dict


@router.put("/workflows/{workflow_id}", response_model=WorkflowDetail)
def update_workflow(workflow_id: uuid.UUID, data: WorkflowUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Enforce strict ownership: only creator or admin
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    raise_if_locked(db, workflow_id, "workflows")
    
    if data.graph is not None:
        wf.graph = data.graph
    
    if data.workflow_data is not None:
        wf.workflow_data = data.workflow_data
        
    if data.parameters is not None:
        # Clear existing parameters using the relationship to ensure consistency with delete-orphan
        wf.parameters = []
        # add new
        for p in data.parameters:
            param_data = p.model_dump()
            param_data.pop('id', None)
            param_data.pop('object_id', None)
            param_data.pop('object_name', None)
            param = ObjectParameter(**param_data, object_id=wf.id, object_name="workflows")
            wf.parameters.append(param)

    db.commit()
    db.refresh(wf)
    is_locked = check_is_locked(db, workflow_id, "workflows")
    
    wf_dict = WorkflowDetail.model_validate(wf).model_dump()
    wf_dict["is_locked"] = is_locked
    return wf_dict



@router.patch("/workflows/{workflow_id}/rename", response_model=WorkflowDetail)
def rename_workflow(workflow_id: uuid.UUID, data: WorkflowRename, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    raise_if_locked(db, workflow_id, "workflows")
    
    if data.name:
        wf.name = data.name
    if data.category:
        wf.category = data.category

    db.commit()
    db.refresh(wf)
    is_locked = check_is_locked(db, workflow_id, "workflows")
    
    wf_dict = WorkflowDetail.model_validate(wf).model_dump()
    wf_dict["is_locked"] = is_locked
    return wf_dict



@router.post("/workflows/{workflow_id}/duplicate", response_model=WorkflowDetail)
def duplicate_workflow(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    new_wf = Workflow(
        name=f"Copy of {wf.name}",
        owner_id=str(current_user.id),
        created_by=current_user.id,
        graph=wf.graph or {
            "nodes": [
                {
                    "id": "node_start", 
                    "type": "start", 
                    "position": {"x": 100, "y": 100}, 
                    "deletable": False,
                    "data": {"label": "Start", "nodeType": "Start"}
                }
            ], 
            "edges": []
        },
        category=wf.category,
        workflow_data=wf.workflow_data,
        status=WorkflowStatus.draft
    )

    db.add(new_wf)
    db.commit()
    db.refresh(new_wf)

    # Copy parameters
    from ..models.report import ObjectParameter
    for p in wf.parameters:
        new_p = ObjectParameter(
            object_id=new_wf.id,
            object_name="workflows",
            parameter_name=p.parameter_name,
            parameter_type=p.parameter_type,
            default_value=p.default_value,
            source=p.source,
            value_field=p.value_field,
            label_field=p.label_field
        )
        db.add(new_p)
    db.commit()

    is_locked = db.query(exists().where(and_(
        LockData.entity_id == new_wf.id,
        LockData.entity_type == "workflows"
    ))).scalar()
    
    wf_dict = WorkflowDetail.model_validate(new_wf).model_dump()
    wf_dict["is_locked"] = is_locked
    return wf_dict


@router.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    raise_if_locked(db, workflow_id, "workflows")
    
    db.delete(wf)
    db.commit()
    return {"status": "success"}


@router.get("/workflows/{workflow_id}/options")
def get_workflow_parameter_options(workflow_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
         raise HTTPException(status_code=404, detail="Workflow not found")
         
    options = {}
    for param in wf.parameters:
        source = param.source.strip() if param.source else ""
        if not source:
             options[param.parameter_name] = []
             continue

        try:
            if source.startswith("@"):
                # Support for @table-name->value,label
                parts = source[1:].split("->")
                table_name = parts[0]
                fields_str = parts[1] if len(parts) > 1 else "id,name"
                fields = fields_str.split(",")
                val_field = fields[0]
                lbl_field = fields[1] if len(fields) > 1 else val_field
                
                if not re.match(r'^\w+$', table_name) or not re.match(r'^\w+$', val_field) or not re.match(r'^\w+$', lbl_field):
                    options[param.parameter_name] = []
                    continue

                system_params = get_system_parameters()
                result = db.execute(text(f"SELECT {val_field}, {lbl_field} FROM {table_name} LIMIT 1000"), system_params)
                options[param.parameter_name] = [
                    {"value": str(row[0]), "label": str(row[1])} for row in [tuple(r) for r in result.fetchall()]
                ]
            elif source.lower().startswith("select"):
                system_params = get_system_parameters()
                result = db.execute(text(source), system_params)
                columns = result.keys()
                rows = [tuple(r) for r in result.fetchall()]
                
                param_options = []
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    
                    # Case-insensitive lookup for 'value' and 'label'
                    val_key = next((k for k in row_dict if k.lower() == 'value'), None)
                    lab_key = next((k for k in row_dict if k.lower() == 'label'), None)
                    
                    val = row_dict.get(val_key) if val_key else None
                    if val is None and len(row) > 0:
                        val = row[0]
                    
                    if val is None:
                        continue
                    
                    lbl = row_dict.get(lab_key) if lab_key else None
                    if lbl is None:
                        lbl = val
                    
                    param_options.append({"value": str(val), "label": str(lbl)})
                options[param.parameter_name] = param_options
            else:
                options[param.parameter_name] = []
        except Exception as e:
            print(f"Failed to fetch options for {param.parameter_name}: {e}")
            options[param.parameter_name] = []
            
    return options


from ..schemas.object_parameter import SourceTestRequest, SourceTestResponse

@router.post("/test-source", response_model=SourceTestResponse)
def test_parameter_source(data: SourceTestRequest, db: Session = Depends(get_db), _=manager_access):
    source = data.source.strip()
    if not source:
        return {"options": [], "error": None}
    
    try:
        if source.startswith("@"):
            parts = source[1:].split("->")
            table_name = parts[0]
            fields_str = parts[1] if len(parts) > 1 else "id,name"
            fields = fields_str.split(",")
            val_field = fields[0]
            lbl_field = fields[1] if len(fields) > 1 else val_field
            
            if not re.match(r'^\w+$', table_name) or not re.match(r'^\w+$', val_field) or not re.match(r'^\w+$', lbl_field):
                return {"options": [], "error": "Invalid table or field names"}

            system_params = get_system_parameters()
            result = db.execute(text(f"SELECT {val_field}, {lbl_field} FROM {table_name} LIMIT 100"), system_params)
            options = [
                {"value": str(row[0]), "label": str(row[1])} for row in [tuple(r) for r in result.fetchall()]
            ]
            return {"options": options, "error": None}
            
        elif source.lower().startswith("select"):
            system_params = get_system_parameters()
            result = db.execute(text(source), system_params)
            columns = result.keys()
            rows = [tuple(r) for r in result.fetchall()]
            
            param_options = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                
                # Case-insensitive lookup for 'value' and 'label'
                val_key = next((k for k in row_dict if k.lower() == 'value'), None)
                lab_key = next((k for k in row_dict if k.lower() == 'label'), None)
                
                val = row_dict.get(val_key) if val_key else None
                if val is None and len(row) > 0:
                    val = row[0]
                
                if val is None:
                    continue
                
                lbl = row_dict.get(lab_key) if lab_key else None
                if lbl is None:
                    lbl = val
                
                param_options.append({"value": str(val), "label": str(lbl)})
            return {"options": param_options, "error": None}
        else:
            return {"options": [], "error": "Unknown source format"}
    except Exception as e:
        return {"options": [], "error": str(e)}


class RunWorkflowRequest(BaseModel):
    target_client_id: Optional[uuid.UUID] = None
    parameters: Optional[Dict[str, Any]] = None
    graph: Optional[Dict[str, Any]] = None


@router.post("/workflows/{workflow_id}/run")
def run_workflow(workflow_id: uuid.UUID, data: Optional[RunWorkflowRequest] = None, background_tasks: BackgroundTasks = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")

    # Store target client and passed parameters in runtime data
    runtime_data = inject_system_params(data.parameters or {} if data else {})
    if data and data.target_client_id:
        runtime_data["_active_client_id"] = str(data.target_client_id)

    

    execution = WorkflowExecution(
        workflow_id=wf.id, 
        status=WorkflowStatus.pending,
        runtime_data=runtime_data,
        graph=data.graph if data and data.graph else None
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    background_tasks.add_task(execute_workflow, execution.id)
    return {"execution_id": execution.id, "status": "started"}


class NodeCodeValidateRequest(BaseModel):
    code: str

@router.post("/node-types/validate-code")
def validate_node_code(data: NodeCodeValidateRequest, current_user: User = Depends(get_current_user), _=workflow_access):
    from RestrictedPython import compile_restricted
    from ..services.executor import CustomRestrictingNodeTransformer
    import re

    try:
        # Clean code but preserve defaults using lookahead (?=#)
        cleaned_code = re.sub(r'([ \t]+[\w]+[ \t]*:[ \t]*[\w]+[ \t]*)=[ \t]*(?=#)', r'\1 ', data.code)

        compile_restricted(
            cleaned_code, 
            "<node-validation>", 
            "exec",
            policy=CustomRestrictingNodeTransformer
        )
        return {"success": True, "error": None, "line": None}
    except SyntaxError as e:
        return {"success": False, "error": getattr(e, 'msg', str(e)), "line": getattr(e, 'lineno', None), "offset": getattr(e, 'offset', None), "text": getattr(e, 'text', None)}
    except Exception as e:
        return {"success": False, "error": str(e), "line": None}

@router.get("/node-types/{node_id}/parameter-options/{parameter_name}")
def get_node_parameter_options(
    node_id: uuid.UUID, 
    parameter_name: str, 
    source_func: str, 
    params: str = Query("{}"),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Returns options for a node parameter by executing a specified function
    from the node's own Python code.
    """
    node = db.query(NodeType).filter(NodeType.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    
    # We use RestrictedPython to safely execute node-defined selection functions
    from ..services.executor import SAFE_GLOBALS, CustomRestrictingNodeTransformer, custom_getattr, restricted_import
    from RestrictedPython import compile_restricted, Guards
    from ..internal_libs.context_lib import execution_context
    
    try:
        # Parse current parameters if provided
        try:
            current_params = json.loads(params)
        except Exception:
            current_params = {}

        # Set the execution context to the current user's ID
        # This allows unsafe_request to resolve permissions in configuration mode
        token = execution_context.set(str(current_user.id))
        
        # Clean code but preserve defaults using lookahead (?=#)
        cleaned_code = re.sub(r'([ \t]+[\w]+[ \t]*:[ \t]*[\w]+[ \t]*)=[ \t]*(?=#)', r'\1 ', node.code)

        # Compile the node's code in restricted mode
        byte_code = compile_restricted(
            cleaned_code, 
            f"<node-options:{node_id}>", 
            "exec", 
            policy=CustomRestrictingNodeTransformer
        )
        
        # Prepare the execution environment (similar to WorkflowExecutor)
        # We include SAFE_GLOBALS which has inner_database and other utilities
        node_globals = {
            **SAFE_GLOBALS,
            "__name__": f"<node-options:{node_id}>",
            "_getattr_": custom_getattr,
            "_setattr_": Guards.guarded_setattr,
            "_delattr_": Guards.guarded_delattr,
            "__builtins__": {
                **SAFE_GLOBALS["__builtins__"],
                "__import__": restricted_import
            },
            "params": current_params,
        }
        
        # Execute the module to populate globals with defined functions
        # We use a custom local dictionary to avoid polluting SAFE_GLOBALS if they were modified
        exec(byte_code, node_globals)
        
        # Find the function specified in the marker
        if source_func not in node_globals or not callable(node_globals[source_func]):
             raise HTTPException(status_code=400, detail=f"Options function '{source_func}' not found in node code or is not callable.")
             
        # Call the function. 
        # We check if the function accepts arguments to maintain backward compatibility.
        # If it does, we pass the current parameters.
        target_func = node_globals[source_func]
        try:
            sig = inspect.signature(target_func)
            if len(sig.parameters) > 0:
                res = target_func(current_params)
            else:
                res = target_func()
        except (ValueError, TypeError):
            # Fallback for built-ins or complex objects where signature fails
            try:
                res = target_func(current_params)
            except TypeError:
                res = target_func()
        
        # Standardize the output format for the frontend ComboBox:
        # Expected: [{"value": "...", "label": "..."}]
        formatted = []
        if isinstance(res, list):
            for item in res:
                if isinstance(item, dict):
                    # Map the user-defined 'display' or 'label' to our frontend standard 'label'
                    value = item.get("value")
                    label = item.get("display") or item.get("label") or str(value)
                    formatted.append({
                        "value": str(value), 
                        "label": str(label)
                    })
                else:
                    # Simple array of primitives
                    formatted.append({
                        "value": str(item), 
                        "label": str(item)
                    })
        elif isinstance(res, dict):
            # If function returns a dict {value: label}, convert to array
            for k, v in res.items():
                formatted.append({
                    "value": str(k), 
                    "label": str(v)
                })
        
        return formatted
        
    except Exception as e:
        import traceback
        print(f"Error fetching dynamic options for {node.name}.{parameter_name}: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Dynamic options script failed: {str(e)}")
    finally:
        # Reset context variable
        execution_context.reset(token)


@router.get("/node-types/{node_id}/fill-data/{parameter_name}")
def get_node_fill_data(
    node_id: uuid.UUID, 
    parameter_name: str, 
    fill_func: str, 
    params: str = Query("{}"),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Executes a specific function from the node's code to "fill" a complex parameter (like a list of dataclasses).
    """
    node = db.query(NodeType).filter(NodeType.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    
    from ..services.executor import SAFE_GLOBALS, CustomRestrictingNodeTransformer, custom_getattr, restricted_import
    from RestrictedPython import compile_restricted, Guards
    from ..internal_libs.context_lib import execution_context
    
    try:
        try:
            current_params = json.loads(params)
        except Exception:
            current_params = {}

        # Merge defaults from NodeParameters code to handle cases where the frontend sends an incomplete params dict
        from .admin import extract_node_parameters
        node_params_meta = extract_node_parameters(node.code)
        for p in node_params_meta:
            if p['name'] not in current_params and p.get('default') is not None:
                current_params[p['name']] = p['default']

        token = execution_context.set(str(current_user.id))
        # Clean code but preserve defaults using lookahead (?=#)
        cleaned_code = re.sub(r'([ \t]+[\w]+[ \t]*:[ \t]*[\w]+[ \t]*)=[ \t]*(?=#)', r'\1 ', node.code)

        byte_code = compile_restricted(
            cleaned_code, 
            f"<node-fill:{node_id}>", 
            "exec", 
            policy=CustomRestrictingNodeTransformer
        )
        
        # Add comprehensive globals for the execution
        node_globals = {
            **SAFE_GLOBALS,
            "__name__": f"<node-fill:{node_id}>",
            "_getattr_": custom_getattr,
            "_setattr_": Guards.guarded_setattr,
            "_delattr_": Guards.guarded_delattr,
            "__builtins__": {
                **SAFE_GLOBALS["__builtins__"],
                "__import__": restricted_import
            },
            "params": current_params,
        }
        
        exec(byte_code, node_globals)
        
        if fill_func not in node_globals:
             print(f"[FILL_DATA] Error: Function '{fill_func}' not found in node globals. Available: {list(node_globals.keys())}")
             raise HTTPException(status_code=400, detail=f"Fill function '{fill_func}' not found in node code.")
             
        target_func = node_globals[fill_func]
        if not callable(target_func):
             raise HTTPException(status_code=400, detail=f"Fill function '{fill_func}' is not callable.")

        # Log parameters being passed for debugging
        print(f"[FILL_DATA] Executing '{fill_func}' with params: {current_params}")
        
        try:
            sig = inspect.signature(target_func)
            if len(sig.parameters) > 0:
                print(f"[FILL_DATA] Calling '{fill_func}' with current_params...")
                res = target_func(current_params)
            else:
                print(f"[FILL_DATA] Calling '{fill_func}' (no args)...")
                res = target_func()
            
            print(f"[FILL_DATA] SUCCESS: '{fill_func}' returned {len(res) if isinstance(res, list) else 'non-list'} items: {res}")
            return res
        except Exception as e:
            print(f"[FILL_DATA] ERROR in '{fill_func}': {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Execution error in {fill_func}: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error executing fill function for {node.name}.{parameter_name}: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        execution_context.reset(token)


@router.get("/node-types", response_model=List[NodeTypeOut])
def list_node_types(db: Session = Depends(get_db), _=workflow_access):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == NodeType.id,
        LockData.entity_type == "node_types"
    ).exists()
    
    results = db.query(NodeType, is_locked_subquery.label("is_locked")).all()
    
    response = []
    for node, is_locked in results:
        node_dict = NodeTypeOut.model_validate(node).model_dump()
        node_dict["is_locked"] = is_locked
        response.append(node_dict)
    return response


@router.get("/workflows/{workflow_id}/executions", response_model=List[ExecutionOut])
def list_workflow_executions(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    # Access control — common workflows are accessible by any authenticated user
    # Enforce strict ownership: only creator or admin
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return db.query(WorkflowExecution).filter(WorkflowExecution.workflow_id == workflow_id).order_by(WorkflowExecution.started_at.desc()).limit(10).all()


@router.get("/executions/{execution_id}", response_model=ExecutionOut)
def get_execution_details(execution_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Access control via workflow — expire cached relationship first to get fresh data
    db.expire(execution)
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    
    wf = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
    # Common workflows can be executed/viewed by any authenticated user
    # Enforce strict ownership: only creator or admin
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Construct response and explicitly map execution runtime_data to the response schema using alias or field mapping since the frontend expects current_runtime_data
    response = ExecutionOut.model_validate(execution)
    response.current_runtime_data = execution.runtime_data
    
    return response


@router.get("/common", response_model=List[WorkflowOut])
def list_common_workflows(db: Session = Depends(get_db), _=workflow_access):
    current_project_id = projects_lib.get_project_id()
    
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == Workflow.id,
        LockData.entity_type == "workflows"
    ).exists()
    
    query = db.query(Workflow, is_locked_subquery.label("is_locked")).filter(Workflow.owner_id == "common")
    
    if current_project_id:
        # In project mode: see project items ONLY
        query = query.filter(Workflow.project_id == current_project_id)
    else:
        # Outside project mode: see general items ONLY
        query = query.filter(Workflow.project_id == None)
        
    results = query.all()
    
    response = []
    for wf, is_locked in results:
        wf_dict = WorkflowOut.model_validate(wf).model_dump()
        wf_dict["is_locked"] = is_locked
        response.append(wf_dict)
    return response
