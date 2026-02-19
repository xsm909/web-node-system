"""
Sandboxed Python workflow execution engine.
Uses RestrictedPython to safely execute node code.
"""
import traceback
from datetime import datetime, timezone
from sqlalchemy.orm import Session
import ast
import uuid
from RestrictedPython import compile_restricted, safe_globals, safe_builtins, Guards, RestrictingNodeTransformer
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
        "__build_class__": __build_class__,
    },
    "__metaclass__": type,
}


ALLOWED_MODULES = [
    "math", "json", "datetime", "re", "random", 
    "base64", "hashlib", "time", "collections", 
    "itertools", "functools", "decimal", "statistics"
]


def restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
    """Restricted version of __import__ that only allows whitelisted modules."""
    if name in ALLOWED_MODULES:
        return __import__(name, globals, locals, fromlist, level)
    raise ImportError(f"Module '{name}' is not allowed in the node sandbox.")


class CustomRestrictingNodeTransformer(RestrictingNodeTransformer):
    """Custom RestrictedPython transformer to allow type annotations in assignments."""

    def visit_AnnAssign(self, node):
        """Allow AnnAssign (type annotated assignments) by converting them to regular assignments."""
        value = node.value
        if value is None:
            # For cases like 'x: int', convert to 'x = None' to ensure it's a valid statement
            # and that the attribute exists on the class/module.
            value = ast.copy_location(ast.Constant(value=None), node)
        
        # Convert to a regular assignment
        assign_node = ast.copy_location(
            ast.Assign(
                targets=[node.target],
                value=value
            ),
            node
        )
        # Inherit the rest of the safety checks from visit_Assign
        return self.visit_Assign(assign_node)


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


