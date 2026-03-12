from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from ..core.database import get_db
from ..models.agent_hint import AgentHint
from ..models.user import User
from ..schemas.agent_hint import AgentHint as AgentHintSchema, AgentHintCreate, AgentHintUpdate
from ..routers.auth import get_current_user

router = APIRouter(prefix="/agent-hints", tags=["Agent Hints"])

@router.get("/", response_model=List[AgentHintSchema])
def list_agent_hints(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(AgentHint)
    if category:
        query = query.filter(AgentHint.category == category)
    return query.all()

@router.get("/{hint_id}", response_model=AgentHintSchema)
def get_agent_hint(
    hint_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hint = db.query(AgentHint).filter(AgentHint.id == hint_id).first()
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found")
    return hint

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
    
    db_hint = AgentHint(
        **hint_in.model_dump(),
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
    
    db.delete(db_hint)
    db.commit()
    return {"message": "Hint deleted"}
