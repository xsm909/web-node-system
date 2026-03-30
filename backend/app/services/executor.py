"""
Sandboxed Python workflow execution engine.
Uses RestrictedPython to safely execute node code.
"""
import traceback
import time
import json
from datetime import datetime, date, time, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
import ast
import uuid
from types import SimpleNamespace
import decimal
from RestrictedPython import compile_restricted, safe_globals, safe_builtins, Guards, RestrictingNodeTransformer

from ..core.database import SessionLocal
from ..models.workflow import Workflow, WorkflowExecution, NodeExecution, WorkflowStatus
from ..models.node import NodeType
from ..internal_libs.ask_ai import ask_single, check_ai
from ..internal_libs.struct_func import get_workflow_data, get_runtime_data, update_runtime_data
from ..internal_libs.openai.openai_lib import openai_create_new_conversation as openai_create_new_conversation, openai_set_prompt as openai_set_prompt, openai_ask_chat as openai_ask_chat, openai_ask_single as openai_ask_single, openai_perform_web_search as openai_perform_web_search
from ..internal_libs.gemini.gemini_lib import gemini_create_new_conversation as gemini_create_new_conversation, gemini_set_prompt as gemini_set_prompt, gemini_ask_chat as gemini_ask_chat, gemini_ask_single as gemini_ask_single, gemini_perform_web_search as gemini_perform_web_search
from ..internal_libs.perplexity.perplexity_lib import perplexity_create_new_conversation as perplexity_create_new_conversation, perplexity_set_prompt as perplexity_set_prompt, perplexity_ask_chat as perplexity_ask_chat, perplexity_ask_single as perplexity_ask_single, perplexity_perform_web_search as perplexity_perform_web_search
from ..internal_libs.grok.grok_lib import grok_create_new_conversation as grok_create_new_conversation, grok_set_prompt as grok_set_prompt, grok_ask_chat as grok_ask_chat, grok_ask_single as grok_ask_single, grok_perform_web_search as grok_perform_web_search
from ..internal_libs import agent_lib
from ..internal_libs import common_lib
from ..internal_libs.tools_lib import (
    calculator, database_query, http_request, http_search, 
    smart_search, read_workflow_data, read_runtime_data, write_runtime_data
)
from ..internal_libs import database_lib
from ..internal_libs import analytics
from ..internal_libs import metadata_lib
from ..internal_libs import schema_lib
from ..internal_libs import agent_hints_lib
from ..internal_libs import prompt_lib
from ..internal_libs import response_lib
from ..internal_libs import charts
from ..internal_libs.logger_lib import executor_logger
from ..internal_libs.context_lib import execution_context
from ..internal_libs.runtime_lib import (
    get_runtime_data as runtime_get_data,
    set_runtime_data as runtime_set_data,
    get_runtime_value_by_key as runtime_get_value
)
from ..internal_libs import temp_files_lib


def json_sanitize(obj):
    """
    Recursively converts non-serializable objects (like functions, UUIDs, datetimes) 
    into JSON-compatible formats (mostly strings).
    """
    if isinstance(obj, dict):
        return {k: json_sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_sanitize(i) for i in obj]
    elif isinstance(obj, (uuid.UUID, decimal.Decimal)):
        return str(obj)
    elif isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    elif callable(obj):
        return str(obj)
    return obj


def _inplace_handler(op, target, *args):
    """Handler for augmented assignments in RestrictedPython (e.g. +=, -=).
    - _inplacevar_(op, target, expr) -> len(args) == 1
    - _inplaceitem_(op, target, index, expr) -> len(args) == 2
    """
    if len(args) == 1:
        expr = args[0]
        val = target
    elif len(args) == 2:
        index = args[0]
        expr = args[1]
        val = target[index]
    else:
        return target

    if op == '+=': return val + expr
    if op == '-=': return val - expr
    if op == '*=': return val * expr
    if op == '@=': return val @ expr
    if op == '/=': return val / expr
    if op == '//=': return val // expr
    if op == '%=': return val % expr
    if op == '**=': return val ** expr
    if op == '<<=': return val << expr
    if op == '>>=': return val >> expr
    if op == '&=': return val & expr
    if op == '^=': return val ^ expr
    if op == '|=': return val | expr
    return val


