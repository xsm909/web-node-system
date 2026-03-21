from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
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

router = APIRouter(prefix="/workflows", tags=["workflows"])
workflow_access = Depends(require_role("manager", "admin", "client"))
manager_access = Depends(require_role("manager", "admin"))
admin_access = Depends(require_role("admin"))


from ..schemas.object_parameter import ObjectParameterCreate, ObjectParameterOut
from sqlalchemy import text
import re


class WorkflowCreate(BaseModel):
    name: str
    owner_id: str
    category: str = "personal"
    graph: Optional[dict] = None
    workflow_data: Optional[dict] = None
    parameters: Optional[List[ObjectParameterCreate]] = []


class WorkflowUpdate(BaseModel):
    graph: Optional[dict] = None
    workflow_data: Optional[dict] = None
    runtime_data: Optional[dict] = None
    parameters: Optional[List[ObjectParameterCreate]] = None


class WorkflowRename(BaseModel):
    name: str
    category: Optional[str] = None


class WorkflowOut(BaseModel):
    id: uuid.UUID
    name: str
    status: Optional[str] = "draft"
    owner_id: str
    category: Optional[str] = "general"
    parameters: List[ObjectParameterOut] = []

    class Config:
        from_attributes = True


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
    input_schema: dict
    output_schema: dict
    parameters: list
    category: Optional[str] = None
    icon: Optional[str] = "task"
    is_async: bool

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
    
    return db.query(Workflow).filter(Workflow.owner_id == user_id).all()


@router.post("/workflows", response_model=WorkflowOut)
def create_workflow(data: WorkflowCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = Workflow(
        name=data.name,
        owner_id=str(current_user.id),
        created_by=current_user.id,
        category=data.category or "general",
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
    db.add(wf)
    db.commit()
    db.refresh(wf)
    
    if data.parameters is not None:
        for p in data.parameters:
            param_data = p.model_dump()
            param_data.pop('id', None)
            param_data.pop('object_id', None)
            param_data.pop('object_name', None)
            param = ObjectParameter(**param_data, object_id=wf.id, object_name="workflows")
            db.add(param)
        db.commit()
        db.refresh(wf)
        
    return wf


@router.get("/workflows/{workflow_id}", response_model=WorkflowDetail)
def get_workflow(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if current_user.role == "admin":
        return wf

    # Enforce strict ownership: only creator or admin
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return wf


@router.put("/workflows/{workflow_id}", response_model=WorkflowDetail)
def update_workflow(workflow_id: uuid.UUID, data: WorkflowUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Enforce strict ownership: only creator or admin
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    return wf


@router.patch("/workflows/{workflow_id}/rename", response_model=WorkflowDetail)
def rename_workflow(workflow_id: uuid.UUID, data: WorkflowRename, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    if data.name:
        wf.name = data.name
    if data.category:
        wf.category = data.category

    db.commit()
    db.refresh(wf)
    return wf


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

    return new_wf


@router.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
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

                result = db.execute(text(f"SELECT {val_field}, {lbl_field} FROM {table_name} LIMIT 1000"))
                options[param.parameter_name] = [
                    {"value": str(row[0]), "label": str(row[1])} for row in [tuple(r) for r in result.fetchall()]
                ]
            elif source.lower().startswith("select"):
                result = db.execute(text(source))
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

            result = db.execute(text(f"SELECT {val_field}, {lbl_field} FROM {table_name} LIMIT 100"))
            options = [
                {"value": str(row[0]), "label": str(row[1])} for row in [tuple(r) for r in result.fetchall()]
            ]
            return {"options": options, "error": None}
            
        elif source.lower().startswith("select"):
            result = db.execute(text(source))
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


@router.post("/workflows/{workflow_id}/run")
def run_workflow(workflow_id: uuid.UUID, data: Optional[RunWorkflowRequest] = None, background_tasks: BackgroundTasks = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")

    # Store target client in runtime data for the refined get_active_client logic
    runtime_data = {}
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
    return db.query(NodeType).all()


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
    return db.query(Workflow).filter(Workflow.owner_id == "common").all()
