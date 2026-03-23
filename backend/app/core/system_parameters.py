from typing import Dict, Any, Callable, Optional
import uuid
from ..internal_libs import projects_lib

# Registry of system parameters and their resolver functions
SYSTEM_PARAMETER_RESOLVERS: Dict[str, Callable[[], Any]] = {
    "system_project_id": lambda: projects_lib.get_project_id()
}

def get_system_parameters() -> Dict[str, Any]:
    """
    Returns a dictionary of all registered system parameters with their current values
    resolved from the execution context.
    """
    params = {}
    for name, resolver in SYSTEM_PARAMETER_RESOLVERS.items():
        try:
            value = resolver()
            if value is not None:
                params[name] = str(value) if isinstance(value, uuid.UUID) else value
        except Exception as e:
            # We don't want a failure in one resolver to break everything
            print(f"Error resolving system parameter {name}: {e}")
            
    return params

def inject_system_params(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merges system parameters with the provided parameters dictionary.
    User-provided parameters take precedence if they share the same name
    AND are not empty strings/None.
    """
    system_params = get_system_parameters()
    result = system_params.copy()
    
    for k, v in params.items():
        # Only override system parameter if the provided value is not "empty"
        if k in SYSTEM_PARAMETER_RESOLVERS:
            if v is not None and v != "":
                result[k] = v
        else:
            # Regular parameters always take precedence
            result[k] = v
            
    return result
