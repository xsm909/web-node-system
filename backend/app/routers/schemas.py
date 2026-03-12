from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, RoleEnum
from ..models.schema import Schema, ExternalSchemaCache
from ..schemas.schema_registry import SchemaCreate, SchemaUpdate, SchemaResponse, ExternalSchemaCacheResponse
from ..services.cache_manager import fetch_and_cache_external_schema

router = APIRouter(prefix="/schemas", tags=["schemas"])

def check_admin(user: User):
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")

@router.get("/", response_model=List[SchemaResponse])
def get_schemas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Schema).all()

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
        key=schema_in.key,
        content=schema_in.content,
        category=schema_in.category,
        meta=schema_in.meta,
        is_system=schema_in.is_system,
        lock=schema_in.lock
    )
    db.add(new_schema)
    db.commit()
    db.refresh(new_schema)
    return new_schema

@router.get("/{schema_id}", response_model=SchemaResponse)
def get_schema(schema_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    schema = db.query(Schema).filter(Schema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    return schema

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

    update_data = schema_in.model_dump(exclude_unset=True)
    
    # If schema is locked, only allow updating the 'lock' field itself
    if schema.lock:
        allowed_keys = {"lock"}
        updating_keys = set(update_data.keys())
        if not updating_keys.issubset(allowed_keys):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Schema is locked and cannot be edited. Unlock it first."
            )

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
        
    if "lock" in update_data:
        schema.lock = update_data["lock"]

    db.commit()
    db.refresh(schema)
    return schema

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
    
    if schema.lock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Schema is locked and cannot be deleted. Unlock it first."
        )

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
