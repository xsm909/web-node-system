from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime

# --- Schemas (JSON Schema Templates) ---
class SchemaBase(BaseModel):
    key: str
    content: Dict[str, Any]
    is_system: bool = False

class SchemaCreate(SchemaBase):
    pass

class SchemaUpdate(BaseModel):
    key: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    is_system: Optional[bool] = None

class SchemaResponse(SchemaBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Records (Validated Data Payloads) ---
class RecordBase(BaseModel):
    schema_id: UUID
    data: Dict[str, Any]

class RecordCreate(RecordBase):
    pass

class RecordUpdate(BaseModel):
    data: Optional[Dict[str, Any]] = None

class RecordResponse(RecordBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Meta Assignments (Polymorphic Binding) ---
class MetaAssignmentBase(BaseModel):
    record_id: UUID
    entity_type: str
    entity_id: UUID
    owner_id: Optional[UUID] = None

class MetaAssignmentCreate(MetaAssignmentBase):
    pass

class MetaAssignmentResponse(MetaAssignmentBase):
    id: UUID
    assigned_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class RecordWithSchemaResponse(RecordResponse):
    schema_: SchemaResponse = Field(alias="schema")

    class Config:
        from_attributes = True
        populate_by_name = True

class MetaAssignmentDetailResponse(MetaAssignmentBase):
    id: UUID
    assigned_by: UUID
    created_at: datetime
    record: RecordWithSchemaResponse

    class Config:
        from_attributes = True


# --- External Schema Cache ---
class ExternalSchemaCacheResponse(BaseModel):
    id: UUID
    url: str
    content: Dict[str, Any]
    etag: Optional[str] = None
    last_fetched: datetime

    class Config:
        from_attributes = True
