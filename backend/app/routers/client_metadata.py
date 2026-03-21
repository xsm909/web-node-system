from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from ..core.database import get_db
from ..core.security import require_role, get_current_user
from ..models.user import User
from ..models.client_metadata import ClientMetadata
from ..models import LockData
from sqlalchemy import exists, and_
from ..core.locks import raise_if_locked, check_is_locked
from pydantic import BaseModel

router = APIRouter(prefix="/client-metadata", tags=["client-metadata"])
manager_access = Depends(require_role("manager", "admin"))

class ClientMetadataBase(BaseModel):
    owner_id: uuid.UUID
    data_type_id: int
    meta_data: Optional[dict] = None

class ClientMetadataCreate(ClientMetadataBase):
    pass

class ClientMetadataUpdate(BaseModel):
    owner_id: Optional[uuid.UUID] = None
    data_type_id: Optional[int] = None
    meta_data: Optional[dict] = None

class ClientMetadataOut(ClientMetadataBase):
    id: uuid.UUID
    created_by: Optional[uuid.UUID] = None
    updated_by: Optional[uuid.UUID] = None
    is_locked: bool = False

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ClientMetadataOut])
def list_client_metadata(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    is_locked_subquery = db.query(exists().where(and_(
        LockData.entity_id == ClientMetadata.id,
        LockData.entity_type == "client_metadata"
    ))).scalar_subquery()

    if current_user.role == "admin":
        results = db.query(ClientMetadata, is_locked_subquery.label("is_locked")).all()
    else:
        client_ids = [str(u.id) for u in current_user.assigned_clients]
        results = db.query(ClientMetadata, is_locked_subquery.label("is_locked")).filter(
            (ClientMetadata.owner_id.in_(client_ids)) | (ClientMetadata.created_by == current_user.id)
        ).all()
        
    response = []
    for cm, is_locked in results:
        cm_dict = ClientMetadataOut.model_validate(cm).model_dump()
        cm_dict["is_locked"] = is_locked
        response.append(cm_dict)
    return response

from sqlalchemy.exc import IntegrityError

@router.post("/", response_model=ClientMetadataOut)
def create_client_metadata(data: ClientMetadataCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    cm_data = data.model_dump()
    cm = ClientMetadata(
        **cm_data,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(cm)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Metadata for this client and data type already exists")
    db.refresh(cm)
    return cm

@router.put("/{cm_id}", response_model=ClientMetadataOut)
def update_client_metadata(cm_id: uuid.UUID, data: ClientMetadataUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    cm = db.query(ClientMetadata).filter(ClientMetadata.id == cm_id).first()
    if not cm:
        raise HTTPException(status_code=404, detail="ClientMetadata not found")
    
    raise_if_locked(db, cm_id, "client_metadata")
    
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(cm, k, v)
    cm.updated_by = current_user.id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Metadata for this client and data type already exists")
    db.refresh(cm)
    return cm

@router.delete("/{cm_id}")
def delete_client_metadata(cm_id: uuid.UUID, db: Session = Depends(get_db), _=manager_access):
    cm = db.query(ClientMetadata).filter(ClientMetadata.id == cm_id).first()
    if not cm:
        raise HTTPException(status_code=404, detail="ClientMetadata not found")
    
    raise_if_locked(db, cm_id, "client_metadata")
    
    db.delete(cm)
    db.commit()
    return {"status": "deleted"}
