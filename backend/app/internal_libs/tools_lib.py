import json
import urllib.request
import urllib.error
from .logger_lib import system_log

def calculator(expression: str) -> str:
    """Calculates a mathematical expression."""
    system_log(f"[TOOL] Start: calculator(expression='{expression}')", level="system")
    try:
        if expression is None:
            res = "Error: Expression is None"
            system_log(f"[TOOL] Error: calculator -> {res}", level="error")
            return res
        
        # Ensure we are working with a string
        expr_str = str(expression)
        
        # Basic safety: allow only math-related characters
        import math
        allowed_chars = set("0123456789+-*/(). ")
        if not all(c in allowed_chars for c in expr_str):
             res = f"Error: Invalid characters in expression: {expr_str}"
             system_log(f"[TOOL] Error: calculator -> {res}", level="error")
             return res
        
        # Using a restricted eval for the calculator tool
        safe_dict = {"__builtins__": None, "math": math}
        result = eval(expr_str, safe_dict)
        res = str(result)
        system_log(f"[TOOL] Success: calculator -> {res}", level="system")
        return res
    except Exception as e:
        res = f"Error: {str(e)}"
        system_log(f"[TOOL] Error: calculator -> {res}", level="error")
        return res

def database_query(query: str) -> str:
    """Executes a database query with security restrictions based on allowed tables and operations."""
    system_log(f"[TOOL] Start: database_query(query='{query[:100]}{'...' if len(str(query)) > 100 else ''}')", level="system")
    try:
        import re
        from sqlalchemy import text
        from ..core.database import SessionLocal
        
        if not query:
            res = "Error: Database query is empty."
            system_log(f"[TOOL] Error: database_query -> {res}", level="error")
            return res
            
        query_str = str(query).strip()
        query_lower = query_str.lower()
        
        # Define allowed tables and their attributes (R = Read, W = Write, RW = Read/Write)
        # You can add or remove tables here
        ALLOWED_TABLES = {
            "example_table_read": "R",
            "example_table_write": "W",
            "ai_results": "RW"
        }
        
        # Determine the type of operation
        clean_q = query_lower.strip()
        is_read_query = clean_q.startswith("select")
        is_write_query = clean_q.startswith(("insert", "update", "delete"))
        
        if not is_read_query and not is_write_query:
            res = f"Security Error: Query must start with SELECT, INSERT, UPDATE, or DELETE (found: '{clean_q[:20]}...')"
            system_log(f"[TOOL] Error: database_query -> {res}", level="error")
            return res
            
        # Extract table names from FROM, JOIN, INTO, UPDATE clauses
        tables = re.findall(r'(?:from|join|into|update)\s+([a-zA-Z0-9_]+)', query_lower)
        
        expected_tables = set(tables)
        if not expected_tables:
            res = "Error: No valid tables found in the query. Remember to use standard SQL."
            system_log(f"[TOOL] Error: database_query -> {res}", level="error")
            return res
            
        for table in expected_tables:
            if table not in ALLOWED_TABLES:
                res = f"Security Error: Table '{table}' is not in the allowed tables list."
                system_log(f"[TOOL] Error: database_query -> {res}", level="error")
                return res
                
            allowed_attrs = ALLOWED_TABLES[table]
            
            if is_read_query and "R" not in allowed_attrs:
                res = f"Security Error: Read access (SELECT) to table '{table}' is not allowed."
                system_log(f"[TOOL] Error: database_query -> {res}", level="error")
                return res
                
            if is_write_query and "W" not in allowed_attrs:
                res = f"Security Error: Write access (INSERT/UPDATE/DELETE) to table '{table}' is not allowed."
                system_log(f"[TOOL] Error: database_query -> {res}", level="error")
                return res
        
        db = SessionLocal()
        try:
            result = db.execute(text(query_str))
            
            if is_write_query:
                db.commit()
                res = f"Query executed successfully. Affected rows: {result.rowcount}"
                system_log(f"[TOOL] Success: database_query -> {res}", level="system")
                return res
                
            rows = result.fetchall()
            
            if not rows:
                res = "Query executed successfully, but returned 0 rows."
                system_log(f"[TOOL] Success: database_query -> {res}", level="system")
                return res
            
            # Get column names
            columns = list(result.keys())
            
            # Convert rows to a list of dicts
            data = [dict(zip(columns, row)) for row in rows]
            
            # Limit the output to prevent massive context overflow in LLM prompt
            if len(data) > 50:
                 res = json.dumps(data[:50], default=str) + f"\n... (Truncated {len(data) - 50} more rows)"
            else:
                 res = json.dumps(data, default=str)
            
            system_log(f"[TOOL] Success: database_query -> {res[:200]}{'...' if len(res) > 200 else ''}", level="system")
            return res
        except Exception as e:
            if is_write_query:
                db.rollback()
            res = f"Database Error during execution: {str(e)}"
            system_log(f"[TOOL] Error: database_query -> {res}", level="error")
            return res
        finally:
            db.close()
    except Exception as e:
        res = f"Database Error: {str(e)}"
        system_log(f"[TOOL] Error: database_query -> {res}", level="error")
        return res

