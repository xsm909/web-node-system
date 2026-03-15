import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from ..core.database import SessionLocal
from ..models.response import Response
from .logger_lib import system_log

def clear_recent_records_by_entity_and_category(
    entity_id: Union[str, uuid.UUID],
    category: str,
    n_days: int
) -> Dict[str, Any]:
    """
    Deletes records from the 'response' table that are newer than n_days,
    match the given entity_id and category.

    Args:
        entity_id: The ID of the entity (UUID or string).
        category: The category string to match.
        n_days: The number of days. Records created newer than (now - n_days) will be deleted.

    Returns:
        A dictionary with the status and the number of deleted records.
    """
    system_log(
        f"[RESPONSE_LIB] Clearing records for entity_id: {entity_id}, "
        f"category: {category}, n_days: {n_days}",
        level="system"
    )

    db = SessionLocal()
    try:
        # Convert string ID to UUID if necessary
        e_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        
        # Calculate cutoff date
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=n_days)
        
        # Perform deletion
        delete_query = db.query(Response).filter(
            Response.entity_id == e_uuid,
            Response.category == category,
            Response.created_at >= cutoff_date
        )
        
        count = delete_query.count()
        delete_query.delete(synchronize_session=False)
        
        db.commit()
        
        system_log(
            f"[RESPONSE_LIB] Successfully deleted {count} records",
            level="system"
        )
        
        return {
            "status": "success",
            "deleted_count": count
        }

    except Exception as e:
        db.rollback()
        system_log(
            f"[RESPONSE_LIB] Error clearing records: {str(e)}",
            level="error"
        )
        return {
            "status": "error",
            "message": str(e)
        }
    finally:
        db.close()

def add_response(
    entity_id: Union[str, uuid.UUID],
    entity_type: str,
    category: str,
    context: Dict[str, Any],
    context_type: str,
    reference_id: Optional[Union[str, uuid.UUID]] = None,
    reference_type: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    raw: Optional[str] = None
) -> Union[str, Dict[str, Any]]:
    """
    Adds a new record to the 'response' table.

    Args:
        entity_id: The ID of the owner entity (UUID or string).
        entity_type: The type of the owner entity (e.g., 'client').
        category: Category for the record (e.g., 'Common|Summary').
        context: The actual content as a dictionary.
        context_type: The type of context.
        reference_id: Optional reference ID.
        reference_type: Optional reference type.
        meta: Optional metadata dictionary.

    Returns:
        The ID of the newly created record as a string, or an error dictionary.
    """
    system_log(
        f"[RESPONSE_LIB] Adding record for entity_id: {entity_id}, "
        f"type: {entity_type}, category: {category}",
        level="system"
    )

    db = SessionLocal()
    try:
        # Resolve UUIDs
        e_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        
        ref_uuid = None
        if reference_id:
            ref_uuid = uuid.UUID(reference_id) if isinstance(reference_id, str) else reference_id

        # Ensure raw is a string (TEXT column)
        if raw is not None and not isinstance(raw, str):
            raw = str(raw)

        new_record = Response(
            entity_id=e_uuid,
            entity_type=entity_type,
            category=category,
            context=context,
            context_type=context_type,
            reference_id=ref_uuid,
            reference_type=reference_type,
            meta=meta,
            raw=raw
        )

        db.add(new_record)
        db.commit()
        db.refresh(new_record)

        system_log(
            f"[RESPONSE_LIB] Successfully added record with ID: {new_record.id}",
            level="system"
        )
        
        return str(new_record.id)

    except Exception as e:
        db.rollback()
        system_log(
            f"[RESPONSE_LIB] Error adding record: {str(e)}",
            level="error"
        )
        return {
            "status": "error",
            "message": str(e)
        }
    finally:
        db.close()

def update_response_meta(
    record_id: Union[str, uuid.UUID],
    meta: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Updates the 'meta' field of a record in the 'response' table.

    Args:
        record_id: The ID of the record (UUID or string).
        meta: The new metadata dictionary.

    Returns:
        A dictionary with the status of the operation.
    """
    system_log(
        f"[RESPONSE_LIB] Updating meta for record_id: {record_id}",
        level="system"
    )

    db = SessionLocal()
    try:
        # Resolve UUID
        r_uuid = uuid.UUID(record_id) if isinstance(record_id, str) else record_id

        # Fetch record
        record = db.query(Response).filter(Response.id == r_uuid).first()
        
        if not record:
            system_log(
                f"[RESPONSE_LIB] Record not found: {record_id}",
                level="error"
            )
            return {
                "status": "error",
                "message": f"Record {record_id} not found"
            }

        # Update meta
        record.meta = meta
        
        db.commit()

        system_log(
            f"[RESPONSE_LIB] Successfully updated meta for record: {record_id}",
            level="system"
        )
        
        return {
            "status": "success"
        }

    except Exception as e:
        db.rollback()
        system_log(
            f"[RESPONSE_LIB] Error updating meta: {str(e)}",
            level="error"
        )
        return {
            "status": "error",
            "message": str(e)
        }
    finally:
        db.close()
