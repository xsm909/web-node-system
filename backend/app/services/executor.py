"""
Sandboxed Python workflow execution engine.
Uses RestrictedPython to safely execute node code.
"""
import asyncio
import traceback
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from RestrictedPython import compile_restricted, safe_globals, safe_builtins
from ..core.database import SessionLocal
from ..models.workflow import Workflow, WorkflowExecution, NodeExecution, WorkflowStatus
from ..models.node import NodeType


SAFE_GLOBALS = {
    **safe_globals,
    "__builtins__": {
        **safe_builtins,
        "print": print,
        "len": len,
        "range": range,
        "enumerate": enumerate,
        "zip": zip,
        "map": map,
        "filter": filter,
        "list": list,
        "dict": dict,
        "set": set,
        "tuple": tuple,
        "str": str,
        "int": int,
        "float": float,
        "bool": bool,
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
        "sum": sum,
        "sorted": sorted,
        "reversed": reversed,
    },
}


def _run_node_code(code: str, inputs: dict, params: dict) -> dict:
    """Execute node code in a restricted environment."""
    byte_code = compile_restricted(code, "<node>", "exec")
    local_vars = {}
    exec(byte_code, {**SAFE_GLOBALS}, local_vars)
    run_fn = local_vars.get("run")
    if not run_fn:
        raise ValueError("Node code must define a 'run(inputs, params)' function")
    result = run_fn(inputs, params)
    return result if isinstance(result, dict) else {"output": result}


def _topological_sort(nodes: list, edges: list) -> list:
    """Return nodes in topological order (DAG)."""
    node_ids = {n["id"] for n in nodes}
    in_degree = {n["id"]: 0 for n in nodes}
    adj = {n["id"]: [] for n in nodes}

    for edge in edges:
        src = edge.get("source")
        tgt = edge.get("target")
        if src in node_ids and tgt in node_ids:
            adj[src].append(tgt)
            in_degree[tgt] += 1

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    order = []
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for neighbor in adj[nid]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return order


def execute_workflow(execution_id: int):
    """Background task: execute a workflow."""
    db: Session = SessionLocal()
    execution_logs = []

    def log(message: str, node_id: str = None, level: str = "info"):
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": str(message),
            "node_id": node_id,
            "level": level
        }
        execution_logs.append(entry)

    def restricted_print(*args, **kwargs):
        message = " ".join(map(str, args))
        log(message)

    try:
        execution = db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
        if not execution:
            return

        workflow = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
        if not workflow:
            return

        execution.status = WorkflowStatus.running
        db.commit()

        graph = workflow.graph or {"nodes": [], "edges": []}
        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])

        order = _topological_sort(nodes, edges)
        node_map = {n["id"]: n for n in nodes}

        outputs: dict = {}
        all_success = True

        # Custom globals for this execution to capture prints
        custom_globals = {
            **SAFE_GLOBALS,
            "__builtins__": {
                **SAFE_GLOBALS["__builtins__"],
                "print": restricted_print
            }
        }

        for node_id in order:
            node_data = node_map.get(node_id)
            if not node_data:
                continue

            node_exec = NodeExecution(
                execution_id=execution_id,
                node_id=node_id,
                status=WorkflowStatus.running,
            )
            db.add(node_exec)
            db.commit()
            db.refresh(node_exec)

            log(f"Starting node: {node_id}", node_id=node_id)

            try:
                # Get node type code
                node_type_name = node_data.get("data", {}).get("nodeType")
                node_type = db.query(NodeType).filter(NodeType.name == node_type_name).first()
                code = node_type.code if node_type else "def run(inputs, params):\n    return {}"
                params = node_data.get("data", {}).get("params", {})

                # Collect inputs from upstream nodes
                inputs = {}
                for edge in edges:
                    if edge.get("target") == node_id:
                        src_id = edge.get("source")
                        if src_id in outputs:
                            inputs.update(outputs[src_id])

                # Execute in restricted environment
                byte_code = compile_restricted(code, f"<node:{node_id}>", "exec")
                local_vars = {}
                exec(byte_code, custom_globals, local_vars)
                run_fn = local_vars.get("run")
                
                if not run_fn:
                    raise ValueError("Node code must define a 'run(inputs, params)' function")
                
                result = run_fn(inputs, params)
                if not isinstance(result, dict):
                    result = {"output": result}

                outputs[node_id] = result
                node_exec.status = WorkflowStatus.success
                node_exec.output = result
                log(f"Node success: {node_id}", node_id=node_id)

            except Exception as e:
                error_msg = traceback.format_exc()
                node_exec.status = WorkflowStatus.failed
                node_exec.error = error_msg
                log(f"Node failed: {node_id}\n{str(e)}", node_id=node_id, level="error")
                all_success = False

            db.commit()

        execution.status = WorkflowStatus.success if all_success else WorkflowStatus.failed
        execution.result_summary = "Completed successfully" if all_success else "One or more nodes failed"
        execution.logs = execution_logs
        execution.finished_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        if execution:
            execution.status = WorkflowStatus.failed
            execution.result_summary = str(e)
            log(f"Workflow execution failed: {str(e)}", level="critical")
            execution.logs = execution_logs
            db.commit()
    finally:
        db.close()
