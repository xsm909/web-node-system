import uuid
from typing import Any, List, Dict
from sqlalchemy import text
from ..core.database import SessionLocal
from ..models.workflow import WorkflowExecution
from ..models.user import RoleEnum, User
from .logger_lib import system_log
from .context_lib import execution_context

def unsafe_request(sql_query: str) -> List[Dict[str, Any]]:
    """
    Executes a raw SQL query.
    Access control:
    - Current: admin, manager, client, service.
    - Future: admin, service.
    """
    execution_id = execution_context.get()
    if not execution_id:
        system_log("[DATABASE_LIB] No active execution context found", level="error")
        raise PermissionError("No active execution context found")

    db = SessionLocal()
    try:
        exec_uuid = uuid.UUID(execution_id) if isinstance(execution_id, str) else execution_id
        execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == exec_uuid).first()
        
        if not execution or not execution.workflow:
            system_log(f"[DATABASE_LIB] Execution or workflow not found for {execution_id}", level="error")
            raise PermissionError("Execution or workflow not found")

        owner = execution.workflow.owner
        if not owner:
            # Fallback for "common" workflows or missing owner relation
            if execution.workflow.owner_id == "common":
                creator = db.query(User).filter(User.id == execution.workflow.created_by).first()
                if creator:
                    owner = creator
                    system_log(f"[DATABASE_LIB] Resolved owner as creator ({creator.username}, {creator.role}) for common workflow", level="system")

        if not owner:
            system_log(f"[DATABASE_LIB] Could not resolve workflow owner for execution {execution_id}", level="error")
            raise PermissionError("Could not resolve workflow owner")
        
        # Current allowed roles: admin, manager, client, service
        allowed_roles = [RoleEnum.admin, RoleEnum.manager, RoleEnum.client, RoleEnum.service]
        
        # Future logic (commented out):
        # allowed_roles = [RoleEnum.admin, RoleEnum.service]
        
        if owner.role not in allowed_roles:
            system_log(f"[DATABASE_LIB] Access denied for role: {owner.role}", level="warning")
            raise PermissionError(f"Role '{owner.role}' is not allowed to use unsafe_request")

        system_log(f"[DATABASE_LIB] Executing unsafe_request for {owner.username} ({owner.role}): {sql_query}", level="system")
        
        result = db.execute(text(sql_query))
        
        # If it's a SELECT query, return rows as list of dicts
        if result.returns_rows:
            return [dict(row._mapping) for row in result.all()]
        
        db.commit()
        return [{"status": "success", "rowcount": result.rowcount}]

    except Exception as e:
        system_log(f"[DATABASE_LIB] Error in unsafe_request: {str(e)}", level="error")
        raise e
    finally:
        db.close()
