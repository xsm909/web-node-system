import json
import uuid
from typing import Any, List, Optional
from sqlalchemy.orm import joinedload
from ..core.database import SessionLocal
from ..models.schema import Record, MetaAssignment
from .logger_lib import system_log

def get_metadata(entity_type: str, entity_id: str, key: str, prop: Optional[str] = None) -> str:
    """
    Retrieves metadata by entity_type and entity_id and specific key.
    If multiple records contain the same key, values are gathered into an array.
    If 'prop' is specified, it extracts that specific property from the found data.
    Returns a JSON string.
    """
    system_log(f"[METADATA_LIB] Retrieving metadata for entity_type: {entity_type}, entity_id: {entity_id}, key: {key}, prop: {prop}", level="system")
    
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
                value = None
                found = False

                # 1. Check if the key exists in the record's data directly
                if key in assignment.record.data:
                    value = assignment.record.data[key]
                    found = True
                # 2. Check if the record's schema key matches the requested key
                # This allows retrieving the whole record if the key is the schema name
                elif assignment.record.schema and assignment.record.schema.key == key:
                    value = assignment.record.data
                    found = True
                
                if found:
                    if prop:
                        # Extract specific property if requested and available
                        if isinstance(value, dict) and prop in value:
                            values.append(value[prop])
                    else:
                        values.append(value)
        
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
        system_log(f"[METADATA_LIB] Result for key '{key}' (prop: {prop}): {json_result}", level="system")
        return json_result

    except Exception as e:
        system_log(f"[METADATA_LIB] Error retrieving metadata: {str(e)}", level="error")
        return json.dumps({"error": str(e)})
    finally:
        db.close()
