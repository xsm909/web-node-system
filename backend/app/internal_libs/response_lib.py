import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from ..core.database import SessionLocal
from ..models.response import Response
from .logger_lib import system_log

def clear_recent_records_by_entity_and_category(
    reference_id: Union[str, uuid.UUID],
    entity_id: Union[str, uuid.UUID],
    category: str,
    n_days: int
) -> Dict[str, Any]:
    """
    Clears records from the 'response' table within an 'update window' (the last n_days).
    This allows for re-executing a workflow and updating/overwriting recent results 
    without creating duplicates. Once records are older than n_days, they are preserved 
    as part of the historical record (snapshots).

    Logic:
    - If now=Day 31 and n_days=30, records from Day 1 (30 days ago) are STILL in the window 
      and will be cleared.
    - Records from Day 0 (31 days ago) are OUTSIDE the window and are preserved.

    Args:
        entity_id: The ID of the entity (UUID or string).
        category: The category string to match.
        n_days: The window in days. Records created newer than or equal to (now - n_days) will be deleted.
    """
    if not reference_id:
        system_log("[RESPONSE_LIB] Skipping clear_recent_records: reference_id is missing", level="warning")
        return {"status": "skipped", "message": "reference_id is mandatory"}

    system_log(
        f"[RESPONSE_LIB] Clearing records for reference_id: {reference_id}, entity_id: {entity_id}, "
        f"category: {category}, n_days: {n_days}",
        level="system"
    )

    db = SessionLocal()
    try:
        # Convert string IDs to UUID if necessary
        e_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        ref_uuid = uuid.UUID(reference_id) if isinstance(reference_id, str) else reference_id
        
        # Calculate cutoff date
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=n_days)
        
        # Perform deletion
        delete_query = db.query(Response).filter(
            Response.reference_id == ref_uuid,
            Response.entity_id == e_uuid,
            Response.category == category,
            Response.created_at >= cutoff_date
        )

        
        count = delete_query.count()
        delete_query.delete(synchronize_session=False)
        
        db.commit()
        
        system_log(
            f"[RESPONSE_LIB] Successfully cleared {count} records in the {n_days}-day update window "
            f"for entity {entity_id} (category: {category})",
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
    reference_id: Union[str, uuid.UUID],
    entity_id: Union[str, uuid.UUID],
    entity_type: str,
    category: str,
    context: Dict[str, Any],
    context_type: str,
    reference_type: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    raw: Optional[str] = None
) -> Union[str, Dict[str, Any]]:
    """
    Adds a new record to the 'response' table.

    Args:
        reference_id: Mandatory reference ID (usually client ID).
        entity_id: The ID of the owner entity (UUID or string).
        entity_type: The type of the owner entity (e.g., 'client').
        category: Category for the record (e.g., 'Common|Summary').
        context: The actual content as a dictionary.
        context_type: The type of context.
        reference_type: Optional reference type.
        meta: Optional metadata dictionary.
        raw: Optional raw output.

    Returns:
        The ID of the newly created record as a string, or an error dictionary.
    """
    if not reference_id:
        system_log("[RESPONSE_LIB] Skipping add_response: reference_id is missing", level="warning")
        return {"status": "skipped", "message": "reference_id is mandatory"}

    system_log(
        f"[RESPONSE_LIB] Adding record for entity_id: {entity_id}, "
        f"type: {entity_type}, category: {category} (ref: {reference_id})",
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
        record = db.query(Response).filter(
            Response.id == r_uuid
        ).first()
        
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

from typing import Any, Dict, List, Optional, Union

def get_responses_by_period_and_category(
    reference_id: Union[str, uuid.UUID],
    category_pattern: str,
    start_date: Union[str, datetime],
    end_date: Union[str, datetime],
    entity_id: Optional[Union[str, uuid.UUID]] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves records from the 'response' table within a date range and matching a category pattern.

    Args:
        category_pattern: SQL LIKE pattern for category (e.g., 'Recommendation|%').
        start_date: Start of the period (inclusive).
        end_date: End of the period (inclusive).
        entity_id: Optional entity ID to filter by.
        reference_id: Mandatory reference ID to filter by.

    Returns:
        A list of dictionaries representing the records.
    """
    if not reference_id:
        system_log("[RESPONSE_LIB] Skipping get_responses: reference_id is missing", level="warning")
        return []

    system_log(
        f"[RESPONSE_LIB] Retrieving records for pattern: {category_pattern}, "
        f"period: {start_date} to {end_date} (ref: {reference_id})",
        level="system"
    )

    db = SessionLocal()
    try:
        # Parse dates if they are strings
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

        query = db.query(Response).filter(
            Response.category.like(category_pattern),
            Response.created_at >= start_date,
            Response.created_at <= end_date
        )

        if entity_id:
            e_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
            query = query.filter(Response.entity_id == e_uuid)
            
        ref_uuid = uuid.UUID(reference_id) if isinstance(reference_id, str) else reference_id
        query = query.filter(Response.reference_id == ref_uuid)

        # Order by creation date
        query = query.order_by(Response.created_at.asc())
        
        records = query.all()
        
        # Convert to dictionary format
        results = []
        for r in records:
            results.append({
                "id": str(r.id),
                "entity_id": str(r.entity_id),
                "entity_type": r.entity_type,
                "category": r.category,
                "context": r.context,
                "context_type": r.context_type,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "meta": r.meta,
                "reference_id": str(r.reference_id) if r.reference_id else None,
                "reference_type": r.reference_type
            })

        return results

    except Exception as e:
        system_log(
            f"[RESPONSE_LIB] Error retrieving records: {str(e)}",
            level="error"
        )
        return []
    finally:
        db.close()

