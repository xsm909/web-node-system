import json
from typing import Any, List, Optional, Dict
from ..core.database import SessionLocal
from ..models.agent_hint import AgentHint
from .logger_lib import system_log

def get_agent_hint_by_key(key: str) -> str:
    """
    Retrieves an agent hint (markdown) by its unique key.
    Returns the hint content as a string.
    If not found, returns an empty string.
    """
    system_log(f"[AGENT_HINTS_LIB] Retrieving hint for key: {key}", level="system")
    
    db = SessionLocal()
    try:
        hint_obj = db.query(AgentHint).filter(AgentHint.key == key).first()
        
        if not hint_obj:
            system_log(f"[AGENT_HINTS_LIB] Hint not found for key: {key}", level="warning")
            return ""
            
        return hint_obj.hint or ""

    except Exception as e:
        system_log(f"[AGENT_HINTS_LIB] Error retrieving hint by key '{key}': {str(e)}", level="error")
        return ""
    finally:
        db.close()
