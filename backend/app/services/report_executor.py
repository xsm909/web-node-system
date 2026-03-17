"""
Sandboxed Python report execution engine.
Uses RestrictedPython to safely execute report logic.
"""
import traceback
import json
import io
import sys
import time
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from RestrictedPython import compile_restricted, safe_globals, safe_builtins, Guards, RestrictingNodeTransformer
import ast
from typing import Any, Dict, Union, List

class SubscriptableNamespace(SimpleNamespace):
    """SimpleNamespace that supports bracket access and dict-like repr."""
    def __getitem__(self, key):
        return getattr(self, key)
    
    def __setitem__(self, key, value):
        setattr(self, key, value)
    
    def __contains__(self, key):
        return hasattr(self, key)
    
    def __repr__(self):
        return repr(vars(self))
    
    def get(self, key, default=None):
        return getattr(self, key, default)
    
    def to_dict(self):
        """Convert back to a dictionary recursively."""
        return {k: (v.to_dict() if isinstance(v, SubscriptableNamespace) else v) for k, v in vars(self).items()}

from ..internal_libs.ask_ai import ask_single, check_ai
from ..internal_libs.openai import openai_lib
from ..internal_libs.gemini import gemini_lib
from ..internal_libs.perplexity import perplexity_lib
from ..internal_libs import agent_lib
from ..internal_libs import common_lib
from ..internal_libs.tools_lib import (
    calculator, database_query, http_request, http_search, 
    smart_search
)
from ..internal_libs import database_lib
from ..internal_libs import analytics
from ..internal_libs import metadata_lib
from ..internal_libs import schema_lib
from ..internal_libs import agent_hints_lib
from ..internal_libs import prompt_lib
from ..internal_libs import response_lib
from ..internal_libs.context_lib import execution_context
from ..internal_libs.logger_lib import executor_logger

def generate_json_schema(data: Any) -> Dict[str, Any]:
    """
    Generate a basic JSON Schema from data.
    """
    if data is None:
        return {"type": "null"}
    if isinstance(data, list):
        if not data:
            return {"type": "array", "items": {}}
        return {"type": "array", "items": generate_json_schema(data[0])}
    if isinstance(data, dict):
        properties = {k: generate_json_schema(v) for k, v in data.items()}
        return {"type": "object", "properties": properties}
    if isinstance(data, bool):
        return {"type": "boolean"}
    if isinstance(data, (int, float)):
        return {"type": "number"}
    if isinstance(data, str):
        return {"type": "string"}
    return {"type": "any"}

def dict_to_namespace(d):
    """Convert dict to SubscriptableNamespace recursively."""
    if isinstance(d, dict):
        return SubscriptableNamespace(**{k: dict_to_namespace(v) for k, v in d.items()})
    if isinstance(d, list):
        return [dict_to_namespace(v) for v in d]
    return d

def _inplace_handler(op, target, *args):
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
        "getattr": getattr,
        "hasattr": hasattr,
        "setattr": setattr,
        "delattr": delattr,
        "_iter_unpack_sequence_": Guards.guarded_iter_unpack_sequence,
        "_getiter_": iter,
        "_getitem_": lambda obj, key: obj[key],
        "_write_": lambda obj: obj,
        "_apply_": lambda f, *a, **kw: f(*a, **kw),
        "_inplacevar_": _inplace_handler,
        "_inplaceitem_": _inplace_handler,
    },
    "json": json,
    "time": time,
    "datetime": datetime,
    "timedelta": timedelta,
    "libs": SimpleNamespace(
        ask_ai=ask_single,
        check_ai=check_ai,
        calculator=calculator,
        database_query=database_query,
        http_request=http_request,
        http_search=http_search,
        smart_search=smart_search,
    ),
    "openai": SimpleNamespace(
        create_new_conversation=openai_lib.openai_create_new_conversation,
        set_prompt=openai_lib.openai_set_prompt,
        ask_chat=openai_lib.openai_ask_chat,
        ask_single=openai_lib.openai_ask_single,
        perform_web_search=openai_lib.openai_perform_web_search,
    ),
    "gemini": SimpleNamespace(
        create_new_conversation=gemini_lib.gemini_create_new_conversation,
        set_prompt=gemini_lib.gemini_set_prompt,
        ask_chat=gemini_lib.gemini_ask_chat,
        ask_single=gemini_lib.gemini_ask_single,
        perform_web_search=gemini_lib.gemini_perform_web_search,
    ),
    "perplexity": SimpleNamespace(
        create_new_conversation=perplexity_lib.perplexity_create_new_conversation,
        set_prompt=perplexity_lib.perplexity_set_prompt,
        ask_chat=perplexity_lib.perplexity_ask_chat,
        ask_single=perplexity_lib.perplexity_ask_single,
        perform_web_search=perplexity_lib.perplexity_perform_web_search,
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
        get_agent_hint_by_key=agent_hints_lib.get_agent_hint_by_key
    ),
    "prompts": SimpleNamespace(
        add_prompt=prompt_lib.add_prompt,
        get_prompts_by_category_with_reference_id=prompt_lib.get_prompts_by_category_with_reference_id,
        get_prompts_by_category_with_id=prompt_lib.get_prompts_by_category_with_id,
        delete_prompts_by_period=prompt_lib.delete_prompts_by_period
    ),
    "response_data": SimpleNamespace(
        clear_recent_records_by_entity_and_category=response_lib.clear_recent_records_by_entity_and_category,
        add_response=response_lib.add_response,
        update_response_meta=response_lib.update_response_meta,
        update_response_meta_by_key=response_lib.update_response_meta_by_key,
        get_responses_by_period_and_category=response_lib.get_responses_by_period_and_category
    ),
}

