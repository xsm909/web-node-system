from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class LockDataBase(BaseModel):
    entity_id: UUID
    entity_type: str

class LockDataCreate(LockDataBase):
    pass

class LockData(LockDataBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class LockToggle(BaseModel):
    entity_id: UUID
    entity_type: str
    locked: bool
