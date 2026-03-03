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

router = APIRouter(prefix="/workflows", tags=["workflows"])
workflow_access = Depends(require_role("manager", "admin", "client"))


class WorkflowCreate(BaseModel):
    name: str
    owner_id: str # Changed from UUID to str
    category: str = "personal"


class WorkflowUpdate(BaseModel):
    graph: dict
    workflow_data: Optional[dict] = None
    runtime_data: Optional[dict] = None


class WorkflowRename(BaseModel):
    name: str


class WorkflowOut(BaseModel):
    id: uuid.UUID
    name: str
    status: Optional[str] = "draft"
    owner_id: str # Changed from UUID to str

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
            return {} if 'runtime' in str(v) else [] # Best effort without knowing field name. Actually, just returning v and falling back is better.
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except Exception:
                return {} # Return empty dict as fallback
        return v


@router.get("/users", response_model=List[dict])
def get_assigned_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    if current_user.role == "admin":
        return [{"id": u.id, "username": u.username} for u in db.query(User).filter(User.role == "client").all()]
    return [{"id": u.id, "username": u.username} for u in current_user.assigned_clients]


@router.get("/users/{user_id}/workflows", response_model=List[WorkflowOut])
def get_user_workflows(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    # Admins can see everything
    if current_user.role == "admin":
        return db.query(Workflow).filter(Workflow.owner_id == user_id).all()
        
    # Ensure manager has access to this user or it's themselves, or it's "common"
    is_common = user_id == "common"
    
    if not is_common and user_id != str(current_user.id):
        if current_user.role == "client":
             raise HTTPException(status_code=403, detail="Access denied")
             
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if user_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
            
    # Load workflows for user plus any "common" ones if they are asking for themselves or clients
    query = db.query(Workflow).filter(Workflow.owner_id == user_id)
    return query.all()


@router.post("/workflows", response_model=WorkflowOut)
def create_workflow(data: WorkflowCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    is_common = data.owner_id == "common" or data.category == "common"
    if is_common and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create common workflows")
    if current_user.role != "admin" and not is_common and uuid.UUID(data.owner_id) != current_user.id:
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if data.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    wf = Workflow(
        name=data.name, 
        owner_id=data.owner_id, 
        created_by=current_user.id,
        category=data.category,
        graph={
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
    )
    db.add(wf)
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

    is_common = wf.owner_id == "common"
    if not is_common and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            if current_user.role != "admin": # Double check for admin
                raise HTTPException(status_code=403, detail="Access denied")
    return wf


@router.put("/workflows/{workflow_id}", response_model=WorkflowDetail)
def update_workflow(workflow_id: uuid.UUID, data: WorkflowUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    is_common = wf.owner_id == "common"
    if is_common and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can modify common workflows")
    if current_user.role != "admin" and not is_common and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    wf.graph = data.graph
    
    if data.workflow_data is not None:
        wf.workflow_data = data.workflow_data
        
    if data.runtime_data is not None:
        wf.runtime_data = data.runtime_data
        
    db.commit()
    db.refresh(wf)
    return wf


@router.patch("/workflows/{workflow_id}/rename", response_model=WorkflowDetail)
def rename_workflow(workflow_id: uuid.UUID, data: WorkflowRename, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    is_common = wf.owner_id == "common"
    if is_common and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can rename common workflows")
    if current_user.role != "admin" and not is_common and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    wf.name = data.name
    db.commit()
    db.refresh(wf)
    return wf


@router.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    is_common = wf.owner_id == "common"
    if is_common and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete common workflows")
    if current_user.role != "admin" and not is_common and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(wf)
    db.commit()
    return {"status": "success"}


class RunWorkflowRequest(BaseModel):
    target_client_id: Optional[uuid.UUID] = None


@router.post("/workflows/{workflow_id}/run")
def run_workflow(workflow_id: uuid.UUID, data: Optional[RunWorkflowRequest] = None, background_tasks: BackgroundTasks = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=workflow_access):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    is_common = wf.owner_id == "common"
    if current_user.role != "admin" and not is_common and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")

    # Store target client in runtime data for the refined get_active_client logic
    runtime_data = {}
    if data and data.target_client_id:
        runtime_data["_active_client_id"] = str(data.target_client_id)

    runtime_data["_session_id"] = "1"

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
    is_common = wf.owner_id == "common"
    if not is_common and current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
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
    is_common = wf.owner_id == "common"
    if not is_common and current_user.role != "admin" and wf.owner_id != str(current_user.id):
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Construct response and explicitly map execution runtime_data to the response schema using alias or field mapping since the frontend expects current_runtime_data
    response = ExecutionOut.model_validate(execution)
    response.current_runtime_data = execution.runtime_data
    
    return response


@router.get("/common", response_model=List[WorkflowOut])
def list_common_workflows(db: Session = Depends(get_db), _=workflow_access):
    return db.query(Workflow).filter(Workflow.owner_id == "common").all()
