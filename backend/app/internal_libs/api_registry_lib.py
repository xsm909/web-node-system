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
    Returns list of dicts with 'name' and 'value'.
    Merges schema parameters with default values from 'default_params'.
    """
    print(f"[API_REGISTRY] Fetching parameters for '{api_name}' -> '{function_name}'")
    db = SessionLocal()
    try:
        api_entry = db.query(ApiRegistryModel).filter(ApiRegistryModel.name == api_name).first()
        if not api_entry:
            return []
        
        functions = api_entry.functions or []
        if isinstance(functions, str):
            try:
                functions = json.loads(functions)
            except:
                functions = []
        
        # 0. Find the function definition (check 'name' and 'function_name')
        func_def = None
        for f in functions:
            f_id = f.get("name") or f.get("function_name")
            if f_id == function_name:
                func_def = f
                break
        
        # If still not found, check if it's an OpenAI style tool wrapper
        if not func_def:
            for f in functions:
                if f.get("type") == "function" and f.get("function", {}).get("name") == function_name:
                    func_def = f.get("function")
                    break
        
        if not func_def:
            print(f"[API_REGISTRY] ERROR: Function '{function_name}' not found for API '{api_name}'. Available: {[f.get('name') or f.get('function_name') for f in functions]}")
            return []
        
        # 1. Get default values mapping
        defaults_raw = func_def.get("default_params") or func_def.get("default_parameters") or {}
        defaults_map = {}
        if isinstance(defaults_raw, list):
            for d in defaults_raw:
                if isinstance(d, dict):
                    name = d.get("name") or d.get("key")
                    val = d.get("value")
                    if name:
                        defaults_map[name] = val
        elif isinstance(defaults_raw, dict):
            defaults_map = defaults_raw

        # 2. Extract base parameters from schema (check various aliases)
        params_data = (
            func_def.get("parameters") or 
            func_def.get("params") or 
            func_def.get("input_schema") or 
            func_def.get("input_parameters") or 
            []
        )
        
        result_params = []
        
        # If it's a JSON Schema object containing 'properties'
        if isinstance(params_data, dict):
            props = params_data.get("properties")
            
            # Nested OpenAI/Gemini support: if 'type' is 'function', look inside
            if not props and params_data.get("type") == "function" and "function" in params_data:
                props = params_data.get("function", {}).get("parameters", {}).get("properties")
            
            if props:
                for k, v in props.items():
                    # Priority: explicit default_params > schema example > schema default
                    val = defaults_map.get(k)
                    if val is None:
                        val = v.get("example") if v.get("example") is not None else v.get("default")
                    
                    result_params.append({
                        "name": k,
                        "value": val if val is not None else ""
                    })
                return result_params

            # If it's just a dict of {name: info}, convert to list
            for k, v in params_data.items():
                if k in ("type", "properties", "required"): continue # Skip schema metadata
                val = defaults_map.get(k)
                if val is None:
                    if isinstance(v, dict):
                        val = v.get("example") if v.get("example") is not None else v.get("default")
                        if val is None: val = v.get("value")
                    else:
                        val = v
                
                result_params.append({
                    "name": k,
                    "value": val if val is not None else ""
                })
            if result_params: return result_params
            
        # If it's already a list of objects
        if isinstance(params_data, list):
            for p in params_data:
                if isinstance(p, dict) and ("name" in p or "key" in p):
                    name = p.get("name") or p.get("key")
                    val = defaults_map.get(name)
                    if val is None:
                        val = p.get("example") if p.get("example") is not None else p.get("default")
                        if val is None: val = p.get("value")
                    
                    result_params.append({
                        "name": name,
                        "value": val if val is not None else ""
                    })
            return result_params
            
        return []
    finally:
        db.close()


def fill_parameters_by_default(params: dict) -> list:
    """
    Standard helper to populate node parameters from the API registry.
    This version is robust and handles multiple common aliases:
    - API: api_name, api, target_api
    - Function: function_name, api_function, function, api_method
    """
    # 1. Resolve API name
    api = params.get("api_name") or params.get("api") or params.get("target_api")
    
    # 2. Resolve Function name
    func = params.get("api_function") or params.get("function") or params.get("api_method") or params.get("api_function_name")
    
    if not api or not func:
        print(f"[API_REGISTRY] ERROR: Missing API name ('{api}') or Function name ('{func}') in params: {params}")
        return []
    
    print(f"[API_REGISTRY] Auto-fill triggered: API='{api}', FUNC='{func}'")
    return get_function_parameters(str(api), str(func))

