from app.core.database import SessionLocal
from app.models.workflow import WorkflowExecution

db = SessionLocal()
execs = db.query(WorkflowExecution).order_by(WorkflowExecution.started_at.desc()).limit(1).all()
for e in execs:
    print(e.status, e.result_summary)
    print("Logs:", e.logs)
