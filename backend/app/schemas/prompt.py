from typing import Optional, Dict, Any, Union
import json
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

class PromptBase(BaseModel):
    entity_id: UUID
    entity_type: str
    content: Dict[str, Any]
    category: Optional[str] = None
    datatype: str
    reference_id: Optional[UUID] = None

    @field_validator('content', mode='before')
    @classmethod
    def parse_content(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return v
        return v

class PromptCreate(PromptBase):
    pass

class PromptUpdate(BaseModel):
    content: Optional[Dict[str, Any]] = None
    category: Optional[str] = None
    datatype: Optional[str] = None

class Prompt(PromptBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
