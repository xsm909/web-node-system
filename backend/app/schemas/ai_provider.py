from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional, Any

class AiProviderBase(BaseModel):
    models: Optional[Any] = None
    api_key: Optional[str] = None
    description: Optional[str] = None

class AiProviderCreate(AiProviderBase):
    key: str = Field(..., max_length=75)

class AiProviderUpdate(BaseModel):
    key: Optional[str] = Field(None, max_length=75)
    models: Optional[Any] = None
    api_key: Optional[str] = None
    description: Optional[str] = None

class AiProviderInDB(AiProviderBase):
    id: UUID
    key: str

    model_config = ConfigDict(from_attributes=True)

class AiProvider(AiProviderInDB):
    pass
