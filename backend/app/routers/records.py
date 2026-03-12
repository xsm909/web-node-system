from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional, Any, Dict
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, RoleEnum
from ..models.schema import Record, Schema, MetaAssignment
from ..schemas.schema_registry import (
    RecordCreate, RecordUpdate, RecordResponse, 
    MetaAssignmentCreate, MetaAssignmentResponse,
    MetaAssignmentDetailResponse
)
from ..services.validator import validate_json_data
from ..internal_libs.logger_lib import system_log

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

    # Automatic order assignment for child records
    if record_in.parent_id:
        max_order = db.query(func.max(Record.order)).filter(Record.parent_id == record_in.parent_id).scalar() or 0
        order = max_order + 1
    else:
        order = record_in.order or 0

    new_record = Record(
        schema_id=record_in.schema_id,
        parent_id=record_in.parent_id,
        data=record_in.data,
        order=order,
        lock=record_in.lock
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
        
    if record_in.lock is not None:
        record.lock = record_in.lock

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

    # Automatic order assignment for root records
    max_order = db.query(func.max(Record.order)).join(MetaAssignment).filter(
        MetaAssignment.entity_type == assign_in.entity_type,
        MetaAssignment.entity_id == assign_in.entity_id
    ).scalar() or 0
    
    record = db.query(Record).filter(Record.id == assign_in.record_id).first()
    if record:
        record.order = max_order + 1

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

def get_recursive_record(db: Session, record_id: UUID, depth=0) -> Record:
    """Helper to load a record with its schema and ALL descendants recursively."""
    record = db.query(Record).options(
        joinedload(Record.schema),
        selectinload(Record.children)
    ).filter(Record.id == record_id).first()
    
    if record and record.children:
        # Sort children by order (though selectinload above should handle it if using newer SQLA, 
        # but let's be explicit if needed or just rely on the query)
        record.children.sort(key=lambda x: x.order)
        for child in record.children:
            get_recursive_record(db, child.id, depth + 1)
    return record

@router.get("/entity/{entity_type}/{entity_id}", response_model=List[MetaAssignmentDetailResponse])
def get_entity_metadata(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Returns metadata assigned to a specific entity
    # Fetch root assignments
    assignments = db.query(MetaAssignment).filter(
        MetaAssignment.entity_type == entity_type,
        MetaAssignment.entity_id == entity_id
    ).all()
    
    # Refresh/load each assigned record tree recursively
    for assignment in assignments:
        get_recursive_record(db, assignment.record_id)
        
    # Sort assignments by record order
    assignments.sort(key=lambda x: x.record.order if x.record else 0)
        
    return assignments


from sqlalchemy import text

@router.get("/references/{record_id}", response_model=List[RecordResponse])
def get_references(
    record_id: UUID,
    schema_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    1) Find target schema_id by schema_key.
    2) Find root parent for the current record.
    3) Identify the entity (entity_type, entity_id) this root belongs to.
    4) Find all OTHER roots assigned to the SAME entity.
    5) Return all records in all those trees that match the target schema.
    """
    query_sql = text("""
WITH target_schema AS (
    SELECT id FROM schemas WHERE key = :schema_key
),
current_tree AS (
    -- Get root of the provided record
    WITH RECURSIVE up AS (
        SELECT id, parent_id FROM records WHERE id = :record_id
        UNION ALL
        SELECT r.id, r.parent_id FROM records r JOIN up ON r.id = up.parent_id
    )
    SELECT id FROM up WHERE parent_id IS NULL LIMIT 1
),
current_entity AS (
    -- Find what entity this root is assigned to
    SELECT entity_type, entity_id FROM meta_assignments 
    WHERE record_id = (SELECT id FROM current_tree)
),
all_entity_roots AS (
    -- Find all roots assigned to this same entity
    SELECT record_id FROM meta_assignments
    WHERE (entity_type, entity_id) = (SELECT entity_type, entity_id FROM current_entity)
),
all_records AS (
    -- Get all records in all trees for this entity
    WITH RECURSIVE down AS (
        SELECT r.id, r.parent_id, r.schema_id FROM records r
        JOIN all_entity_roots aer ON r.id = aer.record_id
        UNION ALL
        SELECT r.id, r.parent_id, r.schema_id FROM records r
        JOIN down ON r.parent_id = down.id
    )
    SELECT DISTINCT id, schema_id FROM down
)
SELECT id FROM all_records WHERE schema_id = (SELECT id FROM target_schema);
    """)

    matching_rows = db.execute(query_sql, {
        "record_id": str(record_id),
        "schema_key": schema_key
    }).all()
    
    if not matching_rows:
        return []
    
    ids = [r[0] for r in matching_rows]
    return db.query(Record).filter(Record.id.in_(ids)).all()


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

@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_records(
    orders: List[Dict[str, Any]], 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Expects a list of {'id': UUID, 'order': int}
    """
    for item in orders:
        record_id = item.get('id')
        new_order = item.get('order')
        if record_id and new_order is not None:
            db.query(Record).filter(Record.id == record_id).update({"order": new_order})
    
    db.commit()
