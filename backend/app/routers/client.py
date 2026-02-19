from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid
from ..core.database import get_db
from ..core.security import require_role, get_current_user
from ..models.user import User
from ..models.workflow import Workflow, WorkflowExecution

router = APIRouter(prefix="/client", tags=["client"])
client_only = Depends(require_role("client"))


class ResultOut(BaseModel):
    id: uuid.UUID
    workflow_name: str
    status: str
    created_at: Optional[datetime]
    result_summary: Optional[str]

    class Config:
        from_attributes = True


@router.get("/results", response_model=List[ResultOut])
def get_results(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), _=client_only):
    workflows = db.query(Workflow).filter(Workflow.owner_id == current_user.id).all()
    results = []
    for wf in workflows:
        executions = db.query(WorkflowExecution).filter(WorkflowExecution.workflow_id == wf.id).all()
        for ex in executions:
            results.append(ResultOut(
                id=ex.id,
                workflow_name=wf.name,
                status=ex.status,
                created_at=ex.started_at,
                result_summary=ex.result_summary,
            ))
    return results
