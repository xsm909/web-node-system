from typing import Dict, Any, Optional
import uuid
from ..core.database import SessionLocal
from ..models.workflow import Workflow, WorkflowExecution
from sqlalchemy.orm.attributes import flag_modified

def _get_execution(db, execution_id: str):
    return db.query(WorkflowExecution).filter(WorkflowExecution.id == uuid.UUID(execution_id)).first()

def get_workflow_data(execution_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the workflow data structure.
    """
    db = SessionLocal()
    try:
        execution = _get_execution(db, execution_id)
        if execution and execution.workflow:
            return execution.workflow.workflow_data
        return None
    except Exception as e:
        print(f"Error getting workflow structure: {e}")
        return None
    finally:
        db.close()

def get_runtime_schema(execution_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the runtime data schema.
    """
    db = SessionLocal()
    try:
        execution = _get_execution(db, execution_id)
        if execution and execution.workflow:
            return execution.workflow.runtime_data_schema
        return None
    except Exception as e:
        print(f"Error getting runtime schema: {e}")
        return None
    finally:
        db.close()

def get_runtime_data(execution_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the runtime data structure from execution.
    """
    db = SessionLocal()
    try:
        execution = _get_execution(db, execution_id)
        if execution:
            return execution.runtime_data
        return None
    except Exception as e:
        print(f"Error getting runtime structure: {e}")
        return None
    finally:
        db.close()

def update_runtime_data(execution_id: str, new_data: Dict[str, Any]) -> bool:
    """
    Update the runtime data structure on execution.
    """
    db = SessionLocal()
    try:
        execution = _get_execution(db, execution_id)
        if execution:
            # Overwrite with the new_data Dictionary.
            execution.runtime_data = new_data
            flag_modified(execution, "runtime_data")
            db.commit()
            return True
        return False
    except Exception as e:
        print(f"Error updating runtime structure: {e}")
        return False
    finally:
        db.close()
