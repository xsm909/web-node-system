import json
import urllib.request
import urllib.error

def calculator(expression: str) -> str:
    """Calculates a mathematical expression."""
    try:
        if expression is None:
            return "Error: Expression is None"
        
        # Ensure we are working with a string
        expr_str = str(expression)
        
        # Basic safety: allow only math-related characters
        import math
        allowed_chars = set("0123456789+-*/(). ")
        if not all(c in allowed_chars for c in expr_str):
             return f"Error: Invalid characters in expression: {expr_str}"
        
        # Using a restricted eval for the calculator tool
        safe_dict = {"__builtins__": None, "math": math}
        result = eval(expr_str, safe_dict)
        return str(result)
    except Exception as e:
        return f"Error: {str(e)}"

def database_query(query: str) -> str:
    """Executes a database query with security restrictions based on allowed tables and operations."""
    try:
        import re
        from sqlalchemy import text
        from ..core.database import SessionLocal
        
        if not query:
            return "Error: Database query is empty."
            
        query_str = str(query).strip()
        query_lower = query_str.lower()
        
        # Define allowed tables and their attributes (R = Read, W = Write, RW = Read/Write)
        # You can add or remove tables here
        ALLOWED_TABLES = {
            "example_table_read": "R",
            "example_table_write": "W",
            "example_table_read_write": "RW"
        }
        
        # Determine the type of operation
        is_read_query = query_lower.startswith("select")
        is_write_query = query_lower.startswith(("insert", "update", "delete"))
        
        if not is_read_query and not is_write_query:
            return "Security Error: Only SELECT, INSERT, UPDATE, and DELETE queries are permitted."
            
        # Extract table names from FROM, JOIN, INTO, UPDATE clauses
        tables = re.findall(r'(?:from|join|into|update)\s+([a-zA-Z0-9_]+)', query_lower)
        
        expected_tables = set(tables)
        if not expected_tables:
            return "Error: No valid tables found in the query. Remember to use standard SQL."
            
        for table in expected_tables:
            if table not in ALLOWED_TABLES:
                return f"Security Error: Table '{table}' is not in the allowed tables list."
                
            allowed_attrs = ALLOWED_TABLES[table]
            
            if is_read_query and "R" not in allowed_attrs:
                return f"Security Error: Read access (SELECT) to table '{table}' is not allowed."
                
            if is_write_query and "W" not in allowed_attrs:
                return f"Security Error: Write access (INSERT/UPDATE/DELETE) to table '{table}' is not allowed."
        
        db = SessionLocal()
        try:
            result = db.execute(text(query_str))
            
            if is_write_query:
                db.commit()
                return f"Query executed successfully. Affected rows: {result.rowcount}"
                
            rows = result.fetchall()
            
            if not rows:
                return "Query executed successfully, but returned 0 rows."
            
            # Get column names
            columns = list(result.keys())
            
            # Convert rows to a list of dicts
            data = [dict(zip(columns, row)) for row in rows]
            
            # Limit the output to prevent massive context overflow in LLM prompt
            if len(data) > 50:
                 return json.dumps(data[:50], default=str) + f"\n... (Truncated {len(data) - 50} more rows)"
                 
            return json.dumps(data, default=str)
        except Exception as e:
            if is_write_query:
                db.rollback()
            return f"Database Error during execution: {str(e)}"
        finally:
            db.close()
    except Exception as e:
        return f"Database Error: {str(e)}"

def http_request(method: str, url: str, data: str = None) -> str:
    """Performs an HTTP request."""
    try:
        req = urllib.request.Request(url, method=method.upper())
        if data:
            req.data = data.encode("utf-8")
        with urllib.request.urlopen(req) as response:
            return response.read().decode("utf-8")
    except Exception as e:
        return f"HTTP Error: {str(e)}"

def http_search(query: str) -> str:
    """Simulates a search engine request."""
    return f"Search results for '{query}': [Result 1, Result 2, Result 3]"
