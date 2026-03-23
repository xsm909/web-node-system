from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
import json
from uuid import UUID
from datetime import datetime

# --- Schemas (JSON Schema Templates) ---
class SchemaBase(BaseModel):
    key: str
    content: Dict[str, Any]
    category: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    is_system: bool = False

    @field_validator('content', mode='before')
    @classmethod
    def parse_content(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return v
        return v

class SchemaCreate(SchemaBase):
    pass

class SchemaUpdate(BaseModel):
    key: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    category: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    is_system: Optional[bool] = None

class SchemaResponse(SchemaBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    is_locked: bool = False

    class Config:
        from_attributes = True


# --- Metadata (Validated Data Payloads) ---
class MetadataBase(BaseModel):
    schema_id: UUID
    parent_id: Optional[UUID] = None
    entity_id: Optional[UUID] = None
    entity_type: Optional[str] = None
    data: Any
    order: int = 0

class MetadataCreate(MetadataBase):
    pass

class MetadataUpdate(BaseModel):
    data: Optional[Any] = None

class MetadataResponse(MetadataBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    is_locked: bool = False
    children: Optional[List['MetadataResponse']] = []

    class Config:
        from_attributes = True


class MetadataWithSchemaResponse(MetadataResponse):
    schema_: SchemaResponse = Field(alias="schema")

    class Config:
        from_attributes = True
        populate_by_name = True


# --- External Schema Cache ---
class ExternalSchemaCacheResponse(BaseModel):
    id: UUID
    url: str
    content: Dict[str, Any]
    etag: Optional[str] = None
    last_fetched: datetime

    @field_validator('content', mode='before')
    @classmethod
    def parse_content(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return v
        return v

    class Config:
        from_attributes = True
