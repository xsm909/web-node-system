from app.core.database import SessionLocal
from app.models.workflow import Workflow, WorkflowExecution, NodeExecution

def clear_all_workflows():
    db = SessionLocal()
    try:
        # Delete dependent records first
        db.query(NodeExecution).delete()
        db.query(WorkflowExecution).delete()
        db.query(Workflow).delete()
        db.commit()
        print("Successfully cleared all workflows and related executions.")
    except Exception as e:
        db.rollback()
        print(f"Error clearing workflows: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clear_all_workflows()
