from typing import Optional
import uuid
from .context_lib import project_id_context, project_owner_context

def is_project_mode() -> bool:
    """Checks if the current execution context is within a project mode."""
    return project_id_context.get() is not None

def get_project_id() -> Optional[uuid.UUID]:
    """Returns the current project ID if in project mode."""
    pid = project_id_context.get()
    if pid:
        try:
            return uuid.UUID(pid)
        except (ValueError, TypeError):
            return None
    return None

def get_project_owner() -> Optional[uuid.UUID]:
    """Returns the current project owner ID if in project mode."""
    oid = project_owner_context.get()
    if oid:
        try:
            return uuid.UUID(oid)
        except (ValueError, TypeError):
            return None
    return None
