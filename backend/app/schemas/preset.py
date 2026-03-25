from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional, Any
from datetime import datetime

class PresetBase(BaseModel):
    entity_type: str
    name: str
    category: Optional[str] = None
    preset_data: Any

class PresetCreate(PresetBase):
    pass

class PresetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    preset_data: Optional[Any] = None

class Preset(PresetBase):
    id: UUID
    
    model_config = ConfigDict(from_attributes=True)
