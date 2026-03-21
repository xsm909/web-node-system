from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, RoleEnum, LockData
from ..schemas.lock import LockToggle, LockData as LockDataSchema

router = APIRouter(prefix="/locks", tags=["locks"])

def check_admin(user: User):
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")

@router.post("/toggle", response_model=bool)
def toggle_lock(
    payload: LockToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    
    existing_lock = db.query(LockData).filter(
        LockData.entity_id == payload.entity_id,
        LockData.entity_type == payload.entity_type
    ).first()

    if payload.locked:
        if not existing_lock:
            new_lock = LockData(
                entity_id=payload.entity_id,
                entity_type=payload.entity_type
            )
            db.add(new_lock)
            db.commit()
            return True
        return True
    else:
        if existing_lock:
            db.delete(existing_lock)
            db.commit()
            return False
        return False

@router.get("/{entity_type}/{entity_id}", response_model=bool)
def get_lock_status(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lock = db.query(LockData).filter(
        LockData.entity_id == entity_id,
        LockData.entity_type == entity_type
    ).first()
    return lock is not None
