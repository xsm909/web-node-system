from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from uuid import UUID

class ApiRegistryBase(BaseModel):
    name: str
    base_url: str
    credential_key: Optional[str] = None
    functions: Optional[List[Dict[str, Any]]] = None # List of functions with name, method, path, etc.
    description: Optional[str] = None
    project_id: Optional[UUID] = None

class ApiRegistryCreate(ApiRegistryBase):
    pass

class ApiRegistryUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    credential_key: Optional[str] = None
    functions: Optional[List[Dict[str, Any]]] = None
    description: Optional[str] = None
    project_id: Optional[UUID] = None

class ApiRegistry(ApiRegistryBase):
    id: UUID
    is_locked: bool = False
    
    model_config = ConfigDict(from_attributes=True)
