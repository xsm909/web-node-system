from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, RoleEnum, LockData, Schema, ExternalSchemaCache
from ..schemas.schema_registry import SchemaCreate, SchemaUpdate, SchemaResponse, ExternalSchemaCacheResponse
from sqlalchemy import exists, and_
from ..services.cache_manager import fetch_and_cache_external_schema
from ..core.locks import raise_if_locked, check_is_locked
from ..internal_libs import projects_lib

router = APIRouter(prefix="/schemas", tags=["schemas"])

def check_admin(user: User):
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")

@router.get("/", response_model=List[SchemaResponse])
def get_schemas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_project_id = projects_lib.get_project_id()
    
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == Schema.id,
        LockData.entity_type == "schemas"
    ).exists()
    
    query = db.query(Schema, is_locked_subquery.label("is_locked"))
    if current_project_id:
        # In project mode: see project items + systemic ones
        query = query.filter((Schema.project_id == current_project_id) | (Schema.is_system == True))
    else:
        # Outside project mode: see only items with no project
        query = query.filter(Schema.project_id == None)
        
    results = query.all()
    
    response = []
    for schema, is_locked in results:
        schema_dict = {c.name: getattr(schema, c.name) for c in schema.__table__.columns}
        schema_dict["is_locked"] = is_locked
        response.append(schema_dict)
    return response

@router.post("/", response_model=SchemaResponse)
def create_schema(
    schema_in: SchemaCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    if db.query(Schema).filter(Schema.key == schema_in.key).first():
        raise HTTPException(status_code=400, detail="Schema key already exists")
    
    new_schema = Schema(
        **schema_in.model_dump(),
        project_id=schema_in.project_id or projects_lib.get_project_id()
    )
    db.add(new_schema)
    db.commit()
    db.refresh(new_schema)
    return {**{c.name: getattr(new_schema, c.name) for c in new_schema.__table__.columns}, "is_locked": False}

@router.get("/{schema_id}", response_model=SchemaResponse)
def get_schema(schema_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_locked = db.query(exists().where(and_(
        LockData.entity_id == schema_id,
        LockData.entity_type == "schemas"
    ))).scalar()
    
    schema = db.query(Schema).filter(Schema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    schema_dict = {c.name: getattr(schema, c.name) for c in schema.__table__.columns}
    schema_dict["is_locked"] = is_locked
    return schema_dict

@router.put("/{schema_id}", response_model=SchemaResponse)
def update_schema(
    schema_id: UUID, 
    schema_in: SchemaUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    schema = db.query(Schema).filter(Schema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")

    raise_if_locked(db, schema_id, "schemas")

    update_data = schema_in.model_dump(exclude_unset=True)

    if "key" in update_data and update_data["key"] != schema.key:
        if db.query(Schema).filter(Schema.key == update_data["key"]).first():
            raise HTTPException(status_code=400, detail="Schema key already exists")
        schema.key = update_data["key"]
    
    if "content" in update_data:
        schema.content = update_data["content"]
        
    if "category" in update_data:
        schema.category = update_data["category"]
        # Auto-update tags if category changed and meta is being updated or exists
        if schema.meta is None:
            schema.meta = {}
        
        category_val = update_data["category"] or ""
        tags = [t.strip().lower() for t in category_val.split('|') if t.strip()]
        schema.meta = {**schema.meta, "tags": tags}
    
    if "meta" in update_data:
        schema.meta = update_data["meta"]
        
    if "is_system" in update_data:
        schema.is_system = update_data["is_system"]

    db.commit()
    db.refresh(schema)
    
    is_locked = db.query(exists().where(and_(
        LockData.entity_id == schema_id,
        LockData.entity_type == "schemas"
    ))).scalar()
    
    return {**{c.name: getattr(schema, c.name) for c in schema.__table__.columns}, "is_locked": is_locked}

@router.delete("/{schema_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schema(
    schema_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    schema = db.query(Schema).filter(Schema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")

    raise_if_locked(db, schema_id, "schemas")

    if schema.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete a system schema")

    db.delete(schema)
    db.commit()

# --- Cache Endpoints ---
@router.post("/cache/refresh", response_model=ExternalSchemaCacheResponse)
async def refresh_external_schema(
    url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin(current_user)
    try:
        content = await fetch_and_cache_external_schema(db, url, force_refresh=True)
        cached = db.query(ExternalSchemaCache).filter(ExternalSchemaCache.url == url).first()
        return cached
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
