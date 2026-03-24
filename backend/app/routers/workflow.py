from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, field_validator
from datetime import datetime
import uuid
import json
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


class WorkflowCreate(BaseModel):
    name: str
    owner_id: Optional[str] = None
    category: str = "personal"
    graph: Optional[dict] = None
    workflow_data: Optional[dict] = None
    parameters: Optional[List[ObjectParameterCreate]] = []


class WorkflowUpdate(BaseModel):
    graph: Optional[dict] = None
    workflow_data: Optional[dict] = None
    runtime_data: Optional[dict] = None
    parameters: Optional[List[ObjectParameterCreate]] = None

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
    runtime_data: Optional[dict] = None
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
    runtime_data: Optional[dict] = None
    parameters: Optional[List[ObjectParameterCreate]] = None


class WorkflowDetail(WorkflowOut):
    graph: dict
    workflow_data: Optional[dict] = None
    runtime_data: Optional[dict] = None

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
    description: str
    code: str
    input_schema: dict
    output_schema: dict
    parameters: list
    category: Optional[str] = None
    icon: Optional[str] = "task"
    is_async: bool
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


@router.post("/workflows", response_model=WorkflowOut)
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
        
    wf_dict = WorkflowOut.model_validate(new_wf).model_dump()
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
        
    if data.runtime_data is not None:
        wf.runtime_data = data.runtime_data
        
    if data.parameters is not None:
        # delete existing parameters
        db.query(ObjectParameter).filter(
            ObjectParameter.object_id == wf.id,
            ObjectParameter.object_name == "workflows"
        ).delete()
        # add new
        for p in data.parameters:
            param_data = p.model_dump()
            param_data.pop('id', None)
            param_data.pop('object_id', None)
            param_data.pop('object_name', None)
            param = ObjectParameter(**param_data, object_id=wf.id, object_name="workflows")
            db.add(param)

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



@router.post("/workflows/{workflow_id}/duplicate", response_model=WorkflowOut)
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
        graph=wf.graph,
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
    
    wf_dict = WorkflowOut.model_validate(new_wf).model_dump()
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
                val_field = param.value_field or "value"
                lbl_field = param.label_field or "label"
                columns = result.keys()
                rows = [tuple(r) for r in result.fetchall()]
                
                param_options = []
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    param_options.append({
                        "value": str(row_dict.get(val_field, row[0])), 
                        "label": str(row_dict.get(lbl_field, row[1] if len(row) > 1 else row[0]))
                    })
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
            val_field = data.value_field or "value"
            lbl_field = data.label_field or "label"
            columns = result.keys()
            rows = [tuple(r) for r in result.fetchall()]
            
            param_options = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                param_options.append({
                    "value": str(row_dict.get(val_field, row[0])), 
                    "label": str(row_dict.get(lbl_field, row[1] if len(row) > 1 else row[0]))
                })
            return {"options": param_options, "error": None}
        else:
            return {"options": [], "error": "Unknown source format"}
    except Exception as e:
        print(f"Failed to test source {source}: {e}")
        return {"options": [], "error": "Error source"}


class RunWorkflowRequest(BaseModel):
    target_client_id: Optional[uuid.UUID] = None
    parameters: Optional[Dict[str, Any]] = None


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
        runtime_data=runtime_data
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    background_tasks.add_task(execute_workflow, execution.id)
    return {"execution_id": execution.id, "status": "started"}


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
