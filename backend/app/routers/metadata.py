from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional, Any, Dict
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, RoleEnum, LockData
from ..models.schema import MetadataRecord, Schema
from sqlalchemy import exists, and_
from ..core.locks import raise_if_locked, check_is_locked
from ..schemas.schema_registry import (
    MetadataCreate, MetadataUpdate, MetadataResponse
)
from ..services.validator import validate_json_data
from ..internal_libs.logger_lib import system_log
from ..internal_libs.projects_lib import get_project_id, is_project_mode

router = APIRouter(prefix="/metadata", tags=["metadata"])

def check_admin(user: User):
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")

@router.get("/", response_model=List[MetadataResponse])
def get_metadata_records(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == MetadataRecord.id,
        LockData.entity_type == "metadata"
    ).exists()
    
    query = db.query(MetadataRecord, is_locked_subquery.label("is_locked")).join(Schema, MetadataRecord.schema_id == Schema.id)
    
    # Project filtering
    active_project_id = get_project_id()
    if is_project_mode():
        query = query.filter(
            (MetadataRecord.project_id == active_project_id) | 
            (MetadataRecord.project_id == None) | 
            (Schema.is_system == True)
        )
    else:
        query = query.filter(MetadataRecord.project_id == None)

    results = query.all()
    
    response = []
    for record, is_locked in results:
        record_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
        record_dict["is_locked"] = is_locked
        response.append(record_dict)
    return response

@router.post("/", response_model=MetadataResponse)
def create_metadata_record(
    record_in: MetadataCreate, 
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

    # Automatic order assignment and entity inheritance for child records
    entity_id = record_in.entity_id
    entity_type = record_in.entity_type
    
    if record_in.parent_id:
        parent = db.query(MetadataRecord).filter(MetadataRecord.id == record_in.parent_id).first()
        if parent:
            # Always inherit entity context from parent to ensure root ownership
            entity_id = parent.entity_id
            entity_type = parent.entity_type
            
        max_order = db.query(func.max(MetadataRecord.order)).filter(MetadataRecord.parent_id == record_in.parent_id).scalar() or 0
        order = max_order + 1
    else:
        order = record_in.order or 0

    new_record = MetadataRecord(
        schema_id=record_in.schema_id,
        parent_id=record_in.parent_id,
        entity_id=entity_id,
        entity_type=entity_type,
        data=record_in.data,
        order=order,
        project_id=get_project_id() if is_project_mode() else record_in.project_id
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    record_dict = {c.name: getattr(new_record, c.name) for c in new_record.__table__.columns}
    record_dict["is_locked"] = False
    return record_dict

@router.put("/{record_id}", response_model=MetadataResponse)
def update_metadata_record(
    record_id: UUID, 
    record_in: MetadataUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    record = db.query(MetadataRecord).filter(MetadataRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Metadata record not found")

    raise_if_locked(db, record_id, "metadata")

    if record_in.data is not None:
        is_valid, err_msg = validate_json_data(db, record.schema.content, record_in.data)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Validation error: {err_msg}")
        record.data = record_in.data

    db.commit()
    db.refresh(record)
    
    is_locked = db.query(exists().where(and_(
        LockData.entity_id == record_id,
        LockData.entity_type == "metadata"
    ))).scalar()
    
    record_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
    record_dict["is_locked"] = is_locked
    return record_dict


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_metadata_record(
    record_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user) # Only admins should hard delete records for now
    record = db.query(MetadataRecord).filter(MetadataRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Metadata record not found")

    raise_if_locked(db, record_id, "metadata")

    db.delete(record)
    db.commit()


def get_recursive_record(db: Session, record_id: UUID, depth=0) -> MetadataRecord:
    """Helper to load a record with its schema and ALL descendants recursively."""
    record = db.query(MetadataRecord).options(
        joinedload(MetadataRecord.schema),
        selectinload(MetadataRecord.children)
    ).filter(MetadataRecord.id == record_id).first()
    
    if record and record.children:
        # Sort children by order (though selectinload above should handle it if using newer SQLA, 
        # but let's be explicit if needed or just rely on the query)
        record.children.sort(key=lambda x: x.order)
        for child in record.children:
            get_recursive_record(db, child.id, depth + 1)
    return record

@router.get("/entity/{entity_type}/{entity_id}", response_model=List[MetadataResponse])
def get_entity_metadata(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Returns all metadata records assigned to a specific entity
    # (Removed root-only filter to allow frontend tree building)
    query = db.query(MetadataRecord).filter(
        MetadataRecord.entity_type == entity_type,
        MetadataRecord.entity_id == entity_id
    ).options(
        joinedload(MetadataRecord.schema)
    )

    # Project filtering
    active_project_id = get_project_id()
    if is_project_mode():
        query = query.filter(
            (MetadataRecord.project_id == active_project_id) | 
            (MetadataRecord.project_id == None) | 
            (Schema.is_system == True)
        )
    else:
        query = query.filter(MetadataRecord.project_id == None)

    records = query.order_by(MetadataRecord.order).all()
    
    # Check locks once for all records
    record_ids = [r.id for r in records]
    locked_ids = {
        row.entity_id for row in db.query(LockData.entity_id).filter(
            LockData.entity_id.in_(record_ids),
            LockData.entity_type == "metadata"
        ).all()
    }
    
    results = []
    for record in records:
        record_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
        record_dict["is_locked"] = record.id in locked_ids
        results.append(record_dict)
        
    return results


from sqlalchemy import text

@router.get("/references/{record_id}", response_model=List[MetadataResponse])
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
SELECT id FROM metadata 
WHERE (entity_type, entity_id) = (SELECT entity_type, entity_id FROM metadata WHERE id = :record_id)
  AND schema_id = (SELECT id FROM schemas WHERE key = :schema_key);
    """)

    matching_rows = db.execute(query_sql, {
        "record_id": str(record_id),
        "schema_key": schema_key
    }).all()
    
    if not matching_rows:
        return []
    
    ids = [r[0] for r in matching_rows]
    records = db.query(MetadataRecord).filter(MetadataRecord.id.in_(ids)).all()
    
    response = []
    for record in records:
        is_locked = db.query(exists().where(and_(
            LockData.entity_id == record.id,
            LockData.entity_type == "metadata"
        ))).scalar()
        record_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
        record_dict["is_locked"] = is_locked
        response.append(record_dict)
    return response



@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_metadata_records(
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
            db.query(MetadataRecord).filter(MetadataRecord.id == record_id).update({"order": new_order})
    
    db.commit()
