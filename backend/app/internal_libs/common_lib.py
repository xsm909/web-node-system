import uuid
import re
import json
from typing import Dict, Any, Optional, Tuple
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

def resolve_ai_config(model_name: str) -> Dict[str, Any]:
    """
    Finds the AI provider for a Given model and resolves its configuration (API Key, Base URL).
    Returns a dictionary with:
        - provider_key: str
        - api_key: str
        - base_url: Optional[str]
    """
    db = SessionLocal()
    try:
        from ..models.ai_provider import AiProvider
        from .credentials import get_credential_by_key
        from .logger_lib import system_log
        
        # 1. Search for a provider that has this model in its models list
        all_providers = db.query(AiProvider).all()
        system_log(f"[RESOLVE_AI] Found {len(all_providers)} providers in DB", level="system")
        
        target_provider = None
        model_config = None
        
        for provider in all_providers:
            models_data = provider.models or {}
            # If models_data is a string, parse it
            if isinstance(models_data, str):
                try: models_data = json.loads(models_data)
                except: models_data = {}
            
            models_list = models_data.get("models", [])
            system_log(f"[RESOLVE_AI] Checking provider '{provider.key}' with models: {models_list}", level="system")
            
            for m in models_list:
                # Handle both string ["gpt-4"] and object [{"name": "gpt-4", "base_url": "..."}] formats
                m_name = m["name"] if isinstance(m, dict) else m
                if str(m_name).lower() == str(model_name).lower():
                    target_provider = provider
                    if isinstance(m, dict):
                        model_config = m
                    system_log(f"[RESOLVE_AI] MATCH FOUND! Provider: {provider.key}, Model: {m_name}", level="system")
                    break
            if target_provider:
                break
        
        if not target_provider:
            # Fallback to keyword-based provider detection if not found in DB
            provider_key = GetAIByModel(model_name)
            # Try to find a provider by key
            target_provider = db.query(AiProvider).filter(AiProvider.key.ilike(provider_key)).first()
            
        if target_provider:
            # Resolve API Key from Credential Registry
            api_key = get_credential_by_key(target_provider.api_key) if target_provider.api_key else None
            
            # Resolve Base URL (Priority: Model Override > Provider Base URL > None)
            base_url = None
            if model_config and model_config.get("base_url"):
                base_url = model_config.get("base_url")
            elif target_provider.base_url:
                base_url = target_provider.base_url
                
            return {
                "provider_key": target_provider.key.lower(),
                "api_key": api_key,
                "base_url": base_url
            }
            
        return {
            "provider_key": "unknown",
            "api_key": None,
            "base_url": None
        }
    finally:
        db.close()

def GetAIByModel(Model: str) -> str:
    """
    Returns the AI provider (Perplexity, Gemini, OpenAI) based on the model string.
    """
    model_lower = Model.lower()
    
    # Perplexity models
    if any(x in model_lower for x in ["sonar", "perplexity"]):
        return "Perplexity"
        
    # Gemini models
    elif any(x in model_lower for x in ["gemini", "google"]):
        return "Gemini"
        
    # OpenAI models
    elif any(x in model_lower for x in ["gpt", "openai"]):
        return "OpenAI"
        
    # Grok models
    elif "grok" in model_lower:
        return "Grok"
        
    # DeepSeek models
    elif "deepseek" in model_lower:
        return "DeepSeek"
        
    # Groq models
    elif any(x in model_lower for x in ["groq", "llama", "mixtral", "gemma"]):
        return "Groq"
        
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

def safe_json_dumps(obj: Any) -> str:
    """
    Safely serializes an object to JSON, handling bytes and other non-serializable objects.
    """
    def handler(o):
        if hasattr(o, 'model_dump'):
            return o.model_dump()
        if hasattr(o, 'dict'):
            return o.dict()
        if isinstance(o, bytes):
            return f"<binary: {len(o)} bytes>"
        # Handle decimal, datetime etc if needed
        import datetime
        if isinstance(o, (datetime.datetime, datetime.date)):
            return o.isoformat()
        try:
            return str(o)
        except:
            return repr(o)
            
    return json.dumps(obj, default=handler, ensure_ascii=False)