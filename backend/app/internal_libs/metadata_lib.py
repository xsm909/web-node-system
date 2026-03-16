import json
import uuid
from typing import Any, List, Optional, Dict
from sqlalchemy.orm import joinedload, selectinload
from ..core.database import SessionLocal
from ..models.schema import Record, MetaAssignment, Schema
from .logger_lib import system_log

def _serialize_record(record: Record) -> Dict[str, Any]:
    """Helper to convert Record and its children to a hierarchical dictionary."""
    raw_data = record.data if record.data is not None else {}
    
    # If the data is not a dictionary (e.g., a list or basic type),
    # we wrap it or handle it so we can still attach metadata keys.
    if isinstance(raw_data, dict):
        data = raw_data.copy()
    else:
        # If it's a list or primitive, we provide it under a 'value' key
        # this prevents "list indices must be integers" error when attaching __schema__ etc.
        data = {"value": raw_data}
    
    # Identify schema and ID
    if record.schema:
        data["__schema__"] = record.schema.key
    data["__id__"] = str(record.id)
    data["__lock__"] = record.lock
    
    if record.children:
        data["children"] = [_serialize_record(child) for child in record.children]
    
    return data

def _find_records_by_schema_recursive(record: Record, schema_key: str, results: List[Dict[str, Any]]):
    """Recursively finds all records matching a schema key within a hierarchy."""
    if record.schema and record.schema.key == schema_key:
        results.append(_serialize_record(record))
    
    if record.children:
        for child in record.children:
            _find_records_by_schema_recursive(child, schema_key, results)

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
        
        if not values:
            result = None
        elif len(values) == 1:
            result = values[0]
        else:
            result = values
            
        system_log(f"[METADATA_LIB] Result for key '{key}': {result}", level="system")
        return result

    except Exception as e:
        system_log(f"[METADATA_LIB] Error retrieving metadata: {str(e)}", level="error")
        return {"error": str(e)}
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
            return None
            
        serialized = _serialize_record(record)
        return serialized

    except Exception as e:
        system_log(f"[METADATA_LIB] Error retrieving metadata by id: {str(e)}", level="error")
        return {"error": str(e)}
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
        
        system_log(f"[METADATA_LIB] Retrieved {len(results)} base records for entity {entity_id}", level="system")
        return results

    except Exception as e:
        system_log(f"[METADATA_LIB] Error retrieving all metadata: {str(e)}", level="error")
        return []
    finally:
        db.close()


def get_all_client_metadata(client_id: str) -> str:
    """
    Shortcut to retrieve all metadata for a client by their ID.
    Returns a JSON string (list of hierarchical records).
    """
    return get_all_metadata("client", client_id)

def get_metadata_by_schema(schema_key: str) -> str:
    """
    Retrieves all metadata records by schema key globally.
    Returns a JSON string (list of hierarchical records).
    """
    system_log(f"[METADATA_LIB] Retrieving metadata by schema_key: {schema_key}", level="system")
    
    db = SessionLocal()
    try:
        # Query records joined with schema and filtered by schema key
        records = (
            db.query(Record)
            .join(Schema)
            .options(
                joinedload(Record.schema),
                selectinload(Record.children)
            )
            .filter(Schema.key == schema_key)
            .all()
        )
        
        results = [_serialize_record(r) for r in records]
        
        system_log(f"[METADATA_LIB] Retrieved {len(results)} records for schema '{schema_key}'", level="system")
        return results

    except Exception as e:
        system_log(f"[METADATA_LIB] Error retrieving metadata by schema: {str(e)}", level="error")
        return []
    finally:
        db.close()

def get_client_metadata_by_schema(client_id: str, schema_key: str) -> str:
    """
    Retrieves metadata records for a specific client filtered by schema key.
    Recursively searches through assigned records and their children.
    Returns a JSON string (list of hierarchical records).
    """
    system_log(f"[METADATA_LIB] Hierarchical retrieval for client {client_id} by schema_key: {schema_key}", level="system")
    
    db = SessionLocal()
    try:
        # Convert string ID to UUID if needed
        client_uuid = uuid.UUID(client_id) if isinstance(client_id, str) else client_id
        
        # Query ALL assignments for this client
        assignments = (
            db.query(MetaAssignment)
            .options(
                joinedload(MetaAssignment.record).joinedload(Record.schema),
                joinedload(MetaAssignment.record).selectinload(Record.children)
            )
            .filter(
                MetaAssignment.entity_type == "client",
                MetaAssignment.entity_id == client_uuid
            )
            .all()
        )
        
        matches = []
        for assignment in assignments:
            if assignment.record:
                _find_records_by_schema_recursive(assignment.record, schema_key, matches)
        
        system_log(f"[METADATA_LIB] Found {len(matches)} matching records in hierarchy for client {client_id} and schema '{schema_key}'", level="system")
        return matches

    except Exception as e:
        system_log(f"[METADATA_LIB] Error in hierarchical client retrieval: {str(e)}", level="error")
        return []
    finally:
        db.close()

def get_owner_metadata_by_schema(owner_id: str, schema_key: str) -> str:
    """
    Retrieves metadata records for a specific owner filtered by schema key.
    Recursively searches through assigned records and their children.
    Returns a JSON string (list of hierarchical records).
    """
    system_log(f"[METADATA_LIB] Hierarchical retrieval for owner {owner_id} by schema_key: {schema_key}", level="system")
    
    db = SessionLocal()
    try:
        # Convert string ID to UUID if needed
        owner_uuid = uuid.UUID(owner_id) if isinstance(owner_id, str) else owner_id
        
        # Query ALL assignments for this owner
        assignments = (
            db.query(MetaAssignment)
            .options(
                joinedload(MetaAssignment.record).joinedload(Record.schema),
                joinedload(MetaAssignment.record).selectinload(Record.children)
            )
            .filter(MetaAssignment.owner_id == owner_uuid)
            .all()
        )
        
        matches = []
        for assignment in assignments:
            if assignment.record:
                _find_records_by_schema_recursive(assignment.record, schema_key, matches)
        
        system_log(f"[METADATA_LIB] Found {len(matches)} matching records in hierarchy for owner {owner_id} and schema '{schema_key}'", level="system")
        return matches

    except Exception as e:
        system_log(f"[METADATA_LIB] Error in hierarchical owner retrieval: {str(e)}", level="error")
        return []
    finally:
        db.close()
