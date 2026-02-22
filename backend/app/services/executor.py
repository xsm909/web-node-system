"""
Sandboxed Python workflow execution engine.
Uses RestrictedPython to safely execute node code.
"""
import traceback
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
import ast
import uuid
from types import SimpleNamespace
from RestrictedPython import compile_restricted, safe_globals, safe_builtins, Guards, RestrictingNodeTransformer
from ..core.database import SessionLocal
from ..models.workflow import Workflow, WorkflowExecution, NodeExecution, WorkflowStatus
from ..models.node import NodeType
from ..internal_libs.ask_ai import ask_ai, check_ai
from ..internal_libs.struct_func import get_workflow_data, get_runtime_data, update_runtime_data, get_runtime_schema



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
        "isinstance": isinstance,
        "__build_class__": __build_class__,
        "_iter_unpack_sequence_": Guards.guarded_iter_unpack_sequence,
        "_getiter_": iter,
        "_getitem_": lambda obj, key: obj[key],
        "_write_": lambda obj: obj,  # Allow attribute writes inside sandbox
    },
    "__metaclass__": type,
    "time": time,  # available without import
    "libs": SimpleNamespace(
        ask_ai=ask_ai,
        check_ai=check_ai,
    ),
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

            # Initialize runtime data with empty/default values based on schema
            runtime_schema = workflow.runtime_data_schema or {}
            
            def _generate_defaults(schema):
                if not isinstance(schema, dict): return None
                stype = schema.get("type", "object")
                if stype == "object":
                    return {k: _generate_defaults(v) for k, v in schema.get("properties", {}).items()}
                elif stype == "array": return []
                elif stype == "string": return schema.get("default", "")
                elif stype in ("integer", "number"): return schema.get("default", 0)
                elif stype == "boolean": return schema.get("default", False)
                return schema.get("default", None)

            new_runtime = _generate_defaults(runtime_schema) if runtime_schema else {}
            self.execution.runtime_data = new_runtime
            flag_modified(self.execution, "runtime_data")
            self.db.commit()
            self.db.refresh(self.execution)
            self.log(f"Runtime data initialized: {new_runtime}")

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

            # --- BFS-based dynamic execution (respects than/MAX_THAN branching) ---
            # Start from the Start node (or all zero-in-degree nodes if no Start)
            if start_node:
                queue = [start_node["id"]]
            else:
                # Fall back: enqueue all nodes with no incoming edges
                in_deg = {n["id"]: 0 for n in nodes}
                for edge in edges:
                    t = edge.get("target")
                    if t in in_deg:
                        in_deg[t] += 1
                queue = [nid for nid, d in in_deg.items() if d == 0]

            visited: set = set()
            outputs: dict = {}
            all_success = True

            while queue:
                node_id = queue.pop(0)
                if node_id in visited:
                    continue
                visited.add(node_id)

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

                # Track which downstream nodes to enqueue after this node
                next_node_ids: list = []
                node_params_inst = None

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
                    
                    # Add current execution context wrapper functions to libs
                    current_execution_id = str(self.execution_id)
                    
                    node_globals["libs"].get_workflow_data = lambda: get_workflow_data(current_execution_id)
                    node_globals["libs"].get_runtime_data = lambda: get_runtime_data(current_execution_id)
                    node_globals["libs"].get_runtime_schema = lambda: get_runtime_schema(current_execution_id)
                    node_globals["libs"].update_runtime_data = lambda data: update_runtime_data(current_execution_id, data)

                    exec(byte_code, node_globals)

                    # Handle NodeParameters injection
                    node_params_class = node_globals.get("NodeParameters")
                    if node_params_class and isinstance(node_params_class, type):
                        node_params_inst = node_globals.get("nodeParameters")
                        if not node_params_inst or not isinstance(node_params_inst, node_params_class):
                            node_params_inst = node_params_class()
                            node_globals["nodeParameters"] = node_params_inst
                        
                        # Populate from graph params
                        node_type_params = node_type.parameters if node_type else []
                        param_types = {p["name"]: p["type"] for p in node_type_params if "name" in p and "type" in p}

                        for key, value in params.items():
                            if hasattr(node_params_inst, key):
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
                                    pass
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

                    # --- Determine which downstream nodes to enqueue ---
                    # Read than / MAX_THAN from the NodeParameters instance (if any)
                    than_val = None
                    max_than = None
                    if node_params_inst is not None:
                        than_val = getattr(node_params_inst, "than", None)
                        max_than = getattr(node_params_inst, "MAX_THAN", None)

                    for edge in edges:
                        if edge.get("source") != node_id:
                            continue
                        source_handle = edge.get("sourceHandle")  # e.g. "than_1" or None
                        target_id = edge.get("target")

                        # If this node uses branching (MAX_THAN is defined and > 0)
                        if max_than is not None and isinstance(max_than, int) and max_than > 0:
                            if than_val == 0:
                                # Explicitly stopped — follow no branch
                                self.log(f"Node {node_id}: than=0, blocking all outputs")
                                continue
                            expected_handle = f"than_{than_val}"
                            if source_handle and source_handle != expected_handle:
                                # Wrong branch — skip
                                continue
                            # Correct branch (or edge has no sourceHandle — legacy compat)
                        # else: non-branching node, always follow all outgoing edges

                        if target_id and target_id not in visited:
                            next_node_ids.append(target_id)

                except Exception as e:
                    error_msg = traceback.format_exc()
                    node_exec.status = WorkflowStatus.failed
                    node_exec.error = error_msg
                    self.log(f"Node failed: {node_id}\n{str(e)}", level="error")
                    all_success = False
                    # On failure, do NOT enqueue downstream nodes of this path
                    next_node_ids = []

                self.db.commit()

                # Enqueue next nodes determined during this node's execution
                queue.extend(next_node_ids)

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
