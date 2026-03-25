from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from ..core.database import get_db
from ..models.preset import Preset as PresetModel
from ..schemas.preset import Preset, PresetCreate, PresetUpdate

router = APIRouter(prefix="/presets", tags=["presets"])

@router.post("/", response_model=Preset)
def create_or_update_preset(preset_in: PresetCreate, db: Session = Depends(get_db)):
    # Check if preset with same name and entity_type exists
    existing = db.query(PresetModel).filter(
        PresetModel.name == preset_in.name,
        PresetModel.entity_type == preset_in.entity_type
    ).first()
    
    if existing:
        existing.preset_data = preset_in.preset_data
        existing.category = preset_in.category
        db.commit()
        db.refresh(existing)
        return existing
    
    db_preset = PresetModel(
        **preset_in.model_dump()
    )
    db.add(db_preset)
    db.commit()
    db.refresh(db_preset)
    return db_preset

@router.get("/", response_model=List[Preset])
def list_presets(
    entity_type: str = Query(...),
    db: Session = Depends(get_db)
):
    return db.query(PresetModel).filter(PresetModel.entity_type == entity_type).all()

@router.delete("/{preset_id}")
def delete_preset(preset_id: UUID, db: Session = Depends(get_db)):
    db_preset = db.query(PresetModel).filter(PresetModel.id == preset_id).first()
    
    if not db_preset:
        raise HTTPException(status_code=404, detail="Preset not found")
         
    db.delete(db_preset)
    db.commit()
    return {"message": "Preset deleted"}

@router.patch("/{preset_id}", response_model=Preset)
def update_preset(
    preset_id: UUID,
    preset_in: PresetUpdate,
    db: Session = Depends(get_db)
):
    db_preset = db.query(PresetModel).filter(PresetModel.id == preset_id).first()
    if not db_preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    update_data = preset_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_preset, field, value)
    
    db.commit()
    db.refresh(db_preset)
    return db_preset

