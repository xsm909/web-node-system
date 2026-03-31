import json
import re
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from openai import OpenAI
import jsonschema

from .logger_lib import system_log
from . import metadata_lib
from . import schema_lib
from . import tools_lib
from . import agent_hints_lib

# --- Schemas for Structured Output ---

class ToolCall(BaseModel):
    tool: str = Field(description="Name of the tool to call")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Parameters for the tool. You MUST provide all required parameters based on the tool signature.")
    arguments: Optional[Dict[str, Any]] = Field(None, description="Alias for parameters. You can use either 'parameters' or 'arguments'.")

class AgentStep(BaseModel):
    tool_call: Optional[ToolCall] = Field(None, description="Set this if you need to call a tool")
    final_answer: Any = Field(None, description="Set this ONLY when you have the final result. Must conform to requested schema if provided.")

# --- Library Registry ---

ALL_TOOLS = {
    "get_metadata": metadata_lib.get_metadata,
    "get_metadata_by_id": metadata_lib.get_metadata_by_id,
    "get_all_metadata": metadata_lib.get_all_metadata,
    "get_all_client_metadata": metadata_lib.get_all_client_metadata,
    "get_schema_by_key": schema_lib.get_schema_by_key,
    "get_all_schemas": schema_lib.get_all_schemas,
    "get_agent_hint_by_key": agent_hints_lib.get_agent_hint_by_key,
    "calculator": tools_lib.calculator,
    "database_query": tools_lib.database_query,
    "http_request": tools_lib.http_request,
    "smart_search": tools_lib.smart_search,
}

def prepare_tools(tools: List[str], provider: str) -> Dict[str, Any]:
    """
    Identifies allowed tools, handles auto-search mapping, and generates a description string.
    Returns a dictionary with:
        - 'allowed_tools': dict of functions
        - 'tools_desc': string description
        - 'native_tools': list of native tool configs (grounding, etc.)
    """
    import inspect
    from google.genai import types
    
    allowed_tools_funcs = {}
    tools_desc = ""
    native_tools = []
    
    auto_search_requested = any(t.lower() == "auto-search" for t in tools)
    
    for t_name in tools:
        name = t_name.lower()
        if name == "auto-search":
            continue
            
        # Specific search tool manual overrides
        if name == "google_search" and provider == "gemini":
            native_tools.append(types.Tool(google_search=types.GoogleSearch()))
            tools_desc += f"- {name}: Native Google Search grounding (real-time information)\n"
            continue
            
        if name == "web_search" and provider == "openai":
            native_tools.append({"type": "web_search"})
            tools_desc += f"- {name}: Native Web Search (real-time information)\n"
            continue

        if name in ALL_TOOLS:
            func = ALL_TOOLS[name]
            allowed_tools_funcs[name] = func
            sig = inspect.signature(func)
            doc = func.__doc__.strip() if func.__doc__ else "No description."
            tools_desc += f"- {name}{sig}: {doc}\n"

    # Handle auto-search mapping
    if auto_search_requested:
        if provider == "gemini":
            grounding_tool = types.Tool(google_search=types.GoogleSearch())
            if not any(getattr(t, 'google_search', None) for t in native_tools):
                native_tools.append(grounding_tool)
                tools_desc += f"- auto-search: {provider.title()} Search grounding enabled\n"
        elif provider == "openai":
            web_search_tool = {"type": "web_search"}
            if not any(t.get("type") == "web_search" for t in native_tools):
                native_tools.append(web_search_tool)
                tools_desc += f"- auto-search: {provider.title()} Search enabled\n"
        elif provider in ("perplexity", "grok", "deepseek", "groq"):
             if provider == "grok":
                 native_tools.append({"type": "web_search"})
             tools_desc += f"- auto-search: Enabled (built-in to {provider.title()} models)\n"

    return {
        "allowed_tools": allowed_tools_funcs,
        "tools_desc": tools_desc,
        "native_tools": native_tools
    }