class WorkflowExecutor:
    class NodePrintCollector:
        def __init__(self, executor, _getattr_=None):
            self.executor = executor

        def _call_print(self, *args):
            self.executor.restricted_print(*args)

        def write(self, data):
            if data.strip():
                self.executor.restricted_print(data)

    def __init__(self, execution_id: uuid.UUID):
        self.execution_id = execution_id
        self.db = SessionLocal()
        self.execution_logs = []
        self.current_node_id = None
        self.execution = None

    def log(self, message: str, node_id: str = None, level: str = "info"):
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": str(message),
            "node_id": node_id or self.current_node_id,
            "level": level
        }
        self.execution_logs.append(entry)
        if self.execution:
            self.execution.logs = list(self.execution_logs)
            self.db.commit()

    def restricted_print(self, *args, **kwargs):
        message = " ".join(map(str, args))
        self.log(message)

    def execute(self):
        try:
            self.execution = self.db.query(WorkflowExecution).filter(WorkflowExecution.id == self.execution_id).first()
            if not self.execution:
                return

            workflow = self.db.query(Workflow).filter(Workflow.id == self.execution.workflow_id).first()
            if not workflow:
                return

            self.execution.status = WorkflowStatus.running
            self.db.commit()

            graph = workflow.graph or {"nodes": [], "edges": []}
            nodes = graph.get("nodes", [])
            edges = graph.get("edges", [])

            node_map = {n["id"]: n for n in nodes}
            
            # Find Start node
            start_node = next((n for n in nodes if n.get("data", {}).get("label") == "Start"), None)
            
            if start_node:
                self.log(f"Found Start node: {start_node['id']}")
                # Only execute nodes reachable from Start
                reachable = {start_node["id"]}
                stack = [start_node["id"]]
                adj = {n["id"]: [] for n in nodes}
                for edge in edges:
                    src = edge.get("source")
                    tgt = edge.get("target")
                    if src in adj:
                        adj[src].append(tgt)
                
                while stack:
                    curr = stack.pop()
                    for neighbor in adj.get(curr, []):
                        if neighbor not in reachable:
                            reachable.add(neighbor)
                            stack.append(neighbor)
                
                # Filter nodes and edges
                nodes = [n for n in nodes if n["id"] in reachable]
                edges = [e for e in edges if e.get("source") in reachable and e.get("target") in reachable]
                self.log(f"Reachable nodes from Start: {len(nodes)}")
            else:
                self.log("No 'Start' node found. Executing all nodes in topological order.", level="warning")

            order = _topological_sort(nodes, edges)

            outputs: dict = {}
            all_success = True

            for node_id in order:
                self.current_node_id = node_id
                node_data = node_map.get(node_id)
                if not node_data:
                    continue

                node_exec = NodeExecution(
                    execution_id=self.execution_id,
                    node_id=node_id,
                    status=WorkflowStatus.running,
                )
                self.db.add(node_exec)
                self.db.commit()
                self.db.refresh(node_exec)

                self.log(f"Starting node: {node_id}")

                try:
                    # Get node type code
                    data = node_data.get("data", {})
                    node_type_name = data.get("nodeType") or data.get("label")
                    node_type = self.db.query(NodeType).filter(NodeType.name == node_type_name).first()
                    code = node_type.code if node_type else "def run(inputs, params):\n    return {}"
                    params = data.get("params", {})

                    # Collect inputs from upstream nodes
                    inputs = {}
                    for edge in edges:
                        if edge.get("target") == node_id:
                            src_id = edge.get("source")
                            if src_id in outputs:
                                inputs.update(outputs[src_id])

                    # Execute in restricted environment using custom transformer to support AnnAssign
                    byte_code = compile_restricted(
                        code, 
                        f"<node:{node_id}>", 
                        "exec", 
                        policy=CustomRestrictingNodeTransformer
                    )
                    
                    # Create context-specific globals for this node
                    node_globals = {
                        **SAFE_GLOBALS,
                        "__name__": f"<node:{node_id}>",
                        "_print_": lambda _getattr_=None: self.NodePrintCollector(self, _getattr_),
                        "_getattr_": Guards.safer_getattr,
                        "_setattr_": Guards.guarded_setattr,
                        "_delattr_": Guards.guarded_delattr,
                        "__builtins__": {
                            **SAFE_GLOBALS["__builtins__"],
                            "print": self.restricted_print,
                            "__import__": restricted_import
                        },
                    }
                    
                    # Execute with unified globals and locals to ensure top-level variables
                    # are accessible within defined functions (like 'run')
                    exec(byte_code, node_globals)

                    # Handle NodeParameters injection
                    node_params_class = node_globals.get("NodeParameters")
                    if node_params_class and isinstance(node_params_class, type):
                        # Ensure nodeParameters instance exists
                        node_params_inst = node_globals.get("nodeParameters")
                        if not node_params_inst or not isinstance(node_params_inst, node_params_class):
                            node_params_inst = node_params_class()
                            node_globals["nodeParameters"] = node_params_inst
                        
                        # Populate from graph params
                        node_type_params = node_type.parameters if node_type else []
                        param_types = {p["name"]: p["type"] for p in node_type_params if "name" in p and "type" in p}

                        for key, value in params.items():
                            if hasattr(node_params_inst, key):
                                # Try to convert type based on schema from database
                                try:
                                    ptype = param_types.get(key)
                                    if ptype == "number":
                                        value = float(value) if "." in str(value) else int(value)
                                    elif ptype == "boolean":
                                        if isinstance(value, str):
                                            value = value.lower() in ("true", "1", "yes")
                                        else:
                                            value = bool(value)
                                except (ValueError, TypeError):
                                    pass # Keep original value if conversion fails
                                
                                setattr(node_params_inst, key, value)

                    run_fn = node_globals.get("run")
                    
                    if not run_fn:
                        raise ValueError("Node code must define a 'run(inputs, params)' function")
                    
                    result = run_fn(inputs, params)
                    if not isinstance(result, dict):
                        result = {"output": result}

                    outputs[node_id] = result
                    node_exec.status = WorkflowStatus.success
                    node_exec.output = result
                    self.log(f"Node success: {node_id}")

                except Exception as e:
                    error_msg = traceback.format_exc()
                    node_exec.status = WorkflowStatus.failed
                    node_exec.error = error_msg
                    self.log(f"Node failed: {node_id}\n{str(e)}", level="error")
                    all_success = False

                self.db.commit()

            self.execution.status = WorkflowStatus.success if all_success else WorkflowStatus.failed
            self.execution.result_summary = "Completed successfully" if all_success else "One or more nodes failed"
            self.execution.logs = list(self.execution_logs)
            self.execution.finished_at = datetime.now(timezone.utc)
            self.db.commit()

        except Exception as e:
            if self.execution:
                self.execution.status = WorkflowStatus.failed
                self.execution.result_summary = str(e)
                self.log(f"Workflow execution failed: {str(e)}", level="critical")
                self.db.commit()
        finally:
            self.db.close()


def execute_workflow(execution_id: uuid.UUID):
    """Entry point for background task."""
    executor = WorkflowExecutor(execution_id)
    executor.execute()