ALLOWED_MODULES = [
    "math", "json", "datetime", "re", "random", 
    "base64", "hashlib", "time", "collections", 
    "itertools", "functools", "decimal", "statistics"
]

def restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
    if name in ALLOWED_MODULES:
        return __import__(name, globals, locals, fromlist, level)
    raise ImportError(f"Module '{name}' is not allowed in the report sandbox.")

class ReportTransformer(RestrictingNodeTransformer):
    """Custom RestrictedPython transformer to allow type annotations in assignments."""

    def visit_AnnAssign(self, node):
        """Allow AnnAssign (type annotated assignments) by converting them to regular assignments."""
        value = node.value
        if value is None:
            value = ast.copy_location(ast.Constant(value=None), node)
        
        assign_node = ast.copy_location(
            ast.Assign(
                targets=[node.target],
                value=value
            ),
            node
        )
        return self.visit_Assign(assign_node)

def safe_call_hook(fn, *args):
    """Call a hook function with as many arguments as it accepts (max len(args))."""
    try:
        # Try full arguments first
        return fn(*args)
    except TypeError as e:
        msg = str(e)
        if "takes" in msg and "positional argument" in msg:
            # Try with fewer arguments if it failed due to argument count
            # This is a bit heuristic but common for this type of plugin system
            if len(args) > 1:
                try:
                    return fn(*args[:-1])
                except TypeError:
                    pass
        raise

class ReportExecutor:
    class ReportPrintCollector:
        def __init__(self, executor, _getattr_=None):
            self.executor = executor

        def _call_print(self, *args):
            self.executor._restricted_print(*args)

        def write(self, data):
            if data.strip():
                self.executor._restricted_print(data)

    def __init__(self, code: str):
        self.code = code
        self.console_output = io.StringIO()

    def _restricted_print(self, *args, **kwargs):
        print(*args, **kwargs, file=self.console_output)

    def log(self, message: str, level: str = "info"):
        self._restricted_print(f"[{level.upper()}] {message}")

    def execute(self, parameters: dict, mode: str, user_context: dict = None, execution_id: str = None):
        """
        mode: 'is_design' or 'is_run'
        user_context: dict with user details (id, name, email, role, etc.)
        """
        token = None
        log_token = None
        if execution_id:
            token = execution_context.set(execution_id)
        log_token = executor_logger.set(self.log)
        
        try:
            byte_code = compile_restricted(
                self.code,
                "<report>",
                "exec",
                policy=ReportTransformer
            )

            params_namespace = dict_to_namespace(parameters)

            node_globals = {
                **SAFE_GLOBALS,
                "__name__": "<report>",
                "_print_": lambda _getattr_=None: self.ReportPrintCollector(self, _getattr_),
                "_getattr_": custom_getattr,
                "_setattr_": Guards.guarded_setattr,
                "_delattr_": Guards.guarded_delattr,
                "UserExecutor": dict_to_namespace(user_context) if user_context else None,
                "ReportExecutor": SubscriptableNamespace(id=execution_id) if execution_id else None,
                "report_parameters": params_namespace,
                "ReportParameters": params_namespace,
                "parameters": params_namespace, # Alias for backward compatibility
                "__builtins__": {
                    **SAFE_GLOBALS["__builtins__"],
                    "print": self._restricted_print,
                    "__import__": restricted_import
                },
            }

            exec(byte_code, node_globals)

            # 1. Process Parameters
            params_proc_fn = node_globals.get("ParametersProcessing")
            params_reason = None
            if not params_proc_fn:
                processed_params = params_namespace
                params_success = True
            else:
                # ParametersProcessing can return (SimpleNamespace, bool, str)
                proc_result = safe_call_hook(params_proc_fn, params_namespace, mode)
                if isinstance(proc_result, tuple):
                    if len(proc_result) >= 3:
                        processed_params, params_success, params_reason = proc_result[:3]
                    elif len(proc_result) == 2:
                        processed_params, params_success = proc_result
                    else:
                        processed_params = proc_result[0]
                        params_success = True
                else:
                    processed_params = proc_result
                    params_success = True

            if not params_success:
                return {
                    "success": False,
                    "error": params_reason or "Parameters validation failed in ParametersProcessing",
                    "validation_reason": params_reason,
                    "console": self.console_output.getvalue()
                }

            # 2. Generate Report
            gen_report_fn = node_globals.get("GenerateReport")
            if not gen_report_fn:
                return {
                    "success": False,
                    "error": "GenerateReport function is missing",
                    "console": self.console_output.getvalue()
                }

            gen_reason = None
            result = safe_call_hook(gen_report_fn, processed_params, mode)
            
            # Support (data, success, reason), (data, success) and just data
            if isinstance(result, tuple):
                if len(result) >= 3:
                    result_data, gen_success, gen_reason = result[:3]
                elif len(result) == 2:
                    result_data, gen_success = result
                else:
                    result_data = result[0]
                    gen_success = True
            else:
                result_data = result
                gen_success = True

            if not gen_success:
                return {
                    "success": False,
                    "error": gen_reason or "GenerateReport failed",
                    "validation_reason": gen_reason,
                    "console": self.console_output.getvalue()
                }

            return {
                "success": True,
                "data": result_data,
                "console": self.console_output.getvalue()
            }

        except Exception as e:
            traceback.print_exc(file=self.console_output)
            return {
                "success": False,
                "error": str(e),
                "console": self.console_output.getvalue()
            }
        finally:
            executor_logger.reset(log_token)
            if token:
                execution_context.reset(token)
