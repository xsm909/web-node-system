from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from typing import List, Dict, Any
from ..core.database import get_db
from ..core.security import require_role
from sqlalchemy import text

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

@router.get("/functions")
def get_functions(db: Session = Depends(get_db), _=manager_access):
    """List all available functions in the database."""
    query = text("""
        SELECT DISTINCT ON (category, p.proname)
            CASE 
                WHEN p.proname ILIKE 'json%' THEN 'JSON'
                WHEN p.proname IN ('sum', 'count', 'avg', 'min', 'max', 'upper', 'lower', 'coalesce', 'now', 'date_trunc') THEN 'MATH'
                WHEN n.nspname = 'public' THEN 'PUBLIC'
                ELSE 'MATH' -- fallback for whitelisted in pg_catalog
            END AS category,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE (n.nspname = 'public')
           OR (n.nspname = 'pg_catalog' AND (
               p.proname IN ('upper', 'lower', 'sum', 'count', 'avg', 'min', 'max', 'coalesce', 'now', 'date_trunc')
               OR (p.proname ILIKE 'json%' AND p.proname NOT ILIKE 'json_populate%')
           ))
        ORDER BY category, function_name, 1;
    """)
    try:
        result = db.execute(query)
        return [
            {
                "category": row[0],
                "name": row[1],
                "args": row[2]
            }
            for row in result
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching functions: {str(e)}")