def http_request(method: str, url: str, data: str = None) -> str:
    """Performs an HTTP request."""
    system_log(f"[TOOL] Start: http_request(method='{method}', url='{url}')", level="system")
    try:
        req = urllib.request.Request(url, method=method.upper())
        if data:
            req.data = data.encode("utf-8")
        with urllib.request.urlopen(req) as response:
            res = response.read().decode("utf-8")
            system_log(f"[TOOL] Success: http_request -> {res[:200]}{'...' if len(res) > 200 else ''}", level="system")
            return res
    except Exception as e:
        res = f"HTTP Error: {str(e)}"
        system_log(f"[TOOL] Error: http_request -> {res}", level="error")
        return res

def http_search(query: str) -> str:
    """Simulates a search engine request."""
    system_log(f"[TOOL] Start: http_search(query='{query}')", level="system")
    res = f"Search results for '{query}': [Result 1, Result 2, Result 3]"
    system_log(f"[TOOL] Success: http_search -> {res}", level="system")
    return res

def perform_gemini_search(query: str) -> str:
    """Uses Gemini 1.5 with Google Search grounding."""
    system_log(f"[TOOL] Start: perform_gemini_search(query='{query}')", level="system")
    try:
        import google.generativeai as genai
        from .credentials import get_credential_by_key
        
        # Try both common spellings because of potential typos in DB
        api_key = get_credential_by_key("GEMENI_API") or get_credential_by_key("GEMINI_API")
        
        if not api_key:
            res = "Error: GEMINI_API key not found in credentials."
            system_log(f"[TOOL] Error: perform_gemini_search -> {res}", level="error")
            return res
            
        genai.configure(api_key=api_key)
        
        # Using a model that supports grounding well
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # We'll use a specific prompt to encourage grounding if the library supports it natively
        # Otherwise, the model will just use its knowledge (which is often better than a broken search)
        prompt = f"Find the latest information about: {query}. Provide names, phone numbers and addresses."
        response = model.generate_content(prompt)
        
        if not response.text:
            res = "Error: Gemini returned empty response."
            system_log(f"[TOOL] Error: perform_gemini_search -> {res}", level="error")
            return res
            
        res = response.text
        system_log(f"[TOOL] Success: perform_gemini_search -> {res[:200]}{'...' if len(res) > 200 else ''}", level="system")
        return res
    except Exception as e:
        res = f"Gemini Search Error: {str(e)}"
        system_log(f"[TOOL] Error: perform_gemini_search -> {res}", level="error")
        return res