def get_provider(model: str) -> Any:
    """
    Factory to retrieve and initialize the correct provider instance.
    """
    from .credentials import get_credential_by_model
    from .common_lib import GetAIByModel
    from .agent_providers import get_provider_class
    
    provider_name = GetAIByModel(model).lower()
    model_name = model.lower()
    
    api_key = None
    base_url = None
    
    api_key = get_credential_by_model(model)
    base_url = None
    
    if provider_name == "perplexity":
        base_url = "https://api.perplexity.ai"
    elif provider_name == "grok":
        base_url = "https://api.x.ai/v1"
        # Backward compatibility for old workflows
        if model == "grok-2-latest": model = "grok-2"
    elif provider_name == "deepseek":
        base_url = "https://api.deepseek.com"
    elif provider_name == "groq":
        base_url = "https://api.groq.com/openai/v1"
    elif provider_name == "gemini":
        if model == "gemini-1.5-flash": model = "gemini-1.5-flash-latest"
        elif model == "gemini-1.5-pro": model = "gemini-1.5-pro-latest"
        
    if not api_key:
        raise ValueError(f"API key not found for model {model} (provider: {provider_name})")
        
    ProviderClass = get_provider_class(model)
    return ProviderClass(model=model, api_key=api_key, base_url=base_url), provider_name




def _extract_json(text: str) -> str:
    """
    Extracts the first balanced JSON object or array from text.
    Handles trailing garbage and markdown code blocks.
    """
    text = text.strip()
    
    # 1. Handle markdown code blocks if present
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
    if match:
        text = match.group(1).strip()
    
    # 2. Find the first candidate JSON structure
    start_match = re.search(r'[\{\[]', text)
    if not start_match:
        return text
    
    start_pos = start_match.start()
    candidate_text = text[start_pos:]
    
    # 3. Balanced brace/bracket counting with string literal awareness
    brace_count = 0
    bracket_count = 0
    in_string = False
    escape = False
    
    # 4. Try parsing all candidate JSON objects if the first one fails
    # This matches the user's error where '[tysonfoodservice.com]' was found but isn't valid JSON.
    # We look for all potential start positions of { or [
    candidates = []
    for match in re.finditer(r'[\{\[]', text):
        start_pos = match.start()
        current_candidate = text[start_pos:]
        
        brace_count = 0
        bracket_count = 0
        in_string = False
        escape = False
        
        for i, char in enumerate(current_candidate):
            if char == '"' and not escape:
                in_string = not in_string
            if not in_string:
                if char == '{': brace_count += 1
                elif char == '}': brace_count -= 1
                elif char == '[': bracket_count += 1
                elif char == ']': bracket_count -= 1
                
                if brace_count == 0 and bracket_count == 0:
                    candidates.append(current_candidate[:i+1])
                    break
            
            if char == '\\': escape = not escape
            else: escape = False
            
    import json
    # Return the first one that is TRULY valid JSON
    # We prioritize candidates that are dictionaries (objects) over lists
    valid_candidates = []
    for c in candidates:
        try:
            parsed = json.loads(c)
            valid_candidates.append((c, parsed))
        except:
            continue
            
    # Priority 1: First dictionary
    for c, parsed in valid_candidates:
        if isinstance(parsed, dict):
            return c
            
    # Priority 2: First list
    for c, parsed in valid_candidates:
        if isinstance(parsed, list):
            return c
            
    return text

