from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import json
from ..core.database import get_db
from ..core.security import require_role, get_current_user
from ..models.user import User
from ..models.ai_task import AI_Task
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/ai-tasks", tags=["ai-tasks"])
# Managers and Admins can manage tasks
manager_access = Depends(require_role("manager", "admin"))

class AITaskBase(BaseModel):
    owner_id: str
    data_type_id: int
    ai_model: str = "any"
    description: Optional[str] = None
    task: Optional[dict] = None

class AITaskCreate(AITaskBase):
    pass

class AITaskUpdate(BaseModel):
    owner_id: Optional[str] = None
    data_type_id: Optional[int] = None
    ai_model: Optional[str] = None
    description: Optional[str] = None
    task: Optional[dict] = None

class AITaskOut(AITaskBase):
    id: uuid.UUID
    created_by: Optional[uuid.UUID] = None
    updated_by: Optional[uuid.UUID] = None

    class Config:
        from_attributes = True

    @field_validator('task', mode='before')
    @classmethod
    def parse_task(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except:
                return {"value": v}
        return v

@router.get("/", response_model=List[AITaskOut])
def list_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    if current_user.role == "admin":
        return db.query(AI_Task).all()
    # Managers see tasks for their assigned clients or tasks they created
    # BUT explicitly exclude AI_Task owner tasks for non-admins
    client_ids = [str(u.id) for u in current_user.assigned_clients]
    return db.query(AI_Task).filter(
        (AI_Task.owner_id != "AI_Task") & 
        ((AI_Task.owner_id.in_(client_ids)) | (AI_Task.created_by == current_user.id))
    ).all()

@router.post("/", response_model=AITaskOut)
def create_task(data: AITaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    task_data = data.model_dump()
    
    # Restricted AI_Task owner to admin
    if task_data.get("owner_id") == "AI_Task" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create AI_Task tasks")

    # User requested data goes in "value" or "values" instead of "Task"
    if task_data.get("task") and isinstance(task_data["task"], dict):
        if "value" not in task_data["task"] and "values" not in task_data["task"]:
            pass # allow other keys if necessary, but frontend uses value/values
    
    task = AI_Task(
        **task_data,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.put("/{task_id}", response_model=AITaskOut)
def update_task(task_id: uuid.UUID, data: AITaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    task = db.query(AI_Task).filter(AI_Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if existing task is owner_id="AI_Task" and user is not admin
    if task.owner_id == "AI_Task" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update AI_Task tasks")

    update_data = data.model_dump(exclude_unset=True)
    
    # Check if trying to change owner to "AI_Task" as non-admin
    if update_data.get("owner_id") == "AI_Task" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can set owner to AI_Task")

    # Specific handling for task JSON field if provided
    if "task" in update_data and update_data["task"]:
        if isinstance(update_data["task"], str):
             update_data["task"] = {"value": update_data["task"]}
             
    for k, v in update_data.items():
        setattr(task, k, v)
    
    task.updated_by = current_user.id
    db.commit()
    db.refresh(task)
    return task

@router.delete("/{task_id}")
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    task = db.query(AI_Task).filter(AI_Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if existing task is owner_id="AI_Task" and user is not admin
    if task.owner_id == "AI_Task" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete AI_Task tasks")

    db.delete(task)
    db.commit()
    return {"status": "deleted"}
