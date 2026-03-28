from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from ..core.database import get_db
from ..models.prompt import Prompt
from ..models.user import User
from ..schemas.prompt import Prompt as PromptSchema, PromptCreate, PromptUpdate
from ..routers.auth import get_current_user
from sqlalchemy import exists, and_
from ..models import LockData
from ..core.locks import raise_if_locked, check_is_locked

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
    is_locked_subquery = db.query(exists().where(and_(
        LockData.entity_id == Prompt.id,
        LockData.entity_type == "prompts"
    ))).scalar_subquery()
    
    results = db.query(Prompt, is_locked_subquery.label("is_locked"))
    
    # Filter by project context
    from ..internal_libs.projects_lib import get_project_id, is_project_mode
    project_id = get_project_id()
    if is_project_mode():
        results = results.filter(Prompt.project_id == project_id)
    else:
        results = results.filter(Prompt.project_id == None)
        
    if entity_id:
        results = results.filter(Prompt.entity_id == entity_id)
    if entity_type:
        results = results.filter(Prompt.entity_type == entity_type)
    if category:
        results = results.filter(Prompt.category == category)
    if datatype:
        results = results.filter(Prompt.datatype == datatype)
    if reference_id:
        results = results.filter(Prompt.reference_id == reference_id)
    
    response = []
    for prompt, is_locked in results.all():
        prompt_dict = PromptSchema.model_validate(prompt).model_dump()
        prompt_dict["is_locked"] = is_locked
        response.append(prompt_dict)
    return response

@router.get("/{prompt_id}", response_model=PromptSchema)
def get_prompt(
    prompt_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    is_locked = check_is_locked(db, prompt_id, "prompts")
    prompt_dict = PromptSchema.model_validate(prompt).model_dump()
    prompt_dict["is_locked"] = is_locked
    return prompt_dict

@router.post("/", response_model=PromptSchema)
def create_prompt(
    prompt_in: PromptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from ..internal_libs.projects_lib import get_project_id, is_project_mode
    
    prompt_data = prompt_in.model_dump()
    
    # Automatically set project_id if in project mode
    if is_project_mode() and not prompt_data.get("project_id"):
        prompt_data["project_id"] = get_project_id()

    db_prompt = Prompt(**prompt_data)
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    
    is_locked = check_is_locked(db, db_prompt.id, "prompts")
    prompt_dict = PromptSchema.model_validate(db_prompt).model_dump()
    prompt_dict["is_locked"] = is_locked
    return prompt_dict

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
    
    raise_if_locked(db, prompt_id, "prompts")
    
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
    
    raise_if_locked(db, prompt_id, "prompts")
    
    db.delete(db_prompt)
    db.commit()
    return {"message": "Prompt deleted"}
