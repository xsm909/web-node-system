import json
import urllib.request
import urllib.error
import urllib.parse
from sqlalchemy.orm import Session
from ..core.database import SessionLocal
from ..models.api_registry import ApiRegistry as ApiRegistryModel
from .logger_lib import system_log

DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

def call_api_function(api_name: str, function_name: str, params: dict = None) -> any:
    """
    Core engine to call a function from the registered external APIs.
    """
    system_log(f"[API_REGISTRY] Calling {api_name}/{function_name} with params={params}", level="system")
    db = SessionLocal()
    try:
        # 1. Resolve API entry
        api_entry = db.query(ApiRegistryModel).filter(ApiRegistryModel.name == api_name).first()
        if not api_entry:
            res = f"Error: API '{api_name}' not found in registry."
            system_log(f"[API_REGISTRY] {res}", level="error")
            return {"error": res}

        # 2. Find function definition
        functions = api_entry.functions or []
        func_def = next((f for f in functions if f.get("name") == function_name), None)
        
        # If not found in functions list, we might allow direct path if the user wants,
        # but for now let's stick to the mapping.
        if not func_def:
            res = f"Error: Function '{function_name}' not found for API '{api_name}'."
            system_log(f"[API_REGISTRY] {res}", level="error")
            return {"error": res}

        method = func_def.get("method", "GET").upper()
        path = func_def.get("path", "")
        
        # Construct full URL
        base_url = api_entry.base_url.rstrip("/")
        full_url = f"{base_url}/{path.lstrip('/')}"
        
        # 3. Handle Authentication via Credentials
        headers = {
            "User-Agent": DEFAULT_USER_AGENT
        }
        query_params = {}
        
        if api_entry.credential_key:
            from ..models.credential import Credential
            cred = db.query(Credential).filter(Credential.key == api_entry.credential_key).first()
            if cred:
                auth_type = cred.auth_type or "header"
                if auth_type == "header":
                    headers["X-API-Key"] = cred.value
                elif auth_type == "query":
                    query_params["api_key"] = cred.value
            else:
                system_log(f"[API_REGISTRY] Warning: Credential '{api_entry.credential_key}' not found.", level="error")

        # 4. Handle Parameters (Body for POST/PUT, Query for GET)
        # Merge with default parameters from function definition
        default_params = func_def.get("default_params", {})
        # Convert list format if needed (if stored as [{key, value}, ...])
        if isinstance(default_params, list):
            default_params = {p["key"]: p["value"] for p in default_params if "key" in p and "value" in p}
        
        merged_params = {**default_params, **(params or {})}

        data = None
        if method in ("GET", "DELETE"):
            if merged_params:
                query_params.update(merged_params)
        else:
            if merged_params:
                data = json.dumps(merged_params).encode("utf-8")
                headers["Content-Type"] = "application/json"

        # Append query params to URL
        if query_params:
            url_parts = list(urllib.parse.urlparse(full_url))
            existing_query = urllib.parse.parse_qs(url_parts[4])
            # Merge existing query params if any
            for k, v in query_params.items():
                existing_query[k] = v
            url_parts[4] = urllib.parse.urlencode(existing_query, doseq=True)
            full_url = urllib.parse.urlunparse(url_parts)

        # 5. Perform Request
        req = urllib.request.Request(full_url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as response:
                resp_data = response.read().decode("utf-8")
                try:
                    return json.loads(resp_data)
                except:
                    return resp_data
        except urllib.error.HTTPError as e:
            res = f"HTTP Error {e.code}: {e.read().decode('utf-8')}"
            system_log(f"[API_REGISTRY] {res}", level="error")
            return {"error": res}
        except Exception as e:
            res = f"Connection error: {str(e)}"
            system_log(f"[API_REGISTRY] {res}", level="error")
            return {"error": res}

    finally:
        db.close()

def get_agent_tool_definitions(tool_identifiers: list[dict]) -> list[dict]:
    """
    Resolves a list of tool identifiers into OpenAI-compatible tool definitions.
    Identifier format: {"tool": "api_name"} or {"tool": "api_name:function_name"}
    """
    if not tool_identifiers or not isinstance(tool_identifiers, list):
        return []
        
    db = SessionLocal()
    definitions = []
    try:
        for item in tool_identifiers:
            tool_id = item.get("tool", "")
            if not tool_id:
                continue
            
            parts = tool_id.split(":")
            api_name = parts[0]
            target_func = parts[1] if len(parts) > 1 else None
            
            api_entry = db.query(ApiRegistryModel).filter(ApiRegistryModel.name == api_name).first()
            if not api_entry:
                continue
            
            functions = api_entry.functions or []
            for func in functions:
                f_name = func.get("name")
                if not f_name:
                    continue
                
                # If specific function requested, skip others
                if target_func and f_name != target_func:
                    continue
                
                # Format as OpenAI tool
                # We use double underscore to separate api and function in the tool name
                # as OpenAI tools usually prefer snake_case and no special chars like :
                tool_name = f"{api_name}__{f_name}"
                
                # Parameters schema (default to empty object if not provided)
                parameters = func.get("parameters")
                if not parameters or not isinstance(parameters, dict):
                    parameters = {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }

                definitions.append({
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "description": func.get("description") or f"Call {f_name} from {api_name} API.",
                        "parameters": parameters
                    }
                })
        return definitions
    finally:
        db.close()

def resolve_and_call_api(tool_name: str, params: dict) -> any:
    """
    Parses a tool name in the format 'api__function' and executes it.
    """
    if "__" not in tool_name:
        return f"Error: Invalid tool name format '{tool_name}'. Expected 'api__function'."
    
    api_name, function_name = tool_name.split("__", 1)
    return call_api_function(api_name, function_name, params)


def get_function_parameters(api_name: str, function_name: str) -> list:
    """
    Returns the parameter definitions for a specific function in the API registry.
    Returns list of dicts with 'name' and 'value' (from example).
    """
    db = SessionLocal()
    try:
        api_entry = db.query(ApiRegistryModel).filter(ApiRegistryModel.name == api_name).first()
        if not api_entry:
            return []
        
        functions = api_entry.functions or []
        # Support both parsed JSON (dict/list) and raw JSON (string)
        if isinstance(functions, str):
            try:
                functions = json.loads(functions)
            except:
                functions = []
        
        func_def = next((f for f in functions if f.get("name") == function_name), None)
        if not func_def:
            return []
        
        # Try both 'parameters' (OpenAI style) and 'params' (internal style)
        params_data = func_def.get("parameters") or func_def.get("params") or []
        
        # If it's the OpenAI schema object, parameters are in ['properties']
        if isinstance(params_data, dict) and "properties" in params_data:
            props = params_data.get("properties", {})
            return [{"name": k, "value": v.get("example") or v.get("default")} for k, v in props.items()]
            
        # If it's a dict of {name: info}, convert to list
        if isinstance(params_data, dict):
            params_list = []
            for k, v in params_data.items():
                if isinstance(v, dict):
                    params_list.append({"name": k, "value": v.get("example") or v.get("default") or v.get("value")})
                else:
                    params_list.append({"name": k, "value": v})
            return params_list
            
        # If it's already a list of objects
        if isinstance(params_data, list):
            return [{"name": p.get("name"), "value": p.get("example") or p.get("default") or p.get("value")} for p in params_data if isinstance(p, dict) and "name" in p]
            
        return []
    finally:
        db.close()

