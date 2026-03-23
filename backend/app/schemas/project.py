from pydantic import BaseModel, Field
from typing import Optional
import uuid

class ProjectBase(BaseModel):
    key: str = Field(..., max_length=75)
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    owner_id: uuid.UUID
    theme_color: Optional[str] = "#3b82f6"
    category: str = "general"

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    theme_color: Optional[str] = None
    category: Optional[str] = None

class ProjectOut(ProjectBase):
    id: uuid.UUID
    is_locked: bool = False

    class Config:
        from_attributes = True
