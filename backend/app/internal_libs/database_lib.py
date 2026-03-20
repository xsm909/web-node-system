import uuid
from typing import Any, List, Dict, Optional
from sqlalchemy import text
from ..core.database import SessionLocal
from ..models.workflow import WorkflowExecution
from ..models.report import Report
from ..models.user import RoleEnum, User
from .logger_lib import system_log
from .context_lib import execution_context, report_params_context

def unsafe_request(sql_query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Executes a raw SQL query.

    Access control:
    - Current: admin, manager, client, service.
    """

    execution_id = execution_context.get()

    if not execution_id:
        system_log("[DATABASE_LIB] No active execution context found", level="error")
        raise PermissionError("No active execution context found")

    db = SessionLocal()

    try:
        # Resolve execution or report
        exec_uuid = uuid.UUID(execution_id) if isinstance(execution_id, str) else execution_id

        # 1. Try WorkflowExecution
        execution = (
            db.query(WorkflowExecution)
            .filter(WorkflowExecution.id == exec_uuid)
            .first()
        )

        owner = None

        if execution and execution.workflow:
            # Resolve owner from workflow
            owner = execution.workflow.owner

            if not owner and execution.workflow.owner_id == "common":
                creator = (
                    db.query(User)
                    .filter(User.id == execution.workflow.created_by)
                    .first()
                )
                if creator:
                    owner = creator

        # 2. Try Report
        if not owner:
            report = db.query(Report).filter(Report.id == exec_uuid).first()
            if report:
                owner = report.creator
                system_log(
                    f"[DATABASE_LIB] Resolved owner from Report {report.id} "
                    f"({owner.username if owner else 'None'})",
                    level="system"
                )

        if not owner:
            system_log(
                f"[DATABASE_LIB] Could not resolve owner for {execution_id} (not a Workflow or Report)",
                level="error"
            )
            raise PermissionError("Could not resolve execution owner")

        # Check role
        allowed_roles = {
            RoleEnum.admin,
            RoleEnum.manager,
            RoleEnum.client,
            RoleEnum.service,
        }

        if owner.role not in allowed_roles:
            system_log(
                f"[DATABASE_LIB] Access denied for role: {owner.role}",
                level="warning"
            )
            raise PermissionError(
                f"Role '{owner.role}' is not allowed to use unsafe_request"
            )

        system_log(
            f"[DATABASE_LIB] Executing unsafe_request for "
            f"{owner.username} ({owner.role})",
            level="system"
        )

        # Resolve parameters
        final_params = (params or {}).copy()
        
        # 1. Try to fill missing params from report_params_context
        ctx_params = report_params_context.get()
        if ctx_params:
            for k, v in ctx_params.items():
                if k not in final_params or final_params[k] is None or (isinstance(final_params[k], str) and not final_params[k].strip()):
                    final_params[k] = v
        
        # 2. Inject system context if still missing
        if owner:
            if "user_id" not in final_params or final_params["user_id"] is None or (isinstance(final_params["user_id"], str) and not final_params["user_id"].strip()):
                final_params["user_id"] = str(owner.id)
            if "username" not in final_params or final_params["username"] is None or (isinstance(final_params["username"], str) and not final_params["username"].strip()):
                final_params["username"] = owner.username
            if "role" not in final_params or final_params["role"] is None or (isinstance(final_params["role"], str) and not final_params["role"].strip()):
                final_params["role"] = str(owner.role)

        # Execute SQL
        result = db.execute(text(sql_query), final_params)

        rows = None

        if result.returns_rows:
            rows = [dict(row._mapping) for row in result.fetchall()]

        # Always commit if no exception
        db.commit()

        if rows is not None:
            return rows

        return [{
            "status": "success",
            "rowcount": result.rowcount
        }]

    except Exception as e:

        # Rollback on any error
        db.rollback()

        system_log(
            f"[DATABASE_LIB] Error in unsafe_request: {str(e)}",
            level="error"
        )

        raise

    finally:
        db.close()
