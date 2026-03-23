from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from ..core.database import get_db
from ..models.agent_hint import AgentHint
from ..models.user import User
from ..schemas.agent_hint import AgentHint as AgentHintSchema, AgentHintCreate, AgentHintUpdate
from ..routers.auth import get_current_user
from sqlalchemy import exists, and_
from ..models import LockData
from ..core.locks import raise_if_locked, check_is_locked
from ..internal_libs.projects_lib import get_project_id, is_project_mode

router = APIRouter(prefix="/agent-hints", tags=["Agent Hints"])

@router.get("/", response_model=List[AgentHintSchema])
def list_agent_hints(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == AgentHint.id,
        LockData.entity_type == "agent_hints"
    ).exists()
    
    results = db.query(AgentHint, is_locked_subquery.label("is_locked"))
    
    project_id = get_project_id()
    if is_project_mode():
        results = results.filter((AgentHint.system_hints == True) | (AgentHint.project_id == project_id))
    else:
        results = results.filter((AgentHint.system_hints == True) | (AgentHint.project_id == None))

    if category:
        results = results.filter(AgentHint.category == category)
    
    response = []
    for hint, is_locked in results.all():
        hint_dict = AgentHintSchema.model_validate(hint).model_dump()
        hint_dict["is_locked"] = is_locked
        response.append(hint_dict)
    return response

@router.get("/{hint_id}", response_model=AgentHintSchema)
def get_agent_hint(
    hint_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hint = db.query(AgentHint).filter(AgentHint.id == hint_id).first()
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found")
    
    is_locked = check_is_locked(db, hint_id, "agent_hints")
    hint_dict = AgentHintSchema.model_validate(hint).model_dump()
    hint_dict["is_locked"] = is_locked
    return hint_dict

@router.post("/", response_model=AgentHintSchema)
def create_agent_hint(
    hint_in: AgentHintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if key already exists
    existing = db.query(AgentHint).filter(AgentHint.key == hint_in.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Key already exists")
    
    # Automatically set project_id from context if not a system hint
    project_id = get_project_id()
    hint_data = hint_in.model_dump()
    
    # If in project mode and project_id not explicitly provided, set it
    if is_project_mode() and not hint_data.get("system_hints"):
        hint_data["project_id"] = project_id

    db_hint = AgentHint(
        **hint_data,
        created_by=current_user.id
    )
    db.add(db_hint)
    db.commit()
    db.refresh(db_hint)
    return db_hint

@router.patch("/{hint_id}", response_model=AgentHintSchema)
def update_agent_hint(
    hint_id: UUID,
    hint_in: AgentHintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_hint = db.query(AgentHint).filter(AgentHint.id == hint_id).first()
    if not db_hint:
        raise HTTPException(status_code=404, detail="Hint not found")
    
    raise_if_locked(db, hint_id, "agent_hints")
    
    update_data = hint_in.model_dump(exclude_unset=True)
    
    # Ensure key is not updated if it were somehow passed in AgentHintUpdate 
    # (though AgentHintUpdate schema doesn't include it, extra safeguard)
    if "key" in update_data:
        del update_data["key"]

    for field, value in update_data.items():
        setattr(db_hint, field, value)
    
    db.commit()
    db.refresh(db_hint)
    return db_hint

@router.delete("/{hint_id}")
def delete_agent_hint(
    hint_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_hint = db.query(AgentHint).filter(AgentHint.id == hint_id).first()
    if not db_hint:
        raise HTTPException(status_code=404, detail="Hint not found")
    
    raise_if_locked(db, hint_id, "agent_hints")
    
    db.delete(db_hint)
    db.commit()
    return {"message": "Hint deleted"}
