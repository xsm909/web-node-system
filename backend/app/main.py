from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import Base, engine
from .routers import auth, admin, manager, client

# Create all tables on startup
Base.metadata.create_all(bind=engine)

import json
from contextlib import asynccontextmanager
from .models.workflow import WorkflowExecution, WorkflowStatus
from .core.database import SessionLocal

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cleanup hanging executions on startup
    db = SessionLocal()
    try:
        hanging = db.query(WorkflowExecution).filter(
            WorkflowExecution.status.in_([WorkflowStatus.pending, WorkflowStatus.running])
        ).all()
        for execution in hanging:
            execution.status = WorkflowStatus.failed
            execution.result_summary = "Execution interrupted by server restart."
            logs = execution.logs if isinstance(execution.logs, list) else []
            logs.append({"timestamp": None, "level": "error", "message": "Server restarted. Execution aborted."})
            execution.logs = logs
        if hanging:
            db.commit()
    except Exception as e:
        print(f"Error cleaning up hanging executions: {e}")
    finally:
        db.close()
    yield

app = FastAPI(title="Workflow Engine API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(manager.router)
app.include_router(client.router)


@app.get("/")
def root():
    return {"message": "Workflow Engine API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
