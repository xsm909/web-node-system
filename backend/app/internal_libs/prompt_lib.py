import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from ..core.database import SessionLocal
from ..models.prompt import Prompt
from .logger_lib import system_log
from .projects_lib import get_project_id

def _make_serializable(data: Any) -> Any:
    """Recursively converts objects to JSON-serializable types."""
    if isinstance(data, dict):
        return {str(k): _make_serializable(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_make_serializable(i) for i in data]
    elif isinstance(data, (str, int, float, bool, type(None))):
        return data
    elif isinstance(data, uuid.UUID):
        return str(data)
    else:
        # Handle complex objects like SDK responses or Pydantic models
        if hasattr(data, "model_dump"):
            return _make_serializable(data.model_dump())
        elif hasattr(data, "dict") and callable(getattr(data, "dict")):
            return _make_serializable(data.dict())
        try:
            # Try to catch anything that might have a to_dict or similar
            if hasattr(data, "__dict__"):
                return _make_serializable(data.__dict__)
            return str(data)
        except:
            return str(data)

def add_prompt(
    entity_id: str,
    entity_type: str,
    category: str,
    content: Dict[str, Any],
    datatype: str,
    reference_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    raw: Optional[str] = None
) -> str:
    """
    Adds a new prompt to the database.
    
    Args:
        entity_id: The ID of the owner entity (client, record, etc.)
        entity_type: The type of the owner entity (e.g., 'users', 'records')
        category: Category for the prompt (e.g., 'Common|Prompt')
        content: The actual prompt content as a dictionary
        datatype: The key of the schema (datatype)
        reference_id: Optional reference ID
        meta: Optional technical metadata
        raw: Optional raw text version of the prompt
        
    Returns:
        The ID of the newly created prompt as a string, or an error dictionary.
    """
    system_log(f"[PROMPT_LIB] Adding prompt for entity_id: {entity_id}, type: {entity_type}, category: {category}, reference_id: {reference_id}", level="system")
    
    db = SessionLocal()
    try:
        # Convert string ID to UUID
        e_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        
        # Convert reference_id to UUID if provided
        ref_uuid = None
        if reference_id:
            ref_uuid = uuid.UUID(reference_id) if isinstance(reference_id, str) else reference_id

        # Ensure content and meta are JSON-serializable
        serializable_content = _make_serializable(content)
        serializable_meta = _make_serializable(meta) if meta else None
        
        # Handle raw field serialization
        serializable_raw = raw
        if raw is not None and not isinstance(raw, str):
            serializable_raw = _make_serializable(raw)
            if not isinstance(serializable_raw, str):
                import json
                serializable_raw = json.dumps(serializable_raw, ensure_ascii=False)

        new_prompt = Prompt(
            project_id=get_project_id(),
            entity_id=e_uuid,
            entity_type=entity_type,
            category=category,
            content=serializable_content,
            datatype=datatype,
            reference_id=ref_uuid,
            meta=serializable_meta,
            raw=serializable_raw
        )
        
        db.add(new_prompt)
        db.commit()
        db.refresh(new_prompt)
        
        system_log(f"[PROMPT_LIB] Successfully added prompt with ID: {new_prompt.id}", level="system")
        return str(new_prompt.id)

    except Exception as e:
        db.rollback()
        system_log(f"[PROMPT_LIB] Error adding prompt: {str(e)}", level="error")
        return {"error": str(e)}
    finally:
        db.close()

def get_prompts_by_category_with_reference_id(category: str, reference_id: str) -> list:
    """
    Retrieves prompts by category and reference_id.
    
    Args:
        category: The category of prompts to retrieve.
        reference_id: The reference ID to filter by.
        
    Returns:
        A list of prompt dictionaries.
    """
    db = SessionLocal()
    try:
        ref_uuid = uuid.UUID(reference_id) if isinstance(reference_id, str) else reference_id
        prompts = db.query(Prompt).filter(
            Prompt.project_id == get_project_id(),
            Prompt.category == category,
            Prompt.reference_id == ref_uuid
        ).all()
        
        return [
            {
                "id": str(p.id),
                "entity_id": str(p.entity_id),
                "entity_type": p.entity_type,
                "content": p.content,
                "category": p.category,
                "datatype": p.datatype,
                "reference_id": str(p.reference_id) if p.reference_id else None,
                "meta": p.meta,
                "raw": p.raw,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None
            }
            for p in prompts
        ]
    except Exception as e:
        system_log(f"[PROMPT_LIB] Error getting prompts by category and reference_id: {str(e)}", level="error")
        return []
    finally:
        db.close()

def get_prompts_by_category_with_id(category: str, entity_id: str) -> list:
    """
    Retrieves prompts by category and entity_id.
    
    Args:
        category: The category of prompts to retrieve.
        entity_id: The entity ID to filter by.
        
    Returns:
        A list of prompt dictionaries.
    """
    db = SessionLocal()
    try:
        e_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        prompts = db.query(Prompt).filter(
            Prompt.project_id == get_project_id(),
            Prompt.category == category,
            Prompt.entity_id == e_uuid
        ).all()
        
        return [
            {
                "id": str(p.id),
                "entity_id": str(p.entity_id),
                "entity_type": p.entity_type,
                "content": p.content,
                "category": p.category,
                "datatype": p.datatype,
                "reference_id": str(p.reference_id) if p.reference_id else None,
                "meta": p.meta,
                "raw": p.raw,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None
            }
            for p in prompts
        ]
    except Exception as e:
        system_log(f"[PROMPT_LIB] Error getting prompts by category and entity_id: {str(e)}", level="error")
        return []
    finally:
        db.close()

def delete_prompts_by_period_and_entity(
    entity_id: Union[str, uuid.UUID],
    category: str,
    data_start: Union[str, datetime],
    data_end: Union[str, datetime]
) -> Dict[str, Any]:
    """
    Deletes all records from the 'prompts' table for a specific entity_id and category
    within a given date period (created_at).

    Args:
        entity_id: The ID of the owner entity (client, record, etc.).
        category: Category for the prompt (e.g., 'Common|Prompt').
        data_start: Start of the period (inclusive).
        data_end: End of the period (inclusive).

    Returns:
        A dictionary with the status of the operation and the count of deleted records.
    """
    if not all([entity_id, category, data_start, data_end]):
        system_log("[PROMPT_LIB] Skipping delete_prompts_by_period_and_entity: All fields are mandatory", level="warning")
        return {"status": "error", "message": "All fields (entity_id, category, data_start, data_end) are mandatory"}

    system_log(
        f"[PROMPT_LIB] Deleting prompts for entity_id: {entity_id}, category: {category}, "
        f"period: {data_start} to {data_end}",
        level="system"
    )

    db = SessionLocal()
    try:
        # Convert string ID to UUID
        e_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        
        # Parse dates if they are strings
        if isinstance(data_start, str):
            data_start = datetime.fromisoformat(data_start.replace('Z', '+00:00'))
        if isinstance(data_end, str):
            data_end = datetime.fromisoformat(data_end.replace('Z', '+00:00'))

        # Perform deletion
        delete_query = db.query(Prompt).filter(
            Prompt.project_id == get_project_id(),
            Prompt.entity_id == e_uuid,
            Prompt.category == category,
            Prompt.created_at >= data_start,
            Prompt.created_at <= data_end
        )

        count = delete_query.count()
        delete_query.delete(synchronize_session=False)
        db.commit()

        system_log(f"[PROMPT_LIB] Successfully deleted {count} prompts", level="system")
        result = {
            "status": "success",
            "deleted_count": count
        }

    except Exception as e:
        db.rollback()
        system_log(f"[PROMPT_LIB] Error deleting prompts: {str(e)}", level="error")
        result = {
            "status": "error",
            "message": str(e)
        }
    finally:
        db.close()
    
    return result

def delete_prompts_by_period_and_reference_id(
    reference_id: Union[str, uuid.UUID],
    category: str,
    data_start: Union[str, datetime],
    data_end: Union[str, datetime]
) -> Dict[str, Any]:
    """
    Deletes all records from the 'prompts' table for a specific reference_id and category
    within a given date period (created_at).

    Args:
        reference_id: The ID of the reference (e.g., conversation ID, script ID, etc.).
        category: Category for the prompt (e.g., 'Common|Prompt').
        data_start: Start of the period (inclusive).
        data_end: End of the period (inclusive).

    Returns:
        A dictionary with the status of the operation and the count of deleted records.
    """
    if not all([reference_id, category, data_start, data_end]):
        system_log("[PROMPT_LIB] Skipping delete_prompts_by_period_and_reference_id: All fields are mandatory", level="warning")
        return {"status": "error", "message": "All fields (reference_id, category, data_start, data_end) are mandatory"}

    system_log(
        f"[PROMPT_LIB] Deleting prompts for reference_id: {reference_id}, category: {category}, "
        f"period: {data_start} to {data_end}",
        level="system"
    )

    db = SessionLocal()
    try:
        # Convert string ID to UUID
        r_uuid = uuid.UUID(reference_id) if isinstance(reference_id, str) else reference_id
        
        # Parse dates if they are strings
        if isinstance(data_start, str):
            data_start = datetime.fromisoformat(data_start.replace('Z', '+00:00'))
        if isinstance(data_end, str):
            data_end = datetime.fromisoformat(data_end.replace('Z', '+00:00'))

        # Perform deletion
        delete_query = db.query(Prompt).filter(
            Prompt.project_id == get_project_id(),
            Prompt.reference_id == r_uuid,
            Prompt.category == category,
            Prompt.created_at >= data_start,
            Prompt.created_at <= data_end
        )

        count = delete_query.count()
        delete_query.delete(synchronize_session=False)
        db.commit()

        system_log(f"[PROMPT_LIB] Successfully deleted {count} prompts", level="system")
        result = {
            "status": "success",
            "deleted_count": count
        }

    except Exception as e:
        db.rollback()
        system_log(f"[PROMPT_LIB] Error deleting prompts: {str(e)}", level="error")
        result = {
            "status": "error",
            "message": str(e)
        }
    finally:
        db.close()
    
    return result
