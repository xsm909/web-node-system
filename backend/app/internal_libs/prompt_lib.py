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
    datatype: str
) -> str:
    """
    Adds a new prompt to the database.
    
    Args:
        entity_id: The ID of the owner entity (client, record, etc.)
        entity_type: The type of the owner entity (e.g., 'client', 'record')
        category: Category for the prompt (e.g., 'Common|Prompt')
        content: The actual prompt content as a dictionary
        datatype: The key of the schema (datatype)
        
    Returns:
        The ID of the newly created prompt as a string, or an error dictionary.
    """
    system_log(f"[PROMPT_LIB] Adding prompt for entity_id: {entity_id}, type: {entity_type}, category: {category}", level="system")
    
    db = SessionLocal()
    try:
        # Convert string ID to UUID
        e_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        
        new_prompt = Prompt(
            entity_id=e_uuid,
            entity_type=entity_type,
            category=category,
            content=content,
            datatype=datatype
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
