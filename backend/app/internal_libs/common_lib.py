import uuid
import re

from typing import Dict, Any
from ..core.database import SessionLocal
from ..models.workflow import WorkflowExecution
from ..models.user import User, RoleEnum
from .logger_lib import system_log
from .context_lib import execution_context
import json
from jsonschema import validate, ValidationError

def get_active_client() -> Dict[str, Any]:
    """
    Returns the ID and Name of the client (workflow owner) for the given execution.
    Refined logic:
    - Automatically resolves execution_id from context.
    - If workflow owner is a client, return them.
    - If workflow owner is manager/admin, return the client selected in frontend (if any).
    """
    execution_id = execution_context.get()
    system_log(f"[COMMON_LIB] Resolving active client for execution: {execution_id}", level="system")
    
    if not execution_id:
        return {"id": None, "name": "Unknown", "error": "No active execution context found"}

    db = SessionLocal()
    try:
        exec_uuid = uuid.UUID(execution_id) if isinstance(execution_id, str) else execution_id
        execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == exec_uuid).first()
        
        if not execution:
            return {"id": None, "name": "Unknown", "error": "Execution not found"}
            
        workflow = execution.workflow
        if not workflow:
            return {"id": None, "name": "Unknown", "error": "Workflow not found"}
            
        if workflow.owner_id != "common":
            if not workflow.owner:
                return {"id": None, "name": "Unknown", "error": "Owner not found"}
                
            owner = workflow.owner
            
            # 1. If owner is a direct client, return them
            if owner.role == RoleEnum.client:
                return {"id": str(owner.id), "name": owner.username}
                
        # 2. If owner is Manager/Admin or workflow is common, check context from frontend
        active_client_id = (execution.runtime_data or {}).get("_active_client_id")
        
        if active_client_id:
            client = db.query(User).filter(User.id == uuid.UUID(active_client_id)).first()
            if client:
                return {"id": str(client.id), "name": client.username}
        
        # 3. Fallback warning
        res = {
            "id": None, 
            "name": "No client selected", 
            "warning": "This is a common workflow and no client was selected in the sidebar."
        }
        system_log(f"[COMMON_LIB] Warning: {res['name']}", level="warning")
        return res

    except Exception as e:
        system_log(f"[COMMON_LIB] Error resolving active client: {str(e)}", level="error")
        return {"id": None, "name": "Error", "error": str(e)}
    finally:
        db.close()

def fill_template(template: str, data: dict) -> str:
    pattern = r"\{([a-zA-Z0-9_.]+)\}"

    def get_value(path, obj):
        keys = path.split(".")
        value = obj
        for k in keys:
            value = value.get(k)
            if value is None:
                return ""
        if isinstance(value, list):
            return ", ".join(map(str, value))
        return str(value)

    def replacer(match):
        key = match.group(1)
        return get_value(key, data)

    return re.sub(pattern, replacer, template)

def GetAIByModel(Model: str) -> str:
    """
    Returns the AI provider (Perplexity, Gemini, OpenAI) based on the model string.
    """
    model_lower = Model.lower()
    
    # Perplexity models
    if "sonar" in model_lower or "perplexity" in model_lower:
        return "Perplexity"
        
    # Gemini models
    elif "gemini" in model_lower or "google" in model_lower:
        return "Gemini"
        
    # OpenAI models
    # Grok models
    elif "grok" in model_lower:
        return "Grok"
        
    return "Unknown"


def is_valid_json(result_json: str, schema_json: str) -> bool:
    """
    Checks if a JSON string conforms to a given JSON schema (schema is also a JSON string).
    
    result_json: JSON string to validate
    schema_json: JSON string representing the JSON Schema
    """
    try:
        # Resolve data
        if isinstance(result_json, str):
            data = json.loads(result_json)
        else:
            data = result_json

        # Resolve schema
        if isinstance(schema_json, str):
            schema_data = json.loads(schema_json)
        else:
            schema_data = schema_json
    except json.JSONDecodeError:
        return False  # invalid JSON or invalid schema

    try:
        # Validate against the schema
        validate(instance=data, schema=schema_data)
        return True
    except ValidationError:
        return False