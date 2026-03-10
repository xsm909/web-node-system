import json
import uuid
from typing import Any, List, Optional
from sqlalchemy.orm import joinedload
from ..core.database import SessionLocal
from ..models.schema import Record, MetaAssignment
from .logger_lib import system_log

def get_metadata(entity_type: str, entity_id: str, key: str) -> str:
    """
    Retrieves metadata by entity_type and entity_id and specific key.
    If multiple records contain the same key, values are gathered into an array.
    Returns a JSON string.
    """
    system_log(f"[METADATA_LIB] Retrieving metadata for entity_type: {entity_type}, entity_id: {entity_id}, key: {key}", level="system")
    
    db = SessionLocal()
    try:
        # Convert string ID to UUID if needed
        entity_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        
        # Query meta_assignments for this entity, joining with records and schemas
        assignments = (
            db.query(MetaAssignment)
            .options(joinedload(MetaAssignment.record).joinedload(Record.schema))
            .filter(
                MetaAssignment.entity_type == entity_type,
                MetaAssignment.entity_id == entity_uuid
            )
            .all()
        )
        
        values = []
        for assignment in assignments:
            if assignment.record and assignment.record.data:
                # 1. Check if the key exists in the record's data directly
                if key in assignment.record.data:
                    value = assignment.record.data[key]
                    values.append(value)
                # 2. Check if the record's schema key matches the requested key
                # This allows retrieving the whole record if the key is the schema name
                elif assignment.record.schema and assignment.record.schema.key == key:
                    values.append(assignment.record.data)
        
        # Logic for returning values:
        # - 0 values: return json.dumps(None)
        # - 1 value: return json.dumps(value)
        # - multiple values: return json.dumps(values)
        
        if not values:
            result = None
        elif len(values) == 1:
            result = values[0]
        else:
            result = values
            
        json_result = json.dumps(result, ensure_ascii=False)
        system_log(f"[METADATA_LIB] Result for key '{key}': {json_result}", level="system")
        return json_result

    except Exception as e:
        system_log(f"[METADATA_LIB] Error retrieving metadata: {str(e)}", level="error")
        return json.dumps({"error": str(e)})
    finally:
        db.close()
