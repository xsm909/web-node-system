from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import exists, and_
from ..models.lock import LockData
import uuid

def check_is_locked(db: Session, entity_id: uuid.UUID, entity_type: str) -> bool:
    """
    Check if an entity is locked in the lock_data table.
    """
    return db.query(exists().where(and_(
        LockData.entity_id == entity_id,
        LockData.entity_type == entity_type
    ))).scalar()

def raise_if_locked(db: Session, entity_id: uuid.UUID, entity_type: str):
    """
    Raise a 403 Forbidden error if the entity is locked.
    """
    if check_is_locked(db, entity_id, entity_type):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Record of type '{entity_type}' with ID {entity_id} is locked and cannot be modified or deleted."
        )
