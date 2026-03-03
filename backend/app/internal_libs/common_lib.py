import uuid
from typing import Dict, Any
from ..core.database import SessionLocal
from ..models.workflow import WorkflowExecution
from ..models.user import User, RoleEnum
from .logger_lib import system_log
from .context_lib import execution_context

def get_active_client() -> Dict[str, Any]:
    """
    Returns the ID and Name of the client (workflow owner) for the given execution.
    Refined logic:
    - Automatically resolves execution_id from context.
    - If workflow owner is a client, return them.
    - If workflow owner is manager/admin, return the client selected in frontend (if any).
    """
    execution_id = execution_context.get()
    system_log(f"[COMMON_LIB] Resolving active client for execution: {execution_id}", level="system")
    
    if not execution_id:
        return {"id": None, "name": "Unknown", "error": "No active execution context found"}

    db = SessionLocal()
    try:
        exec_uuid = uuid.UUID(execution_id) if isinstance(execution_id, str) else execution_id
        execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == exec_uuid).first()
        
        if not execution:
            return {"id": None, "name": "Unknown", "error": "Execution not found"}
            
        workflow = execution.workflow
        if not workflow:
            return {"id": None, "name": "Unknown", "error": "Workflow not found"}
            
        if workflow.owner_id != "common":
            if not workflow.owner:
                return {"id": None, "name": "Unknown", "error": "Owner not found"}
                
            owner = workflow.owner
            
            # 1. If owner is a direct client, return them
            if owner.role == RoleEnum.client:
                return {"id": str(owner.id), "name": owner.username}
                
        # 2. If owner is Manager/Admin or workflow is common, check context from frontend
        active_client_id = (execution.runtime_data or {}).get("_active_client_id")
        
        if active_client_id:
            client = db.query(User).filter(User.id == uuid.UUID(active_client_id)).first()
            if client:
                return {"id": str(client.id), "name": client.username}
        
        # 3. Fallback warning
        res = {
            "id": None, 
            "name": "No client selected", 
            "warning": "This is a common workflow and no client was selected in the sidebar."
        }
        system_log(f"[COMMON_LIB] Warning: {res['name']}", level="warning")
        return res

    except Exception as e:
        system_log(f"[COMMON_LIB] Error resolving active client: {str(e)}", level="error")
        return {"id": None, "name": "Error", "error": str(e)}
    finally:
        db.close()
