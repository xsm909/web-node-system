from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any

class PromptBase(BaseModel):
    entity_id: UUID
    entity_type: str
    content: Dict[str, Any]
    category: Optional[str] = None
    datatype: str

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
