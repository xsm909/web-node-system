from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from ..core.database import get_db
from ..models.prompt import Prompt
from ..models.user import User
from ..schemas.prompt import Prompt as PromptSchema, PromptCreate, PromptUpdate
from ..routers.auth import get_current_user

router = APIRouter(prefix="/prompts", tags=["Prompts"])

@router.get("/", response_model=List[PromptSchema])
def list_prompts(
    entity_id: Optional[UUID] = Query(None),
    entity_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    datatype: Optional[str] = Query(None),
    reference_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Prompt)
    if entity_id:
        query = query.filter(Prompt.entity_id == entity_id)
    if entity_type:
        query = query.filter(Prompt.entity_type == entity_type)
    if category:
        query = query.filter(Prompt.category == category)
    if datatype:
        query = query.filter(Prompt.datatype == datatype)
    if reference_id:
        query = query.filter(Prompt.reference_id == reference_id)
    
    return query.all()

@router.get("/{prompt_id}", response_model=PromptSchema)
def get_prompt(
    prompt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt

@router.post("/", response_model=PromptSchema)
def create_prompt(
    prompt_in: PromptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_prompt = Prompt(**prompt_in.model_dump())
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    return db_prompt

@router.patch("/{prompt_id}", response_model=PromptSchema)
def update_prompt(
    prompt_id: UUID,
    prompt_in: PromptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    update_data = prompt_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_prompt, field, value)
    
    db.commit()
    db.refresh(db_prompt)
    return db_prompt

@router.delete("/{prompt_id}")
def delete_prompt(
    prompt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    db.delete(db_prompt)
    db.commit()
    return {"message": "Prompt deleted"}
