from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..core.database import get_db
from ..core.security import require_role
from ..models.data_type import DataType

router = APIRouter(prefix="/data-types", tags=["data-types"])
# Since anyone who manages tasks might need data types, we can restrict to logged in users or managers
manager_access = Depends(require_role("manager", "admin"))

class DataTypeOut(BaseModel):
    id: int
    category: str
    type: str
    config: Optional[dict] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[DataTypeOut])
def get_data_types(category: Optional[str] = None, db: Session = Depends(get_db), _=manager_access):
    query = db.query(DataType)
    if category:
        query = query.filter(DataType.category == category)
    return query.all()
