import json
import uuid
from typing import Any, List, Optional, Dict
from sqlalchemy.orm import joinedload, selectinload
from ..core.database import SessionLocal
from ..models.schema import Record, MetaAssignment
from .logger_lib import system_log

def _serialize_record(record: Record) -> Dict[str, Any]:
    """Helper to convert Record and its children to a hierarchical dictionary."""
    data = record.data.copy() if record.data else {}
    
    # Identify schema and ID
    if record.schema:
        data["__schema__"] = record.schema.key
    data["__id__"] = str(record.id)
    data["__lock__"] = record.lock
    
    # Process children recursively
    if record.children:
        data["children"] = [_serialize_record(child) for child in record.children]
    
    return data

def get_metadata(entity_type: str, entity_id: str, key: str) -> str:
    """
    Retrieves metadata by entity_type and entity_id and specific key.
    If multiple records contain the same key/schema, values are gathered into an array.
    Supports hierarchical retrieval (includes children).
    Returns a JSON string.
    """
    system_log(f"[METADATA_LIB] Retrieving metadata for entity_type: {entity_type}, entity_id: {entity_id}, key: {key}", level="system")
    
    db = SessionLocal()
    try:
        # Convert string ID to UUID if needed
        entity_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        
        # Query meta_assignments, loading records with schema and children
        assignments = (
            db.query(MetaAssignment)
            .options(
                joinedload(MetaAssignment.record).joinedload(Record.schema),
                joinedload(MetaAssignment.record).selectinload(Record.children)
            )
            .filter(
                MetaAssignment.entity_type == entity_type,
                MetaAssignment.entity_id == entity_uuid
            )
            .all()
        )
        
        values = []
        for assignment in assignments:
            record = assignment.record
            if record:
                # 1. Check if the key exists in the record's data directly OR schema key matches
                found = False
                if record.data and key in record.data:
                    found = True
                elif record.schema and record.schema.key == key:
                    found = True
                
                if found:
                    serialized = _serialize_record(record)
                    values.append(serialized)
        
        # Logic for returning values:
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

def get_metadata_by_id(metadata_id: str) -> str:
    """
    Retrieves a specific metadata record by its UUID.
    Includes full hierarchy (children) and schema identification.
    Returns a JSON string.
    """
    system_log(f"[METADATA_LIB] Retrieving metadata by id: {metadata_id}", level="system")
    
    db = SessionLocal()
    try:
        m_uuid = uuid.UUID(metadata_id) if isinstance(metadata_id, str) else metadata_id
        
        record = (
            db.query(Record)
            .options(
                joinedload(Record.schema),
                selectinload(Record.children)
            )
            .filter(Record.id == m_uuid)
            .first()
        )
        
        if not record:
            system_log(f"[METADATA_LIB] Record not found: {metadata_id}", level="warning")
            return json.dumps(None)
            
        serialized = _serialize_record(record)
        return json.dumps(serialized, ensure_ascii=False)

    except Exception as e:
        system_log(f"[METADATA_LIB] Error retrieving metadata by id: {str(e)}", level="error")
        return json.dumps({"error": str(e)})
    finally:
        db.close()

def get_all_metadata(entity_type: str, entity_id: str) -> str:
    """
    Retrieves all metadata records assigned to a specific entity.
    Each record includes its full hierarchy (children) and schema identification.
    Returns a JSON string (list of hierarchical records).
    """
    system_log(f"[METADATA_LIB] Retrieving all metadata for entity_type: {entity_type}, entity_id: {entity_id}", level="system")
    
    db = SessionLocal()
    try:
        # Convert string ID to UUID if needed
        entity_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        
        # Query all meta_assignments for this entity
        assignments = (
            db.query(MetaAssignment)
            .options(
                joinedload(MetaAssignment.record).joinedload(Record.schema),
                joinedload(MetaAssignment.record).selectinload(Record.children)
            )
            .filter(
                MetaAssignment.entity_type == entity_type,
                MetaAssignment.entity_id == entity_uuid
            )
            .all()
        )
        
        results = []
        for assignment in assignments:
            if assignment.record:
                results.append(_serialize_record(assignment.record))
        
        json_result = json.dumps(results, ensure_ascii=False)
        system_log(f"[METADATA_LIB] Retrieved {len(results)} base records for entity {entity_id}", level="system")
        return json_result

    except Exception as e:
        system_log(f"[METADATA_LIB] Error retrieving all metadata: {str(e)}", level="error")
        return json.dumps({"error": str(e)})
    finally:
        db.close()

def get_all_client_metadata(client_id: str) -> str:
    """
    Shortcut to retrieve all metadata for a client by their ID.
    Returns a JSON string (list of hierarchical records).
    """
    return get_all_metadata("client", client_id)
