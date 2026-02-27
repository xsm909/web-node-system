"""
Sandboxed Python workflow execution engine.
Uses RestrictedPython to safely execute node code.
"""
import traceback
import time
import json
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
from ..internal_libs.struct_func import get_workflow_data, get_runtime_data, update_runtime_data
from ..internal_libs.openai_lib import create_new_conversation, set_prompt, ask_ai as openai_ask_ai, ask_AI as openai_ask_AI
from ..internal_libs.agent_lib import agent_run
from ..internal_libs.tools_lib import (
    calculator, database_query, http_request, http_search, 
    smart_search, read_workflow_data, read_runtime_data, write_runtime_data
)
from ..internal_libs.logger_lib import executor_logger


def json_sanitize(obj):
    """Recursively converts non-serializable objects (like functions) into strings."""
    if isinstance(obj, dict):
        return {k: json_sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_sanitize(i) for i in obj]
    elif callable(obj):
        return str(obj)
    return obj


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
        agent_run=agent_run,
        calculator=calculator,
        database_query=database_query,
        http_request=http_request,
        http_search=http_search,
        smart_search=smart_search,
        read_workflow_data=read_workflow_data,
        read_runtime_data=read_runtime_data,
        write_runtime_data=write_runtime_data,
    ),
    "openai": SimpleNamespace(
        create_new_conversation=create_new_conversation,
        set_prompt=set_prompt,
        ask_ai=openai_ask_ai,
        ask_AI=openai_ask_AI,
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
            try:
                self.db.commit()
            except:
                self.db.rollback()

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

            # Set the logger context for this execution thread
            token = executor_logger.set(self.log)

            self.execution.status = WorkflowStatus.running
            self.db.commit()

            # Initialize runtime data from workflow_data if it's empty or the default {}.
            # Note: We check if it's empty because the model default is {}.
            if not self.execution.runtime_data:
                self.execution.runtime_data = dict(workflow.workflow_data) if workflow.workflow_data else {}
                flag_modified(self.execution, "runtime_data")
                self.db.commit()
                self.db.refresh(self.execution)
                self.log(f"Runtime data initialized from workflow configuration: {self.execution.runtime_data}", level="system")
            else:
                self.log(f"Resuming execution with existing runtime data: {self.execution.runtime_data}", level="system")

            graph = workflow.graph or {"nodes": [], "edges": []}
            nodes = graph.get("nodes", [])
            edges = graph.get("edges", [])

            node_map = {n["id"]: n for n in nodes}
            
            # Find Start node
            start_node = next((n for n in nodes if n.get("data", {}).get("label") == "Start"), None)
            
            if start_node:
                self.log(f"Found Start node: {start_node['id']}", level="system")
                # Expanded Reachability: Sequential successors + Side-dependency providers
                reachable: set = {start_node["id"]}
                reach_stack: list = [start_node["id"]]
                
                # Pre-map all edges for efficient lookup
                fwd_adj = {n["id"]: [] for n in nodes}
                bwd_adj = {n["id"]: [] for n in nodes}
                for edge in edges:
                    s = edge.get("source")
                    t = edge.get("target")
                    if s in fwd_adj: fwd_adj[s].append(t)
                    if t in bwd_adj: bwd_adj[t].append(s)

                while reach_stack:
                    curr = reach_stack.pop()
                    # 1. Forward sequential successors
                    for neighbor in fwd_adj.get(curr, []):
                        if neighbor not in reachable:
                            reachable.add(neighbor)
                            reach_stack.append(neighbor)
                    # 2. Backward side-dependency providers
                    # If this node is reachable, its providers MUST be reachable
                    for neighbor in bwd_adj.get(curr, []):
                        if neighbor not in reachable:
                            reachable.add(neighbor)
                            reach_stack.append(neighbor)
                
                # Filter nodes and edges to the expanded reachable set
                nodes = [n for n in nodes if n["id"] in reachable]
                edges = [e for e in edges if e.get("source") in reachable and e.get("target") in reachable]
                self.log(f"Expanded reachable set size: {len(nodes)}", level="system")
            else:
                self.log("No 'Start' node found. Executing all nodes in topological order.", level="warning")

            # --- Dependency-Aware Execution Loop ---
            initial_queue = []
            for n in nodes:
                nid = n["id"]
                has_seq_incoming = any(
                    e.get("target") == nid and 
                    e.get("targetHandle") in (None, "", "top") 
                    for e in edges
                )
                if not has_seq_incoming or nid == (start_node["id"] if start_node else None):
                    if nid not in initial_queue:
                        initial_queue.append(nid)

            queue = list(initial_queue)
            triggered = set(initial_queue)
            waiting = set()
            outputs: dict = {}
            all_success = True

            while queue or waiting:
                if not queue:
                    ready_nids = []
                    for wid in list(waiting):
                        node_edges = [e for e in edges if e.get("target") == wid]
                        side_deps = [e.get("source") for e in node_edges if e.get("targetHandle") and e.get("targetHandle") not in (None, "", "top")]
                        if all(s in outputs for s in side_deps):
                            ready_nids.append(wid)
                    
                    if not ready_nids:
                        self.log(f"Stall detected: Nodes {list(waiting)} waiting for unresolved dependencies.", level="critical")
                        all_success = False
                        break
                    
                    for r in ready_nids:
                        waiting.remove(r)
                        queue.append(r)
                    continue

                node_id = queue.pop(0)
                if node_id in outputs: 
                    continue

                node_edges = [e for e in edges if e.get("target") == node_id]
                side_deps = [e.get("source") for e in node_edges if e.get("targetHandle") and e.get("targetHandle") not in (None, "", "top")]
                
                missing_deps = [s for s in side_deps if s not in outputs]
                if missing_deps:
                    waiting.add(node_id)
                    continue

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

                node_name = node_data.get("data", {}).get("label") or node_id
                self.log(f"Start: {node_name}", level="system")

                next_node_ids: list = []
                node_params_inst = None

                try:
                    data = node_data.get("data", {})
                    node_type_name = data.get("nodeType") or data.get("label")
                    node_type = self.db.query(NodeType).filter(NodeType.name == node_type_name).first()
                    code = node_type.code if node_type else "def run(inputs, params):\n    return {}"
                    params = data.get("params", {})

                    inputs = {}
                    prior_output_value = None
                    handle_inputs = {}

                    for edge in edges:
                        if edge.get("target") == node_id:
                            src_id = edge.get("source")
                            tgt_handle = edge.get("targetHandle")
                            
                            if src_id in outputs:
                                src_out = outputs[src_id]
                                inputs.update(src_out)
                                
                                extracted_val = None
                                if len(src_out) == 1:
                                    extracted_val = list(src_out.values())[0]
                                elif len(src_out) > 1:
                                    extracted_val = src_out
                                
                                if not tgt_handle or tgt_handle in (None, "", "top"):
                                    prior_output_value = extracted_val
                                
                                if tgt_handle:
                                    if tgt_handle not in handle_inputs:
                                        handle_inputs[tgt_handle] = extracted_val
                                    else:
                                        existing = handle_inputs[tgt_handle]
                                        if isinstance(existing, list):
                                            existing.append(extracted_val)
                                        else:
                                            handle_inputs[tgt_handle] = [existing, extracted_val]

                    byte_code = compile_restricted(
                        code, 
                        f"<node:{node_id}>", 
                        "exec", 
                        policy=CustomRestrictingNodeTransformer
                    )
                    
                    # Create a FRESH libs namespace for this execution to avoid data leakage
                    from copy import copy
                    execution_libs = copy(SAFE_GLOBALS["libs"])
                    execution_openai = copy(SAFE_GLOBALS["openai"])

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
                        "libs": execution_libs,
                        "openai": execution_openai,
                    }
                    
                    current_execution_id = str(self.execution_id)
                    execution_libs.get_workflow_data = lambda: get_workflow_data(current_execution_id)
                    execution_libs.get_runtime_data = lambda: get_runtime_data(current_execution_id)
                    execution_libs.get_runtime_schema = lambda: {} # Return empty dict as schema is removed
                    execution_libs.update_runtime_data = lambda data: update_runtime_data(current_execution_id, data)
                    execution_libs.read_workflow_data = lambda: read_workflow_data(current_execution_id)
                    execution_libs.read_runtime_data = lambda: read_runtime_data(current_execution_id)
                    execution_libs.write_runtime_data = lambda data: write_runtime_data(data, current_execution_id)
                    execution_libs.agent_run = lambda *args, **kwargs: agent_run(*args, **kwargs, execution_id=current_execution_id)

                    exec(byte_code, node_globals)

                    node_params_class = node_globals.get("NodeParameters")
                    if node_params_class and isinstance(node_params_class, type):
                        node_params_inst = node_globals.get("nodeParameters")
                        if not node_params_inst or not isinstance(node_params_inst, node_params_class):
                            node_params_inst = node_params_class()
                            node_globals["nodeParameters"] = node_params_inst
                        
                        if prior_output_value is not None and hasattr(node_params_inst, "Input"):
                            setattr(node_params_inst, "Input", prior_output_value)

                    input_params_class = node_globals.get("InputParameters")
                    if input_params_class and isinstance(input_params_class, type):
                        input_params_inst = node_globals.get("inputParameters")
                        if not input_params_inst or not isinstance(input_params_inst, input_params_class):
                            input_params_inst = input_params_class()
                            node_globals["inputParameters"] = input_params_inst
                            
                        for handle_name, val in handle_inputs.items():
                            if val is None:
                                self.log(f"Warning: Input handle '{handle_name}' received a null value", level="warning")
                            if hasattr(input_params_inst, handle_name):
                                setattr(input_params_inst, handle_name, val)
                            elif handle_name.endswith('s') and hasattr(input_params_inst, handle_name[:-1]):
                                setattr(input_params_inst, handle_name[:-1], val)

                    if node_params_inst:
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
                    # Sanitize before JSON serialization
                    node_exec.output = json_sanitize(result)
                    self.log(f"Success: {node_name}", level="system")

                    than_val = None
                    max_than = None
                    if node_params_inst is not None:
                        than_val = getattr(node_params_inst, "than", None)
                        max_than = getattr(node_params_inst, "MAX_THAN", None)

                    for edge in edges:
                        if edge.get("source") != node_id:
                            continue
                        
                        target_id = edge.get("target")
                        tgt_handle = edge.get("targetHandle")
                        
                        if tgt_handle and tgt_handle not in (None, "", "top"):
                            continue

                        source_handle = edge.get("sourceHandle")

                        if max_than is not None and isinstance(max_than, int) and max_than > 0:
                            if than_val == 0:
                                self.log(f"{node_name}: than=0, блокируем все выходы", level="system")
                                continue
                            expected_handle = f"than_{than_val}"
                            if source_handle and source_handle != expected_handle:
                                continue

                        if target_id and target_id not in outputs:
                            if target_id not in triggered:
                                triggered.add(target_id)
                                queue.append(target_id)

                    ready_now = []
                    for wid in list(waiting):
                        w_edges = [e for e in edges if e.get("target") == wid]
                        w_side_deps = [e.get("source") for e in w_edges if e.get("targetHandle") and e.get("targetHandle") not in (None, "", "top")]
                        if all(s in outputs for s in w_side_deps):
                            ready_now.append(wid)
                    
                    for r in ready_now:
                        waiting.remove(r)
                        queue.append(r)

                except Exception as e:
                    error_msg = traceback.format_exc()
                    node_exec.status = WorkflowStatus.failed
                    node_exec.error = error_msg
                    self.log(f"Ошибка {node_name}:\n{str(e)}", level="error")
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
            # Clear the logger context
            if 'token' in locals():
                executor_logger.reset(token)
            self.db.close()


def execute_workflow(execution_id: uuid.UUID):
    """Entry point for background task."""
    executor = WorkflowExecutor(execution_id)
    executor.execute()
