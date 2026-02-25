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
    """Simulates a database query."""
    return f"Executed DB query: {query}. (Mock response: 10 rows found)"

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
