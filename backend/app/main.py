from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import Base, engine
from .routers import auth, admin, workflow, client, ai_task, data_type, client_metadata, report, ai, schemas, metadata, agent_hints, prompts, python_hints, database_metadata, locks, projects, presets, files
from .models.intermediate_result import IntermediateResult  # noqa: F401 — registers table with Base
from .models.ai_task import AI_Task  # noqa: F401 — registers table with Base
from .models.client_metadata import ClientMetadata  # noqa: F401
from .models.report import Report, ObjectParameter, ReportStyle, ReportRun # noqa: F401
from .models.agent_hint import AgentHint # noqa: F401
from .models.prompt import Prompt # noqa: F401
from .models.preset import Preset # noqa: F401

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
    dialect = engine.dialect.name
    try:
        # Migrations for projects
        try:
            if dialect == 'postgresql':
                db.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id UUID;"))
                db.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS theme_color VARCHAR(20);"))
                db.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';"))
                # Ensure type is correct if it was already added as 50
                db.execute(text("ALTER TABLE projects ALTER COLUMN theme_color TYPE VARCHAR(20);"))
                # If there are no projects, we can safely set NOT NULL. 
                # If there are projects, we might need a default, but since there are 0, we can proceed or just keep it nullable in DB if we want to be safe.
                # The user said non-nullable, so I'll try to set it.
                db.execute(text("ALTER TABLE projects ALTER COLUMN owner_id SET NOT NULL;"))
                db.execute(text("CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);"))
            else:
                db.execute(text("ALTER TABLE projects ADD COLUMN owner_id CHAR(36);"))
                db.execute(text("ALTER TABLE projects ADD COLUMN theme_color VARCHAR(20);"))
                db.execute(text("ALTER TABLE projects ADD COLUMN category VARCHAR(50) DEFAULT 'general';"))
                db.execute(text("CREATE INDEX idx_projects_owner_id ON projects(owner_id);"))
            db.commit()
        except Exception as e:
            print(f"Project migration error: {e}")
            db.rollback()

        # Migrations for reports
        try:
            if dialect == 'postgresql':
                db.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS category VARCHAR(255);"))
            else:
                db.execute(text("ALTER TABLE reports ADD COLUMN category VARCHAR(255);"))
            db.commit()
        except:
            db.rollback()

        # Migrations for agent_hints
        try:
            if dialect == 'postgresql':
                db.execute(text("ALTER TABLE agent_hints ADD COLUMN IF NOT EXISTS system_hints BOOLEAN DEFAULT FALSE;"))
            else:
                db.execute(text("ALTER TABLE agent_hints ADD COLUMN system_hints BOOLEAN DEFAULT FALSE;"))
            db.commit()
        except:
            db.rollback()

        # Migrations for object_parameters
        try:
            if dialect == 'postgresql':
                db.execute(text("ALTER TABLE object_parameters ADD COLUMN IF NOT EXISTS parameter_type VARCHAR(50) DEFAULT 'text';"))
                db.execute(text("ALTER TABLE object_parameters ADD COLUMN IF NOT EXISTS default_value TEXT;"))
            else:
                db.execute(text("ALTER TABLE object_parameters ADD COLUMN parameter_type VARCHAR(50) DEFAULT 'text';"))
                db.execute(text("ALTER TABLE object_parameters ADD COLUMN default_value TEXT;"))
            db.commit()
        except:
            db.rollback()

        # Migrations for node_types
        try:
            if dialect == 'postgresql':
                db.execute(text("ALTER TABLE node_types ADD COLUMN IF NOT EXISTS is_async BOOLEAN DEFAULT FALSE;"))
                db.execute(text("ALTER TABLE node_types ADD COLUMN IF NOT EXISTS icon VARCHAR(100) DEFAULT 'task';"))
                # Using ALTER COLUMN without IF EXISTS as PG supports it, but might fail if already NOT NULL
                try:
                    db.execute(text("ALTER TABLE node_types ALTER COLUMN input_schema SET NOT NULL;"))
                    db.execute(text("ALTER TABLE node_types ALTER COLUMN output_schema SET NOT NULL;"))
                    db.execute(text("ALTER TABLE node_types ALTER COLUMN parameters SET NOT NULL;"))
                except:
                    pass
            else:
                db.execute(text("ALTER TABLE node_types ADD COLUMN is_async BOOLEAN DEFAULT FALSE;"))
                db.execute(text("ALTER TABLE node_types ADD COLUMN icon VARCHAR(100) DEFAULT 'task';"))
            db.commit()
        except:
            db.rollback()
        
        # Migrations for prompts
        try:
            if dialect == 'postgresql':
                db.execute(text("ALTER TABLE prompts ALTER COLUMN content TYPE JSONB USING content::jsonb;"))
                db.execute(text("ALTER TABLE prompts ADD COLUMN IF NOT EXISTS raw TEXT;"))
                db.execute(text("ALTER TABLE prompts ADD COLUMN IF NOT EXISTS meta JSONB;"))
            else:
                db.execute(text("ALTER TABLE prompts ADD COLUMN raw TEXT;"))
                db.execute(text("ALTER TABLE prompts ADD COLUMN meta JSON;"))
            db.commit()
        except:
            db.rollback()

        # Project system migrations - Ensure project_id exists in relevant tables
        project_table_mapping = {
            'metadata': ['metadata', 'records'],
            'agent_hints': ['agent_hints'],
            'workflows': ['workflows'],
            'schemas': ['schemas'],
            'reports': ['reports'],
            'prompts': ['prompts'],
            'response': ['response']
        }
        from sqlalchemy import inspect
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        for requested_name, possible_names in project_table_mapping.items():
            actual_table = next((t for t in possible_names if t in existing_tables), None)
            if not actual_table:
                continue
            
            try:
                # Add column if not exists
                if dialect == 'postgresql':
                    print(f"Migrating {actual_table} (PostgreSQL)...")
                    db.execute(text(f"ALTER TABLE {actual_table} ADD COLUMN IF NOT EXISTS project_id UUID;"))
                    # FK might fail if already exists or constraint name differs, so we wrap it
                    try:
                        db.execute(text(f"ALTER TABLE {actual_table} ADD CONSTRAINT fk_{actual_table}_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;"))
                    except Exception as fk_e:
                        print(f"Note: FK constraint for {actual_table} already exists or failed: {fk_e}")
                    db.execute(text(f"CREATE INDEX IF NOT EXISTS idx_{actual_table}_project_id ON {actual_table}(project_id);"))
                else:
                    # SQLite fallback
                    print(f"Migrating {actual_table} (SQLite)...")
                    try:
                        db.execute(text(f"ALTER TABLE {actual_table} ADD COLUMN project_id CHAR(36);"))
                        db.execute(text(f"CREATE INDEX idx_{actual_table}_project_id ON {actual_table}(project_id);"))
                    except:
                        pass # Column already exists
                db.commit()
                print(f"Successfully migrated table {actual_table}")
            except Exception as migrate_e:
                db.rollback()
                print(f"Error migrating table {actual_table}: {migrate_e}")


        # Add date_bucket_floor function
        db.execute(text("""
CREATE OR REPLACE FUNCTION date_bucket_floor(ts timestamptz, mode text)
RETURNS timestamptz
AS $$
BEGIN
    CASE mode
        WHEN 'hour' THEN
            RETURN date_trunc('hour', ts);

        WHEN 'day' THEN
            RETURN date_trunc('day', ts);

        WHEN 'month' THEN
            RETURN date_trunc('month', ts);

        WHEN '15 days' THEN
            RETURN date_trunc('month', ts)
                   + ((EXTRACT(DAY FROM ts)::int - 1) / 15) * INTERVAL '15 days';

        ELSE
            RAISE EXCEPTION 'Unsupported mode: %', mode;
    END CASE;
END;
$$ LANGUAGE plpgsql;
"""))
        
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

from fastapi import Request
from .internal_libs.context_lib import project_id_context, project_owner_context

@app.middleware("http")
async def add_project_context(request: Request, call_next):
    project_id = request.headers.get("X-Project-Id")
    project_owner = request.headers.get("X-Project-Owner")
    
    token_id = project_id_context.set(project_id)
    token_owner = project_owner_context.set(project_owner)
    
    try:
        response = await call_next(request)
        return response
    finally:
        project_id_context.reset(token_id)
        project_owner_context.reset(token_owner)

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
app.include_router(metadata.router)
app.include_router(agent_hints.router)
app.include_router(prompts.router)
app.include_router(python_hints.router)
app.include_router(database_metadata.router)
app.include_router(locks.router)
app.include_router(projects.router)
app.include_router(presets.router)
app.include_router(files.router)

@app.get("/")
def root():
    return {"message": "Workflow Engine API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