def run(model: str, tools: list, hint: str, task: str, schema_key: str = None, iteration_limit: int = 10, files: list = None):

    # 1. Setup Provider & Tools
    try:
        provider_instance, provider_name = get_provider(model)
    except Exception as e:
        return f"Error: {str(e)}"

    prepared = prepare_tools(tools, provider_name)
    allowed_tools = prepared["allowed_tools"]
    tools_desc = prepared["tools_desc"]
    native_tools = prepared["native_tools"]
    system_log(f"[AGENT] Native tools: {native_tools}", level="system")

    # 2. Target Schema for final_answer
    target_schema = None
    if schema_key:
        schema_str = schema_lib.get_schema_by_key(schema_key)
        if schema_str and schema_str != "null":
            target_schema = json.loads(schema_str)

    # 3. System Prompt
    schema_instruction = ""
    if target_schema:
        schema_instruction = f"\nCRITICAL: Your 'final_answer' MUST conform to this JSON Schema:\n{json.dumps(target_schema, indent=2)}"

    system_prompt = f"""You are an autonomous AI Agent.
Context/Hint: {hint}

OBJECTIVE: {task}

RESPONSE FORMAT:
You MUST respond with a JSON object matching this schema:
{json.dumps(AgentStep.model_json_schema(), indent=2)}

{schema_instruction}

RULES:
1. NEVER narrate your thoughts.
2. If you need a tool, use 'tool_call'. You MUST provide all required parameters in the 'parameters' (or 'arguments') dictionary. If a function signature shows a parameter is required (e.g. 'client_id'), you MUST provide it.
3. Look for IDs in the task or hint. If a client ID is mentioned (e.g., '123-abc'), you MUST pass it to tools like 'get_all_client_metadata'.
4. Do NOT leave 'parameters' empty {{}} if the tool requires arguments.

TOOL CALL EXAMPLE:
If you need to get metadata for client '123-abc':
```json
{{
  "tool_call": {{
    "tool": "get_all_client_metadata",
    "parameters": {{ "client_id": "123-abc" }}
  }}
}}
```

5. If you have the result, use 'final_answer'.
6. Do NOT use both 'tool_call' and 'final_answer' in the same response.
7. For metadata tools, common 'entity_type' values are 'client' or 'manager'.

AVAILABLE TOOLS:
{tools_desc if tools_desc else "No tools available."}
"""

    messages = [
        {"role": "user", "content": task}
    ]

    import inspect
    for i in range(iteration_limit):
        system_log(f"[AGENT] Iteration {i}", level="system")
        
        try:
            # Delegate response generation to provider
            response_text, response_raw = provider_instance.generate_response(
                messages=messages, 
                system_prompt=system_prompt,
                native_tools=native_tools,
                files=files
            )

            #system_log(f"[AGENT] AI raw response: {response_text[:300]}...", level="system")
            
            # Robust JSON extraction
            cleaned_json = _extract_json(response_text)
            
            try:
                step = AgentStep.model_validate_json(cleaned_json)
            except Exception as ve:
                error_msg = f"Invalid JSON response: {str(ve)}. Please ensure you return ONLY a JSON object matching the AgentStep schema. Raw received: {response_text[:200]}"
                system_log(f"[AGENT] Validation error: {error_msg}", level="error")
                messages.append({"role": "assistant", "content": response_text})
                messages.append({"role": "user", "content": error_msg})
                continue
            
            # Save assistant message to history
            messages.append({"role": "assistant", "content": response_text})

            # Handle Tool Call
            if step.tool_call:
                t_name = step.tool_call.tool.lower()
                # Support both 'parameters' and 'arguments' aliases
                params = step.tool_call.parameters or step.tool_call.arguments or {}
                
                if t_name in allowed_tools:
                    func = allowed_tools[t_name]
                    system_log(f"[AGENT] Calling tool: {t_name} with params: {params}", level="system")
                    try:
                        # 1. Inspect function signature to handle parameter mapping
                        sig = inspect.signature(func)
                        bound_params = {}
                        
                        # Optimization: if agent provided 'id' and tool needs something like 'client_id' or 'entity_id'
                        # This is now also handled inside metadata_lib, but we handle it here for ALL tools.
                        remaining_params = params.copy()
                        for p_name, p_param in sig.parameters.items():
                            if p_name in remaining_params:
                                bound_params[p_name] = remaining_params.pop(p_name)
                            elif p_name == "client_id" and "id" in remaining_params:
                                bound_params[p_name] = remaining_params.pop("id")
                            elif p_name == "entity_id" and "id" in remaining_params:
                                bound_params[p_name] = remaining_params.pop("id")
                            elif p_name == "metadata_id" and "id" in remaining_params:
                                bound_params[p_name] = remaining_params.pop("id")
                        
                        # Merge remaining agent params (for **kwargs or extra params)
                        bound_params.update(remaining_params)
                        
                        result = func(**bound_params)
                        messages.append({"role": "user", "content": f"Tool result: {result}"})
                    except Exception as te:
                        error_msg = f"Tool execution error ({t_name}): {str(te)}"
                        system_log(error_msg, level="error")
                        messages.append({"role": "user", "content": error_msg})
                    continue
                else:
                    messages.append({"role": "user", "content": f"Error: Tool '{t_name}' not allowed."})
                    continue

            # Handle Final Answer
            if step.final_answer is not None:
                if target_schema:
                    try:
                        jsonschema.validate(instance=step.final_answer, schema=target_schema)
                        system_log("[AGENT] Final answer validated against schema.", level="system")
                    except Exception as ve:
                        system_log(f"[AGENT] Schema validation failed: {ve}", level="error")
                        messages.append({"role": "user", "content": f"Your final_answer did not match the schema: {ve}. Please fix and try again."})
                        continue
                
                return {
                    "response_text": step.final_answer if isinstance(step.final_answer, str) else json.dumps(step.final_answer, ensure_ascii=False),
                    "response_raw": response_raw,
                    "success": True
                }

        except Exception as e:
            system_log(f"[AGENT] Loop error: {str(e)}", level="error")
            return {
                "response_text": f"Error: {str(e)}",
                "response_raw": response_raw if 'response_raw' in locals() else (response_text if 'response_text' in locals() else None),
                "success": False
            }

    return {
        "response_text": "Error: Maximum iterations reached.",
        "response_raw": None,
        "success": False
    }
