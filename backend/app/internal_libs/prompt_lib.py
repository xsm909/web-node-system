import uuid
from typing import Any, Dict, Optional
from ..core.database import SessionLocal
from ..models.prompt import Prompt
from .logger_lib import system_log

def add_prompt(
    entity_id: str,
    entity_type: str,
    category: str,
    content: Dict[str, Any],
    datatype: str,
    reference_id: Optional[str] = None
) -> str:
    """
    Adds a new prompt to the database.
    
    Args:
        entity_id: The ID of the owner entity (client, record, etc.)
        entity_type: The type of the owner entity (e.g., 'client', 'record')
        category: Category for the prompt (e.g., 'Common|Prompt')
        content: The actual prompt content as a dictionary
        datatype: The key of the schema (datatype)
        reference_id: Optional reference ID
        
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

        new_prompt = Prompt(
            entity_id=e_uuid,
            entity_type=entity_type,
            category=category,
            content=content,
            datatype=datatype,
            reference_id=ref_uuid
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
