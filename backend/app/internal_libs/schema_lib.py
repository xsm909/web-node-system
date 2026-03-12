import json
from typing import Any, List, Optional, Dict
from ..core.database import SessionLocal
from ..models.schema import Schema
from .logger_lib import system_log

def get_schema_by_key(key: str) -> str:
    """
    Retrieves a JSON schema by its unique key.
    Returns the schema content as a JSON string.
    If not found, returns JSON 'null'.
    """
    system_log(f"[SCHEMA_LIB] Retrieving schema for key: {key}", level="system")
    
    db = SessionLocal()
    try:
        schema = db.query(Schema).filter(Schema.key == key).first()
        
        if not schema:
            system_log(f"[SCHEMA_LIB] Schema not found for key: {key}", level="warning")
            return json.dumps(None)
            
        result = schema.content
        json_result = json.dumps(result, ensure_ascii=False)
        return json_result

    except Exception as e:
        system_log(f"[SCHEMA_LIB] Error retrieving schema by key '{key}': {str(e)}", level="error")
        return json.dumps({"error": str(e)})
    finally:
        db.close()

def get_all_schemas() -> str:
    """
    Retrieves all JSON schemas from the database.
    Returns a list of schema objects as a JSON string.
    """
    system_log("[SCHEMA_LIB] Retrieving all schemas", level="system")
    
    db = SessionLocal()
    try:
        schemas = db.query(Schema).all()
        
        results = []
        for schema in schemas:
            results.append({
                "id": str(schema.id),
                "key": schema.key,
                "content": schema.content,
                "category": schema.category,
                "is_system": schema.is_system,
                "lock": schema.lock,
                "created_at": schema.created_at.isoformat() if schema.created_at else None,
                "updated_at": schema.updated_at.isoformat() if schema.updated_at else None
            })
            
        json_result = json.dumps(results, ensure_ascii=False)
        system_log(f"[SCHEMA_LIB] Retrieved {len(results)} schemas", level="system")
        return json_result

    except Exception as e:
        system_log(f"[SCHEMA_LIB] Error retrieving all schemas: {str(e)}", level="error")
        return json.dumps({"error": str(e)})
    finally:
        db.close()
