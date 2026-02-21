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

router = APIRouter(prefix="/manager", tags=["manager"])
manager_only = Depends(require_role("manager"))


class WorkflowCreate(BaseModel):
    name: str
    owner_id: uuid.UUID


class WorkflowUpdate(BaseModel):
    graph: dict
    workflow_data_schema: Optional[dict] = None
    workflow_data: Optional[dict] = None
    runtime_data_schema: Optional[dict] = None
    runtime_data: Optional[dict] = None


class WorkflowOut(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    owner_id: uuid.UUID

    class Config:
        from_attributes = True


class WorkflowDetail(WorkflowOut):
    graph: dict
    workflow_data_schema: Optional[dict] = None
    workflow_data: Optional[dict] = None
    runtime_data_schema: Optional[dict] = None
    runtime_data: Optional[dict] = None

    @field_validator('graph', 'workflow_data_schema', 'workflow_data', 'runtime_data_schema', 'runtime_data', mode='before')
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
def get_assigned_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    return [{"id": u.id, "username": u.username} for u in current_user.assigned_clients]


@router.get("/users/{user_id}/workflows", response_model=List[WorkflowOut])
def get_user_workflows(user_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    # Ensure manager has access to this user or it's themselves
    if user_id != current_user.id:
        client_ids = [u.id for u in current_user.assigned_clients]
        if user_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Workflow).filter(Workflow.owner_id == user_id).all()


@router.post("/workflows", response_model=WorkflowOut)
def create_workflow(data: WorkflowCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    if data.owner_id != current_user.id:
        client_ids = [u.id for u in current_user.assigned_clients]
        if data.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    wf = Workflow(
        name=data.name, 
        owner_id=data.owner_id, 
        created_by=current_user.id,
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
def get_workflow(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf.owner_id != current_user.id:
        client_ids = [u.id for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    return wf


@router.put("/workflows/{workflow_id}", response_model=WorkflowDetail)
def update_workflow(workflow_id: uuid.UUID, data: WorkflowUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf.owner_id != current_user.id:
        client_ids = [u.id for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    wf.graph = data.graph
    
    if data.workflow_data_schema is not None:
        wf.workflow_data_schema = data.workflow_data_schema
    if data.workflow_data is not None:
        wf.workflow_data = data.workflow_data
    if data.runtime_data_schema is not None:
        wf.runtime_data_schema = data.runtime_data_schema
    if data.runtime_data is not None:
        wf.runtime_data = data.runtime_data
        
    db.commit()
    db.refresh(wf)
    return wf


@router.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf.owner_id != current_user.id:
        client_ids = [u.id for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    db.delete(wf)
    db.commit()
    return {"status": "success"}


@router.post("/workflows/{workflow_id}/run")
def run_workflow(workflow_id: uuid.UUID, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf.owner_id != current_user.id:
        client_ids = [u.id for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")

    execution = WorkflowExecution(workflow_id=wf.id, status=WorkflowStatus.pending)
    db.add(execution)
    db.commit()
    db.refresh(execution)

    background_tasks.add_task(execute_workflow, execution.id)
    return {"execution_id": execution.id, "status": "started"}


@router.get("/node-types", response_model=List[NodeTypeOut])
def list_node_types(db: Session = Depends(get_db), _=manager_only):
    return db.query(NodeType).all()


@router.get("/workflows/{workflow_id}/executions", response_model=List[ExecutionOut])
def list_workflow_executions(workflow_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    # Access control
    if wf.owner_id != current_user.id:
        client_ids = [u.id for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return db.query(WorkflowExecution).filter(WorkflowExecution.workflow_id == workflow_id).order_by(WorkflowExecution.started_at.desc()).limit(10).all()


@router.get("/executions/{execution_id}", response_model=ExecutionOut)
def get_execution_details(execution_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Access control via workflow — expire cached relationship first to get fresh data
    db.expire(execution)
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    
    wf = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
    if wf.owner_id != current_user.id:
        client_ids = [u.id for u in current_user.assigned_clients]
        if wf.owner_id not in client_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Construct response and explicitly map execution runtime_data to the response schema using alias or field mapping since the frontend expects current_runtime_data
    response = ExecutionOut.model_validate(execution)
    response.current_runtime_data = execution.runtime_data
    
    return response
