import json
import urllib.request
import urllib.error
from .logger_lib import system_log

def get_runtime_data(execution_id: str = None) -> str:
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

def set_runtime_data(data: str, execution_id: str = None) -> str:
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

from typing import Any

def get_runtime_value_by_key(execution_id: str, key: str) -> Any:
    """Fetches a specific value from the runtime data by its key."""
    system_log(f"[TOOL] Start: get_runtime_value_by_key(execution_id='{execution_id}', key='{key}')", level="system")
    if not execution_id:
        system_log(f"[TOOL] Error: get_runtime_value_by_key -> Missing execution_id", level="error")
        return None
    
    from .struct_func import get_runtime_data
    data = get_runtime_data(execution_id)
    if data and isinstance(data, dict):
        res = data.get(key)
        system_log(f"[TOOL] Success: get_runtime_value_by_key(key='{key}') -> {str(res)[:100]}", level="system")
        return res
    
    system_log(f"[TOOL] Warning: get_runtime_value_by_key(key='{key}') -> Key not found or data is not a dict", level="warning")
    return None

def delete_runtime_value(execution_id: str, key: str) -> str:
    """Deletes a specific value from the runtime data by its key."""
    system_log(f"[TOOL] Start: delete_runtime_value(execution_id='{execution_id}', key='{key}')", level="system")
    if not execution_id:
        res = "Error: Missing execution_id"
        system_log(f"[TOOL] Error: delete_runtime_value -> {res}", level="error")
        return res
    
    from .struct_func import get_runtime_data, update_runtime_data
    data = get_runtime_data(execution_id)
    if data and isinstance(data, dict):
        if key in data:
            del data[key]
            success = update_runtime_data(execution_id, data)
            if success:
                res = f"Key '{key}' deleted successfully."
                system_log(f"[TOOL] Success: delete_runtime_value(key='{key}')", level="system")
                return res
            else:
                res = "Error: Failed to update runtime data."
                system_log(f"[TOOL] Error: delete_runtime_value -> {res}", level="error")
                return res
        else:
            res = f"Warning: Key '{key}' not found."
            system_log(f"[TOOL] Warning: delete_runtime_value -> {res}", level="warning")
            return res
    
    res = "Error: Runtime data not found or is not a dict."
    system_log(f"[TOOL] Error: delete_runtime_value -> {res}", level="error")
    return res
