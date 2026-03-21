import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class ObjectParameterBase(BaseModel):
    parameter_name: str
    parameter_type: str = "text"
    default_value: Optional[str] = None
    source: Optional[str] = None
    value_field: Optional[str] = None
    label_field: Optional[str] = None

class ObjectParameterCreate(ObjectParameterBase):
    pass

class ObjectParameterOut(ObjectParameterBase):
    id: uuid.UUID

    class Config:
        from_attributes = True

class SourceTestRequest(BaseModel):
    source: str
    value_field: Optional[str] = None
    label_field: Optional[str] = None

class SourceTestResponse(BaseModel):
    options: List[Dict[str, Any]]
    error: Optional[str] = None
