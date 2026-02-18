from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
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
    owner_id: int


class WorkflowUpdate(BaseModel):
    graph: dict


class WorkflowOut(BaseModel):
    id: int
    name: str
    status: str
    owner_id: int

    class Config:
        from_attributes = True


class WorkflowDetail(WorkflowOut):
    graph: dict


class NodeTypeOut(BaseModel):
    id: int
    name: str
    version: str
    description: str
    input_schema: dict
    output_schema: dict
    parameters: list
    is_async: bool

    class Config:
        from_attributes = True


class NodeExecutionOut(BaseModel):
    id: int
    node_id: str
    status: str
    output: dict | None = None
    error: str | None = None

    class Config:
        from_attributes = True


class ExecutionOut(BaseModel):
    id: int
    workflow_id: int
    status: str
    result_summary: str | None = None
    logs: list = []
    started_at: datetime
    finished_at: datetime | None = None
    node_results: List[NodeExecutionOut] = []

    class Config:
        from_attributes = True


@router.get("/users", response_model=List[dict])
def get_assigned_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    return [{"id": u.id, "username": u.username} for u in current_user.assigned_clients]


@router.get("/users/{user_id}/workflows", response_model=List[WorkflowOut])
def get_user_workflows(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    # Ensure manager has access to this user
    client_ids = [u.id for u in current_user.assigned_clients]
    if user_id not in client_ids:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Workflow).filter(Workflow.owner_id == user_id).all()


@router.post("/workflows", response_model=WorkflowOut)
def create_workflow(data: WorkflowCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    client_ids = [u.id for u in current_user.assigned_clients]
    if data.owner_id not in client_ids:
        raise HTTPException(status_code=403, detail="Access denied")
    wf = Workflow(name=data.name, owner_id=data.owner_id, created_by=current_user.id)
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return wf


@router.get("/workflows/{workflow_id}", response_model=WorkflowDetail)
def get_workflow(workflow_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    client_ids = [u.id for u in current_user.assigned_clients]
    if wf.owner_id not in client_ids:
        raise HTTPException(status_code=403, detail="Access denied")
    return wf


@router.put("/workflows/{workflow_id}", response_model=WorkflowDetail)
def update_workflow(workflow_id: int, data: WorkflowUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    client_ids = [u.id for u in current_user.assigned_clients]
    if wf.owner_id not in client_ids:
        raise HTTPException(status_code=403, detail="Access denied")
    wf.graph = data.graph
    db.commit()
    db.refresh(wf)
    return wf


@router.post("/workflows/{workflow_id}/run")
def run_workflow(workflow_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
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
def list_workflow_executions(workflow_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    # Access control
    client_ids = [u.id for u in current_user.assigned_clients]
    if wf.owner_id not in client_ids:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return db.query(WorkflowExecution).filter(WorkflowExecution.workflow_id == workflow_id).order_by(WorkflowExecution.started_at.desc()).limit(10).all()


@router.get("/executions/{execution_id}", response_model=ExecutionOut)
def get_execution_details(execution_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=manager_only):
    execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Access control via workflow
    wf = execution.workflow
    client_ids = [u.id for u in current_user.assigned_clients]
    if wf.owner_id not in client_ids:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return execution
