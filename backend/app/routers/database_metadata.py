from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from typing import List, Dict, Any
from ..core.database import get_db
from ..core.security import require_role

router = APIRouter(prefix="/database-metadata", tags=["database-metadata"])

# Access control: Managers and Admins can view metadata
manager_access = Depends(require_role("manager", "admin"))

@router.get("/tables", response_model=List[str])
def get_tables(db: Session = Depends(get_db), _=manager_access):
    """List all table names in the database."""
    inspector = inspect(db.get_bind())
    return inspector.get_table_names()

@router.get("/tables/{table_name}/columns")
def get_columns(table_name: str, db: Session = Depends(get_db), _=manager_access):
    """List columns for a specific table."""
    inspector = inspect(db.get_bind())
    try:
        columns = inspector.get_columns(table_name)
        return [
            {
                "name": col["name"],
                "type": str(col["type"]),
                "nullable": col["nullable"],
                "default": str(col["default"]) if col.get("default") else None,
                "primary_key": col.get("primary_key", False)
            }
            for col in columns
        ]
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found or error: {str(e)}")

@router.get("/tables/{table_name}/foreign-keys")
def get_foreign_keys(table_name: str, db: Session = Depends(get_db), _=manager_access):
    """List foreign keys for a specific table."""
    inspector = inspect(db.get_bind())
    try:
        return inspector.get_foreign_keys(table_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found or error: {str(e)}")