def custom_getattr(obj, name, *args, **kwargs):
    """Custom _getattr_ guard that extends safer_getattr to allow str.format methods.
    RestrictedPython blocks str.format and str.format_map by default, but they
    are needed for template interpolation in node code (e.g. pattern.format(**inputs)).
    """
    if isinstance(obj, str) and name in ("format", "format_map"):
        return getattr(obj, name)
    return Guards.safer_getattr(obj, name, *args, **kwargs)


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
        "type": type,
        "__build_class__": __build_class__,
        "_iter_unpack_sequence_": Guards.guarded_iter_unpack_sequence,
        "_getiter_": iter,
        "_getitem_": lambda obj, key: obj[key],
        "_write_": lambda obj: obj,  # Allow attribute writes inside sandbox
        "_apply_": lambda f, *a, **kw: f(*a, **kw),  # Allow **kwargs unpacking in function calls
        "_inplacevar_": _inplace_handler,
        "_inplaceitem_": _inplace_handler,
    },
    "__metaclass__": type,
    "time": time,  # available without import
    "json": json,
    "libs": SimpleNamespace(
        ask_ai=ask_single,
        check_ai=check_ai,
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
        create_new_conversation=openai_create_new_conversation,
        set_prompt=openai_set_prompt,
        ask_chat=openai_ask_chat,
        ask_single=openai_ask_single,
        perform_web_search=openai_perform_web_search,
    ),
    "gemini": SimpleNamespace(
        create_new_conversation=gemini_create_new_conversation,
        set_prompt=gemini_set_prompt,
        ask_chat=gemini_ask_chat,
        ask_single=gemini_ask_single,
        perform_web_search=gemini_perform_web_search,
    ),
    "perplexity": SimpleNamespace(
        create_new_conversation=perplexity_create_new_conversation,
        set_prompt=perplexity_set_prompt,
        ask_chat=perplexity_ask_chat,
        ask_single=perplexity_ask_single,
        perform_web_search=perplexity_perform_web_search,
    ),
    "grok": SimpleNamespace(
        create_new_conversation=grok_create_new_conversation,
        set_prompt=grok_set_prompt,
        ask_chat=grok_ask_chat,
        ask_single=grok_ask_single,
        perform_web_search=grok_perform_web_search,
    ),
    "common": SimpleNamespace(
        get_active_client=common_lib.get_active_client,
        GetAIByModel=common_lib.GetAIByModel,
        is_valid_json=common_lib.is_valid_json,
        fill_template=common_lib.fill_template
    ),
    "inner_database": SimpleNamespace(
        unsafe_request=database_lib.unsafe_request
    ),
    "analytics": SimpleNamespace(
        process_request=analytics.process_analytics_request,
        process_analytics_request=analytics.process_analytics_request
    ),
    "meta": SimpleNamespace(
        get_metadata=metadata_lib.get_metadata,
        get_metadata_by_id=metadata_lib.get_metadata_by_id,
        get_all_metadata=metadata_lib.get_all_metadata,
        get_all_client_metadata=metadata_lib.get_all_client_metadata,
        get_metadata_by_schema=metadata_lib.get_metadata_by_schema,
        get_client_metadata_by_schema=metadata_lib.get_client_metadata_by_schema,
        get_owner_metadata_by_schema=metadata_lib.get_owner_metadata_by_schema
    ),
    "metadata": SimpleNamespace(
        get_metadata=metadata_lib.get_metadata,
        get_metadata_by_id=metadata_lib.get_metadata_by_id,
        get_all_metadata=metadata_lib.get_all_metadata,
        get_all_client_metadata=metadata_lib.get_all_client_metadata,
        get_metadata_by_schema=metadata_lib.get_metadata_by_schema,
        get_client_metadata_by_schema=metadata_lib.get_client_metadata_by_schema,
        get_owner_metadata_by_schema=metadata_lib.get_owner_metadata_by_schema
    ),
    "schema": SimpleNamespace(
        get_schema_by_key=schema_lib.get_schema_by_key,
        get_all_schemas=schema_lib.get_all_schemas
    ),
    "agent": SimpleNamespace(
        run=agent_lib.run,
        get_agent_hint_by_key=agent_hints_lib.get_agent_hint_by_key,
        get_agent_hint_and_id_by_key=agent_hints_lib.get_agent_hint_and_id_by_key
    ),
    "prompts": SimpleNamespace(
        add_prompt=prompt_lib.add_prompt,
        get_prompts_by_category_with_reference_id=prompt_lib.get_prompts_by_category_with_reference_id,
        get_prompts_by_category_with_id=prompt_lib.get_prompts_by_category_with_id,
        delete_prompts_by_period_and_entity=prompt_lib.delete_prompts_by_period_and_entity,
        delete_prompts_by_period_and_reference_id=prompt_lib.delete_prompts_by_period_and_reference_id
    ),
    "response_data": SimpleNamespace(
        clear_recent_records_by_entity_and_category=response_lib.clear_recent_records_by_entity_and_category,
        add_response=response_lib.add_response,
        update_response_meta=response_lib.update_response_meta,
        update_response_meta_by_key=response_lib.update_response_meta_by_key,
        get_responses_by_period_and_category=response_lib.get_responses_by_period_and_category
    ),
    "files": SimpleNamespace(
        save=temp_files_lib.save,
        download=temp_files_lib.download,
        view=temp_files_lib.view
    ),
    "charts": charts,
    "datetime": datetime,
    "time": time,
    "timedelta": timedelta,
    "workflow": SimpleNamespace(
        execute_node=lambda h, i: None,
        runtime=SimpleNamespace(
            get_data=lambda: None,
            set_data=lambda d: None,
            get_value=lambda k: None
        )
    ),  # Will be injected per-execution
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

            # Set the logger and execution context for this execution thread
            token = executor_logger.set(self.log)
            context_token = execution_context.set(str(self.execution_id))

            self.execution.status = WorkflowStatus.running
            self.db.commit()

            # Load workflow parameters and merge into runtime_data
            workflow_params = {p.parameter_name: p.default_value for p in workflow.parameters}
            
            # current_runtime_data has priority (passed from API)
            passed_runtime_data = self.execution.runtime_data or {}
            
            # Merge: defaults first, then passed data
            merged_runtime = {**workflow_params, **passed_runtime_data}
            
            # Type conversion for workflow parameters
            for p in workflow.parameters:
                val = merged_runtime.get(p.parameter_name)
                if val is not None:
                    try:
                        if p.parameter_type == "number":
                            merged_runtime[p.parameter_name] = float(val) if "." in str(val) else int(val)
                        elif p.parameter_type == "boolean":
                            if isinstance(val, str):
                                merged_runtime[p.parameter_name] = val.lower() in ("true", "1", "yes")
                            else:
                                merged_runtime[p.parameter_name] = bool(val)
                    except (ValueError, TypeError):
                        pass
            
            self.execution.runtime_data = merged_runtime
            self.db.commit()

            if passed_runtime_data:
                self.log(f"Starting execution. Merged {len(workflow_params)} defaults with {len(passed_runtime_data)} passed parameters.", level="system")
                self.log(f"Final runtime data: {merged_runtime}", level="system")
            else:
                self.log(f"Starting execution with {len(workflow_params)} default parameters.", level="system")

            # Determine which graph to use: 
            # 1. execution.graph (provided for this specific run) 
            # 2. workflow.graph (fallback to master record)
            graph = None
            if self.execution.graph:
                self.log("Using custom graph provided with execution request (Draft Run).", level="system")
                graph = self.execution.graph
            else:
                self.log("Using master workflow graph from database.", level="system")
                graph = workflow.graph or {"nodes": [], "edges": []}

            nodes = graph.get("nodes", [])
            edges = graph.get("edges", [])
            
            # Debug log counts
            self.log(f"Graph Data: {len(nodes)} nodes, {len(edges)} edges.", level="system")
            print(f"[DEBUG] Executor Nodes: {[n.get('id') for n in nodes[:10]]}")

            # Topological Sort & Reachability check
            # We only execute nodes reachable from the Start node
            start_node = next((n for n in nodes if n.get("data", {}).get("label") == "Start"), None)
            if not start_node:
                self.log("Error: No 'Start' node found in workflow. Cannot execute.", level="error")
                return

            reachable: set = {start_node["id"]}
            changed = True
            while changed:
                changed = False
                for edge in edges:
                    s = edge.get("source")
                    t = edge.get("target")
                    if s in reachable and t not in reachable:
                        reachable.add(t)
                        changed = True

            self.log(f"Reachable Nodes: {len(reachable)} / {len(nodes)}", level="system")
            print(f"[DEBUG] Reachable IDs: {list(reachable)}")
            
            # Filter nodes and edges to only reachable ones
            nodes = [n for n in nodes if n["id"] in reachable]
            edges = [e for e in edges if e.get("source") in reachable and e.get("target") in reachable]

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
            
            all_success = self._run_execution_loop(nodes, edges, node_map, queue, triggered, waiting, outputs)

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
            if 'context_token' in locals():
                execution_context.reset(context_token)
            self.db.close()

    def _run_execution_loop(self, nodes, edges, node_map, queue, triggered, waiting, outputs, manual_node_inputs: dict = None, allow_reexecution: bool = False):
        """
        Runs the dependency-aware execution loop. 
        If manual_node_inputs is provided, it's a mapping of {node_id: inputs_dict} 
        for specific nodes that should receive manual inputs (e.g. from execute_node).
        """
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
                    # Potential stall, but if we are in a sub-execution, it's possible 
                    # we are just waiting for nodes outside this sub-set.
                    self.log(f"Stall or branch completion detected: Nodes {list(waiting)} waiting for unresolved dependencies.", level="system")
                    break
                
                for r in ready_nids:
                    waiting.remove(r)
                    queue.append(r)
                continue

            node_id = queue.pop(0)
            # In sub-executions (branches), we allow re-execution of nodes 
            # if they are part of the new sub_triggered set OR manually specified OR allow_reexecution is True.
            if node_id in outputs and not allow_reexecution and not (manual_node_inputs and node_id in manual_node_inputs):
                continue

            node_edges = [e for e in edges if e.get("target") == node_id]
            side_deps = [e.get("source") for e in node_edges if e.get("targetHandle") and e.get("targetHandle") not in (None, "", "top")]
            
            missing_deps = [s for s in side_deps if s not in outputs]
            if missing_deps:
                waiting.add(node_id)
                continue

            try:
                # Pass manual inputs if this node is the target of a manual trigger
                node_manual_input = manual_node_inputs.get(node_id) if manual_node_inputs else None
                self._execute_node_internal(
                    node_id, nodes, edges, node_map, triggered, queue, waiting, outputs, 
                    manual_inputs=node_manual_input, 
                    allow_reexecution=allow_reexecution
                )
            except Exception as e:
                self.log(f"Error executing node {node_id}: {str(e)}", level="error")
                all_success = False

            self.db.commit()
        return all_success

    def _execute_node_internal(self, node_id, nodes, edges, node_map, triggered, queue, waiting, outputs, manual_inputs: dict = None, allow_reexecution: bool = False):
        self.current_node_id = node_id
        node_data = node_map.get(node_id)
        if not node_data:
            return
        
        node_name = node_data.get("data", {}).get("label", node_id)
        self.log(f"--- Executing Node: {node_name} ({node_id}) ---", level="system")

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

        node_params_inst = None

        try:
            data = node_data.get("data", {})
            node_type_id = data.get("nodeTypeId")
            node_type_name = data.get("nodeType") or data.get("label")
            node_type_category = data.get("category")
            
            node_type = None
            if node_type_id:
                node_type = self.db.query(NodeType).filter(NodeType.id == node_type_id).first()
            
            if not node_type:
                query = self.db.query(NodeType).filter(NodeType.name == node_type_name)
                if node_type_category:
                    query = query.filter(NodeType.category == node_type_category)
                node_type = query.first()
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

            if manual_inputs:
                inputs.update(manual_inputs)
                # Also merge into handle_inputs if any keys match? 
                # For now, let's just merge into the flat 'inputs' dict which is passed to run()


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
            execution_common = copy(SAFE_GLOBALS["common"])
            execution_grok = copy(SAFE_GLOBALS["grok"])

            # Logic for synchronous branch execution (LOOP)
            class WorkflowNamespace:
                def __init__(self, executor, source_node_id, edges, nodes, node_map, outputs):
                    self.executor = executor
                    self.source_node_id = source_node_id
                    self.edges = edges
                    self.nodes = nodes
                    self.node_map = node_map
                    self.outputs = outputs
                    self.runtime = SimpleNamespace()

                def execute_node(self, handle_index, inputs: dict = None):
                    # Support both "then_1" and legacy "than_1"
                    expected_handles = [f"then_{handle_index}", f"than_{handle_index}"]
                    
                    # Find downstream target nodes
                    targets = [
                        e.get("target") for e in self.edges 
                        if e.get("source") == self.source_node_id and 
                        e.get("sourceHandle") in expected_handles
                    ]
                    
                    for target_id in targets:
                        # For synchronous branch execution:
                        # 1. We start a NEW queue from this target
                        sub_queue = [target_id]
                        sub_triggered = {target_id}
                        sub_waiting = set()
                        
                        # 2. We use _run_execution_loop to run the branch to completion
                        # We pass a fresh sub_triggered set but keep the same outputs dict
                        # to allow branch-specific re-execution logic in _run_execution_loop.
                        manual_node_inputs = {target_id: inputs} if inputs else {}
                        
                        self.executor.log(f"Branch execution started from node {target_id} via execute_node({handle_index})", level="system")
                        self.executor._run_execution_loop(
                            self.nodes, self.edges, self.node_map, 
                            sub_queue, sub_triggered, sub_waiting, self.outputs,
                            manual_node_inputs=manual_node_inputs,
                            allow_reexecution=True
                        )
                        self.executor.log(f"Branch execution from node {target_id} completed", level="system")

            node_globals = {
                **SAFE_GLOBALS,
                "__name__": f"<node:{node_id}>",
                "_print_": lambda _getattr_=None: self.NodePrintCollector(self, _getattr_),
                "_getattr_": custom_getattr,
                "_setattr_": Guards.guarded_setattr,
                "_delattr_": Guards.guarded_delattr,
                "__builtins__": {
                    **SAFE_GLOBALS["__builtins__"],
                    "print": self.restricted_print,
                    "__import__": restricted_import
                },
                "libs": execution_libs,
                "openai": execution_openai,
                "common": execution_common,
                "grok": execution_grok,
                "analytics": SimpleNamespace(
                    process_request=analytics.process_analytics_request,
                    process_analytics_request=analytics.process_analytics_request
                ),
                "meta": SimpleNamespace(
                    get_metadata=metadata_lib.get_metadata,
                    get_metadata_by_id=metadata_lib.get_metadata_by_id,
                    get_all_metadata=metadata_lib.get_all_metadata,
                    get_all_client_metadata=metadata_lib.get_all_client_metadata,
                    get_metadata_by_schema=metadata_lib.get_metadata_by_schema,
                    get_client_metadata_by_schema=metadata_lib.get_client_metadata_by_schema,
                    get_owner_metadata_by_schema=metadata_lib.get_owner_metadata_by_schema
                ),
                "metadata": SimpleNamespace(
                    get_metadata=metadata_lib.get_metadata,
                    get_metadata_by_id=metadata_lib.get_metadata_by_id,
                    get_all_metadata=metadata_lib.get_all_metadata,
                    get_all_client_metadata=metadata_lib.get_all_client_metadata,
                    get_metadata_by_schema=metadata_lib.get_metadata_by_schema,
                    get_client_metadata_by_schema=metadata_lib.get_client_metadata_by_schema,
                    get_owner_metadata_by_schema=metadata_lib.get_owner_metadata_by_schema
                ),
                "schema": SimpleNamespace(
                    get_schema_by_key=schema_lib.get_schema_by_key,
                    get_all_schemas=schema_lib.get_all_schemas
                ),
                "agent": SimpleNamespace(
                    run=agent_lib.run,
                    get_agent_hint_by_key=agent_hints_lib.get_agent_hint_by_key,
                    get_agent_hint_and_id_by_key=agent_hints_lib.get_agent_hint_and_id_by_key
                ),
                "prompts": SimpleNamespace(
                    add_prompt=prompt_lib.add_prompt,
                    get_prompts_by_category_with_reference_id=prompt_lib.get_prompts_by_category_with_reference_id,
                    get_prompts_by_category_with_id=prompt_lib.get_prompts_by_category_with_id,
                    delete_prompts_by_period_and_entity=prompt_lib.delete_prompts_by_period_and_entity,
                    delete_prompts_by_period_and_reference_id=prompt_lib.delete_prompts_by_period_and_reference_id
                ),
                "response_data": SimpleNamespace(
                    clear_recent_records_by_entity_and_category=response_lib.clear_recent_records_by_entity_and_category,
                    add_response=response_lib.add_response,
                    update_response_meta=response_lib.update_response_meta,
                    update_response_meta_by_key=response_lib.update_response_meta_by_key,
                    get_responses_by_period_and_category=response_lib.get_responses_by_period_and_category
                ),
                "workflow": WorkflowNamespace(self, node_id, edges, nodes, node_map, outputs),
            }
            
            node_globals["workflow"].runtime.get_data = lambda: runtime_get_data(str(self.execution_id))
            node_globals["workflow"].runtime.set_data = lambda data: runtime_set_data(data, str(self.execution_id))
            node_globals["workflow"].runtime.get_value = lambda key: runtime_get_value(str(self.execution_id), key)

            current_execution_id = str(self.execution_id)
            execution_libs.get_workflow_data = lambda: get_workflow_data(current_execution_id)
            execution_libs.get_runtime_data = lambda: get_runtime_data(current_execution_id)
            execution_libs.get_runtime_schema = lambda: {} # Return empty dict as schema is removed
            execution_libs.update_runtime_data = lambda data: update_runtime_data(current_execution_id, data)
            execution_libs.read_workflow_data = lambda: read_workflow_data(current_execution_id)
            execution_libs.read_runtime_data = lambda: read_runtime_data(current_execution_id)
            execution_libs.write_runtime_data = lambda data: write_runtime_data(data, current_execution_id)
            node_globals["agent"].run = lambda model, tools, hint, task, schema_key=None, **kwargs: agent_lib.run(model, tools, hint, task, schema_key, **kwargs)

            exec(byte_code, node_globals)

            node_params_class = node_globals.get("NodeParameters") or node_globals.get("params")
            if node_params_class and isinstance(node_params_class, type):
                node_params_inst = node_globals.get("nodeParameters") or node_globals.get("params")
                if not node_params_inst or not isinstance(node_params_inst, node_params_class):
                    node_params_inst = node_params_class()
                    node_globals["nodeParameters"] = node_params_inst
                    node_globals["params"] = node_params_inst
                
                # Add dictionary-style access support
                if not hasattr(node_params_class, "__getitem__"):
                    node_params_class.__getitem__ = lambda self, key: getattr(self, key)
                
                if prior_output_value is not None and hasattr(node_params_inst, "Input"):
                    setattr(node_params_inst, "Input", prior_output_value)

            input_params_class = node_globals.get("InputParameters")
            if input_params_class and isinstance(input_params_class, type):
                input_params_inst = node_globals.get("inputParameters")
                if not input_params_inst or not isinstance(input_params_inst, input_params_class):
                    input_params_inst = input_params_class()
                    node_globals["inputParameters"] = input_params_inst
                
                # Add dictionary-style access support
                if not hasattr(input_params_class, "__getitem__"):
                    input_params_class.__getitem__ = lambda self, key: getattr(self, key)
                    
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
            
            result = run_fn(inputs, node_params_inst if node_params_inst is not None else params)
            if not isinstance(result, dict):
                result = {"output": result}

            outputs[node_id] = result
            node_exec.status = WorkflowStatus.success
            # Sanitize before JSON serialization
            node_exec.output = json_sanitize(result)
            self.log(f"Success: {node_name}", level="system")

            # Update cumulative runtime data for live view
            current_runtime = dict(self.execution.runtime_data or {})
            current_runtime.update(json_sanitize(result))
            self.execution.runtime_data = current_runtime
            self.db.commit()

            than_val = None
            max_than = None
            default_output = False
            custom_output = False
            if node_params_inst is not None:
                than_val = getattr(node_params_inst, "THEN", getattr(node_params_inst, "THAN", getattr(node_params_inst, "than", None)))
                max_than = getattr(node_params_inst, "MAX_THEN", getattr(node_params_inst, "MAX_THAN", None))
                default_output = getattr(node_params_inst, "DEFAULT_OUTPUT", False)
                custom_output = getattr(node_params_inst, "CUSTOM_OUTPUT", False)
                self.log(f"  Params extracted: custom_output={custom_output}, default_output={default_output}, max_than={max_than}", level="system")

            for edge in edges:
                if edge.get("source") != node_id:
                    continue
                
                target_id = edge.get("target")
                tgt_handle = edge.get("targetHandle")
                
                if tgt_handle and tgt_handle not in (None, "", "top"):
                    continue

                source_handle = edge.get("sourceHandle")

                is_standard = source_handle in (None, "", "output")
                self.log(f"Evaluating edge {node_id} -> {target_id} (handle: {source_handle}, standard: {is_standard})", level="system")

                if custom_output:
                    # Branching mode active
                    if is_standard and default_output:
                        self.log(f"  [CUSTOM] Allowing standard output because DEFAULT_OUTPUT=True", level="system")
                        pass
                    elif source_handle and (source_handle.startswith("then_") or source_handle.startswith("than_")):
                        try:
                            h_idx = int(source_handle.split('_')[1])
                            if than_val is not None and int(than_val) == h_idx:
                                self.log(f"  [CUSTOM] Allowing branch '{source_handle}' because THEN={than_val}", level="system")
                                pass
                            else:
                                self.log(f"  [CUSTOM] Skipping branch '{source_handle}' (THEN={than_val})", level="system")
                                continue
                        except (ValueError, IndexError, TypeError):
                            self.log(f"  [CUSTOM] Invalid handle format '{source_handle}'", level="warning")
                            continue
                    else:
                        self.log(f"  [CUSTOM] Skipping handle '{source_handle}'", level="system")
                        continue
                else:
                    # Classic mode: ONLY standard output triggers automatically.
                    if not is_standard:
                        self.log(f"  [CLASSIC] Skipping non-standard handle '{source_handle}'", level="system")
                        continue
                    self.log(f"  [CLASSIC] Allowing standard output", level="system")

                # Ignore if target already executed UNLESS re-execution is allowed (LOOP)
                if target_id and (target_id not in outputs or allow_reexecution):
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
            self.log(f"Error {node_name}:\n{str(e)}", level="error")
            raise e


def execute_workflow(execution_id: uuid.UUID):
    """Entry point for background task."""
    executor = WorkflowExecutor(execution_id)
    executor.execute()
