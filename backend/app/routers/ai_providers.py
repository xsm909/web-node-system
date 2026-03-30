from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from ..core.database import get_db
from ..models.ai_provider import AiProvider as AiProviderModel
from ..schemas.ai_provider import AiProvider, AiProviderCreate, AiProviderUpdate

router = APIRouter(prefix="/admin/ai-providers", tags=["ai-providers"])

@router.get("/", response_model=List[AiProvider])
def list_ai_providers(db: Session = Depends(get_db)):
    return db.query(AiProviderModel).all()

@router.post("/", response_model=AiProvider)
def create_ai_provider(provider_in: AiProviderCreate, db: Session = Depends(get_db)):
    existing = db.query(AiProviderModel).filter(AiProviderModel.key == provider_in.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Provider with this key already exists")
    db_obj = AiProviderModel(**provider_in.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.patch("/{provider_id}", response_model=AiProvider)
def update_ai_provider(provider_id: UUID, provider_in: AiProviderUpdate, db: Session = Depends(get_db)):
    db_obj = db.query(AiProviderModel).filter(AiProviderModel.id == provider_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    update_data = provider_in.model_dump(exclude_unset=True)
    if "key" in update_data and update_data["key"] != db_obj.key:
        existing = db.query(AiProviderModel).filter(AiProviderModel.key == update_data["key"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Provider with this key already exists")
            
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.delete("/{provider_id}")
def delete_ai_provider(provider_id: UUID, db: Session = Depends(get_db)):
    db_obj = db.query(AiProviderModel).filter(AiProviderModel.id == provider_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Provider not found")
         
    db.delete(db_obj)
    db.commit()
    return {"message": "Provider deleted"}
