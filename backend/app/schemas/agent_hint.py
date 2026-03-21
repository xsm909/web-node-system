from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any

class AgentHintBase(BaseModel):
    category: Optional[str] = None
    hint: str
    meta: Optional[Dict[str, Any]] = None

class AgentHintCreate(AgentHintBase):
    key: str = Field(..., max_length=100)

class AgentHintUpdate(BaseModel):
    category: Optional[str] = None
    hint: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None

class AgentHintInDB(AgentHintBase):
    id: UUID
    key: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    is_locked: bool = False

    model_config = ConfigDict(from_attributes=True)

class AgentHint(AgentHintInDB):
    pass
