import json
import urllib.request
import urllib.error
import urllib.parse
from sqlalchemy.orm import Session
from ..core.database import SessionLocal
from ..models.api_registry import ApiRegistry as ApiRegistryModel
from .logger_lib import system_log

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
        headers = {}
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
        data = None
        if method in ("GET", "DELETE"):
            if params:
                query_params.update(params)
        else:
            if params:
                data = json.dumps(params).encode("utf-8")
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
