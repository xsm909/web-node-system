from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import Base, engine
from .routers import auth, admin, workflow, client, ai_task, data_type, client_metadata, report, ai, schemas, records, agent_hints, prompts
from .models.intermediate_result import IntermediateResult  # noqa: F401 — registers table with Base
from .models.ai_task import AI_Task  # noqa: F401 — registers table with Base
from .models.client_metadata import ClientMetadata  # noqa: F401
from .models.report import Report, ReportParameter, ReportStyle, ReportRun # noqa: F401
from .models.agent_hint import AgentHint # noqa: F401
from .models.prompt import Prompt # noqa: F401

# Create all tables on startup
Base.metadata.create_all(bind=engine)

from sqlalchemy import text # Add this import

import json
from contextlib import asynccontextmanager
from .models.workflow import WorkflowExecution, WorkflowStatus
from .core.database import SessionLocal

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cleanup hanging executions on startup
    db = SessionLocal()
    try:
        # Emergency migration for category column
        db.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS category VARCHAR(255);"))
        
        # Migrations for node_types
        db.execute(text("ALTER TABLE node_types ADD COLUMN IF NOT EXISTS is_async BOOLEAN DEFAULT FALSE;"))
        db.execute(text("ALTER TABLE node_types ADD COLUMN IF NOT EXISTS icon VARCHAR(100) DEFAULT 'task';"))
        db.execute(text("ALTER TABLE node_types ALTER COLUMN input_schema SET NOT NULL;"))
        db.execute(text("ALTER TABLE node_types ALTER COLUMN output_schema SET NOT NULL;"))
        db.execute(text("ALTER TABLE node_types ALTER COLUMN parameters SET NOT NULL;"))
        
        # Migrations for prompts
        db.execute(text("ALTER TABLE prompts ALTER COLUMN content TYPE JSONB USING content::jsonb;"))
        db.execute(text("ALTER TABLE prompts ADD COLUMN IF NOT EXISTS raw TEXT;"))
        db.execute(text("ALTER TABLE prompts ADD COLUMN IF NOT EXISTS meta JSONB;"))
        
        db.commit()
    except Exception as e:
        print(f"Migration error: {e}")

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
app.include_router(workflow.router)
app.include_router(client.router)
app.include_router(ai_task.router)
app.include_router(data_type.router)
app.include_router(client_metadata.router)
app.include_router(report.router)
app.include_router(ai.router)
app.include_router(schemas.router)
app.include_router(records.router)
app.include_router(agent_hints.router)
app.include_router(prompts.router)

@app.get("/")
def root():
    return {"message": "Workflow Engine API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