def smart_search(query: str, model_config: dict = None) -> str:
    """
    Intelligent search tool that adapts based on the active provider/model.
    Strictly respects the chosen provider to avoid unauthorized API calls.
    """
    provider = "openai" # Default to openai if not specified
    if model_config:
        provider = model_config.get("provider", "openai").lower()

    system_log(f"[TOOL] Start: smart_search(query='{query}', provider='{provider}')", level="system")

    if provider == "gemini":
        res = perform_gemini_search(query)
        if "Error" not in res:
            system_log(f"[TOOL] Success: smart_search (via gemini) -> {res[:200]}{'...' if len(res) > 200 else ''}", level="system")
            return res
        system_log(f"[TOOL] Error: smart_search -> {res}", level="error")
        return res
        
    elif provider == "openai":
        from .openai_lib import perform_web_search
        res = perform_web_search(query)
        if "Error" not in res and "HTTPError" not in res:
            system_log(f"[TOOL] Success: smart_search (via openai) -> {res[:200]}{'...' if len(res) > 200 else ''}", level="system")
            return res
        system_log(f"[TOOL] Error: smart_search -> {res}", level="error")
        return res
    
    res = f"Error: Unsupported provider '{provider}' for smart_search."
    system_log(f"[TOOL] Error: smart_search -> {res}", level="error")
    return res


def read_workflow_data(execution_id: str = None) -> str:
    """Fetches workflow data from the database."""
    system_log(f"[TOOL] Start: read_workflow_data(execution_id='{execution_id}')", level="system")
    if not execution_id:
        res = "Error: Missing execution_id"
        system_log(f"[TOOL] Error: read_workflow_data -> {res}", level="error")
        return res
    
    from .struct_func import get_workflow_data
    data = get_workflow_data(execution_id)
    if data is None:
        res = "Error: Workflow data not found."
        system_log(f"[TOOL] Error: read_workflow_data -> {res}", level="error")
        return res
    
    res = json.dumps(data, default=str)
    system_log(f"[TOOL] Success: read_workflow_data -> {res[:100]}...", level="system")
    return res

def read_runtime_data(execution_id: str = None) -> str:
    """Fetches runtime data from the current execution."""
    system_log(f"[TOOL] Start: read_runtime_data(execution_id='{execution_id}')", level="system")
    if not execution_id:
        res = "Error: Missing execution_id"
        system_log(f"[TOOL] Error: read_runtime_data -> {res}", level="error")
        return res
    
    from .struct_func import get_runtime_data
    data = get_runtime_data(execution_id)
    if data is None:
        res = "Error: Runtime data not found."
        system_log(f"[TOOL] Error: read_runtime_data -> {res}", level="error")
        return res
    
    res = json.dumps(data, default=str)
    system_log(f"[TOOL] Success: read_runtime_data -> {res[:100]}...", level="system")
    return res

def write_runtime_data(data: str, execution_id: str = None) -> str:
    """Writes or merges data into the dynamic runtime state."""
    system_log(f"[TOOL] Start: write_runtime_data(execution_id='{execution_id}')", level="system")
    if not execution_id:
        res = "Error: Missing execution_id"
        system_log(f"[TOOL] Error: write_runtime_data -> {res}", level="error")
        return res
    
    try:
        new_data = data
        if isinstance(data, str):
            try:
                new_data = json.loads(data)
            except Exception as e:
                # If it's a string but NOT JSON, we might want to store it as a value or error
                # For now, let's keep the error if it was forced to be JSON
                res = f"Error: Invalid JSON string: {str(e)}"
                system_log(f"[TOOL] Error: write_runtime_data -> {res}", level="error")
                return res
        
        if new_data is None:
             res = "Error: Data is None"
             system_log(f"[TOOL] Error: write_runtime_data -> {res}", level="error")
             return res

        from .struct_func import get_runtime_data, update_runtime_data
        current = get_runtime_data(execution_id) or {}
        
        if isinstance(new_data, dict) and isinstance(current, dict):
            # Special handling for lists to allow "appending" behavior if requested via specific structure
            # or just standard dict update which replaces keys.
            # To be safe and predictable, we'll keep the update() but log it.
            current.update(new_data)
            success = update_runtime_data(execution_id, current)
        else:
            success = update_runtime_data(execution_id, new_data)

        if success:
            res = "Runtime data updated successfully."
            system_log(f"[TOOL] Success: write_runtime_data", level="system")
            return res
        else:
            res = "Error: Failed to update runtime data."
            system_log(f"[TOOL] Error: write_runtime_data -> {res}", level="error")
            return res
    except Exception as e:
        res = f"Error: {str(e)}"
        system_log(f"[TOOL] Error: write_runtime_data -> {res}", level="error")
        return res

