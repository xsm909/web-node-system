from app.core.database import SessionLocal
from app.models.workflow import WorkflowExecution
from app.services.executor import WorkflowExecutor
import sys
import uuid

execution_id = sys.argv[1]
exc = WorkflowExecutor(uuid.UUID(execution_id))
exc.execute()
print(exc.execution_logs)
