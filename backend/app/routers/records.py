from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, RoleEnum
from ..models.schema import Record, Schema, MetaAssignment
from ..schemas.schema_registry import (
    RecordCreate, RecordUpdate, RecordResponse, 
    MetaAssignmentCreate, MetaAssignmentResponse
)
from ..services.validator import validate_json_data

router = APIRouter(prefix="/records", tags=["records"])

def check_admin(user: User):
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")

@router.get("/", response_model=List[RecordResponse])
def get_records(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Very basic return. Ideally, should be scoped by owner_id in MetaAssignment
    return db.query(Record).all()

@router.post("/", response_model=RecordResponse)
def create_record(
    record_in: RecordCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    schema = db.query(Schema).filter(Schema.id == record_in.schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    # Validate payload - allow empty {} on creation for initial assignment
    if record_in.data != {}:
        is_valid, err_msg = validate_json_data(db, schema.content, record_in.data)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Validation error: {err_msg}")

    new_record = Record(
        schema_id=record_in.schema_id,
        parent_id=record_in.parent_id,
        data=record_in.data
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@router.put("/{record_id}", response_model=RecordResponse)
def update_record(
    record_id: UUID, 
    record_in: RecordUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record_in.data is not None:
        is_valid, err_msg = validate_json_data(db, record.schema.content, record_in.data)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Validation error: {err_msg}")
        record.data = record_in.data

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user) # Only admins should hard delete records for now
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(record)
    db.commit()


# --- Meta Assignments Endpoints ---
@router.post("/assign", response_model=MetaAssignmentResponse)
def assign_metadata(
    assign_in: MetaAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    
    # Make sure record exists
    if not db.query(Record).filter(Record.id == assign_in.record_id).first():
        raise HTTPException(status_code=404, detail="Record not found")

    # If assignment exists for this record, fail or update
    existing = db.query(MetaAssignment).filter(MetaAssignment.record_id == assign_in.record_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Record is already assigned")

    new_assign = MetaAssignment(
        record_id=assign_in.record_id,
        entity_type=assign_in.entity_type,
        entity_id=assign_in.entity_id,
        assigned_by=current_user.id,
        owner_id=assign_in.owner_id
    )
    db.add(new_assign)
    db.commit()
    db.refresh(new_assign)
    return new_assign

from sqlalchemy.orm import joinedload
from ..schemas.schema_registry import MetaAssignmentDetailResponse

@router.get("/entity/{entity_type}/{entity_id}", response_model=List[MetaAssignmentDetailResponse])
def get_entity_metadata(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Returns metadata assigned to a specific entity
    # Ideally should join with records and schemas, returning a richer structure
    assignments = db.query(MetaAssignment).options(
        joinedload(MetaAssignment.record).joinedload(Record.schema),
        joinedload(MetaAssignment.record).selectinload(Record.children) # Use selectinload for children
    ).filter(
        MetaAssignment.entity_type == entity_type,
        MetaAssignment.entity_id == entity_id
    ).all()
    
    return assignments


@router.delete("/assign/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def unassign_metadata(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    
    assignment = db.query(MetaAssignment).filter(MetaAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # We delete the record, which cascades to the assignment
    record = db.query(Record).filter(Record.id == assignment.record_id).first()
    if record:
        db.delete(record)
    else:
        # Fallback: if record is already gone, just delete the assignment
        db.delete(assignment)
        
    db.commit()
