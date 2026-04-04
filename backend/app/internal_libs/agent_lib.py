import json
import re
from typing import Optional, List, Any, Dict, Union
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
    "call_api_function": tools_lib.call_api_function,
}

def prepare_tools(tools: List[Union[str, Dict[str, Any]]], provider: str) -> Dict[str, Any]:
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
    
    # Handle both string identifiers and full dict definitions
    flat_tool_names = [t.lower() if isinstance(t, str) else "" for t in tools]
    auto_search_requested = any(t == "auto-search" for t in flat_tool_names)
    
    for tool in tools:
        if isinstance(tool, dict):
            # Full tool definition (e.g. from ApiRegistry)
            # We don't have a direct function pointer here, 
            # it's handled via resolve_and_call_api in the main loop.
            f_def = tool.get("function", {})
            name = f_def.get("name", "unnamed_tool")
            desc = f_def.get("description", "")
            params = f_def.get("parameters", {})
            params_str = json.dumps(params, ensure_ascii=False) if params else "No parameters required."
            
            tools_desc += f"- {name}: {desc}. Parameters Schema: {params_str}\n"
            # We don't add to allowed_tools_funcs because it's dynamic
            continue

        name = tool.lower()
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
    from .common_lib import resolve_ai_config
    from .agent_providers import get_provider_class
    
    config = resolve_ai_config(model)
    provider_name = config["provider_key"]
    api_key = config["api_key"]
    base_url = config["base_url"]
    
    from .logger_lib import system_log
    system_log(f"[AGENT_LIB] Resolved config for model {model}: provider={provider_name}, has_api_key={bool(api_key)}, base_url={base_url}", level="system")
    
    if not api_key:
        from .credentials import get_credential_by_model
        api_key = get_credential_by_model(model)
        
    if not api_key:
        raise ValueError(f"API key not found for model {model} (provider: {provider_name})")
        
    # Standard overrides if still missing base_url
    if not base_url:
        if provider_name == "perplexity":
            base_url = "https://api.perplexity.ai"
        elif provider_name == "grok":
            base_url = "https://api.x.ai/v1"
        elif provider_name == "deepseek":
            base_url = "https://api.deepseek.com"
        elif provider_name == "groq":
            base_url = "https://api.groq.com/openai/v1"

    if provider_name == "grok":
        # Backward compatibility for old workflows
        if model == "grok-2-latest": model = "grok-2"
    elif provider_name == "gemini":
        if model == "gemini-1.5-flash": model = "gemini-1.5-flash-latest"
        elif model == "gemini-1.5-pro": model = "gemini-1.5-pro-latest"
        
    ProviderClass = get_provider_class(model)
    
    # Specific override for compatible providers
    if provider_name in ["openai_compatible", "local_openai"]:
        from .openai.openai_lib import OpenAICompatibleAgentProvider
        ProviderClass = OpenAICompatibleAgentProvider
        
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
            # Ensure it's not just a string/number that gets parsed as JSON
            if isinstance(parsed, (dict, list)):
                valid_candidates.append((c, parsed))
        except:
            continue
            
    # Priority 1: First dictionary (most likely AgentStep)
    for c, parsed in valid_candidates:
        if isinstance(parsed, dict):
            # Check if it has at least one of the expected keys to avoid false positives
            if "tool_call" in parsed or "final_answer" in parsed:
                return c
            
    # Priority 2: Any dictionary
    for c, parsed in valid_candidates:
        if isinstance(parsed, dict):
            return c
            
    # Priority 3: First list
    for c, parsed in valid_candidates:
        if isinstance(parsed, list):
            return c
            
    # If no valid JSON found, return a sentinel that will trigger a clearer error
    # Instead of returning the plain text which might look like malformed JSON to Pydantic
    return "INVALID_JSON_NO_STRUCTURE_FOUND"

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

    system_prompt = f"""SYSTEM_PROMPT_HEADER:
You are an autonomous AI Agent operating in a structured environment.
Context/Hint: {hint}

OBJECTIVE: {task}

CRITICAL RESPONSE RULES:
1. You MUST respond ONLY with a valid JSON object.
2. DO NOT include any conversational text, introductory remarks, or concluding thoughts.
3. DO NOT use markdown blocks like ```json unless the environment explicitly supports them (prefer pure JSON).
4. If you use grounding/search, DO NOT include citations in the conversational text because THERE SHOULD BE NO CONVERSATIONAL TEXT. Put all your findings into the 'final_answer' or use them to decide the next 'tool_call'.

JSON SCHEMA:
Your response MUST exactly match this JSON schema:
{json.dumps(AgentStep.model_json_schema(), indent=2)}

{schema_instruction}

OPERATIONAL RULES:
1. NEVER narrate your thoughts.
2. If you need a tool, use 'tool_call'. You MUST provide all required parameters in the 'parameters' (or 'arguments') dictionary.
3. Look for IDs in the task or hint. If a client ID is mentioned (e.g., '123-abc'), you MUST pass it to tools like 'get_all_client_metadata'.
4. Do NOT leave 'parameters' empty {{}} if the tool requires arguments.

TOOL CALL EXAMPLE:
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

AVAILABLE TOOLS:
{tools_desc if tools_desc else "No tools available."}
"""

    messages = [
        {"role": "user", "content": task}
    ]

    import inspect
    last_response_raw = None
    for i in range(iteration_limit):
        system_log(f"[AGENT] Iteration {i}", level="system")
        
        try:
            # Delegate response generation to provider
            response_text, response_raw = provider_instance.generate_response(
                messages=messages, 
                system_prompt=system_prompt,
                native_tools=native_tools,
                files=files,
                response_schema=AgentStep.model_json_schema()
            )
            last_response_raw = response_raw

            #system_log(f"[AGENT] AI raw response: {response_text[:300]}...", level="system")
            
            # Robust JSON extraction
            cleaned_json = _extract_json(response_text)
            
            if cleaned_json == "INVALID_JSON_NO_STRUCTURE_FOUND":
                error_msg = "Invalid response: No JSON structure found. You MUST respond ONLY with a valid JSON object matching the schema. Do NOT talk."
                system_log(f"[AGENT] Parsing error: {error_msg}", level="error")
                messages.append({"role": "assistant", "content": response_text})
                messages.append({"role": "user", "content": error_msg})
                continue

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
                
                if t_name in allowed_tools or "__" in t_name:
                    system_log(f"[AGENT] Calling tool: {t_name} with params: {params}", level="system")
                    try:
                        # Case 1: Registry-based tool (api__function)
                        if "__" in t_name:
                            from . import api_registry_lib
                            result = api_registry_lib.resolve_and_call_api(t_name, params)
                            messages.append({"role": "user", "content": f"Tool result: {result}"})
                            continue

                        # Case 2: Static library tool
                        func = allowed_tools[t_name]
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
                "response_raw": last_response_raw,
                "success": False
            }

    return {
        "response_text": "Error: Maximum iterations reached.",
        "response_raw": last_response_raw,
        "success": False
    }
