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

def _clean_schema_for_gemini(schema: Any) -> Any:
    """
    Recursively removes 'additionalProperties' and modifies schema for Gemini compatibility.
    Gemini doesn't support 'additionalProperties' in its response schema.
    """
    if isinstance(schema, dict):
        # Remove additionalProperties if it exists
        schema.pop("additionalProperties", None)
        # Process all values recursively
        for key, value in list(schema.items()):
            schema[key] = _clean_schema_for_gemini(value)
    elif isinstance(schema, list):
        # Process all items in the list recursively
        return [_clean_schema_for_gemini(item) for item in schema]
    return schema

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
    
    for i, char in enumerate(candidate_text):
        if char == '"' and not escape:
            in_string = not in_string
        
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
            elif char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1
            
            if brace_count == 0 and bracket_count == 0:
                return candidate_text[:i+1]
        
        if char == '\\':
            escape = not escape
        else:
            escape = False
            
    return text

def run(model: str, tools: list, hint: str, task: str, schema_key: str = None, iteration_limit: int = 10):

    """
    Executes an AI Agent run with pure SDKs and structured JSON output.
    """
    system_log(f"[AGENT] Starting run (Model: {model}, Schema: {schema_key})", level="system")

    # 1. Credentials & Provider
    from .credentials import get_credential_by_key
    provider = "openai"
    model_name = model.lower()
    
    if "gemini" in model_name:
        provider = "gemini"
        api_key = get_credential_by_key("GEMINI_API_KEY") or get_credential_by_key("GEMINI_API") or get_credential_by_key("GEMENI_API")
        if not api_key: return "Error: GEMINI_API_KEY not found."
        
        # Only map short aliases to their latest versions
        if model == "gemini-1.5-flash":
            model = "gemini-1.5-flash-latest"
        elif model == "gemini-1.5-pro":
            model = "gemini-1.5-pro-latest"
            
        client = genai.Client(api_key=api_key)


    else:
        # OpenAI or Perplexity (OpenAI-compatible)
        if "sonar" in model_name or "llama" in model_name: 
            provider = "perplexity"
            api_key = get_credential_by_key("PERPLEXITY_API_KEY")
            base_url = "https://api.perplexity.ai"
        else:
            api_key = get_credential_by_key("OPENAI_API_KEY")
            base_url = None
        
        if not api_key: return f"Error: {provider.upper()}_API_KEY not found."
        client = OpenAI(api_key=api_key, base_url=base_url)

    # 2. Tools setup
    import inspect
    allowed_tools = {}
    tools_desc = ""
    gemini_native_tools = []
    
    for t_name in tools:
        name = t_name.lower()
        
        # Special handling for Gemini native tools
        if provider == "gemini" and name == "google_search":
            gemini_native_tools.append(types.Tool(google_search=types.GoogleSearch()))
            tools_desc += f"- {name}: Native Google Search grounding (real-time information)\n"
            continue

        if name in ALL_TOOLS:
            func = ALL_TOOLS[name]
            allowed_tools[name] = func
            sig = inspect.signature(func)
            doc = func.__doc__.strip() if func.__doc__ else "No description."
            tools_desc += f"- {name}{sig}: {doc}\n"

    # 3. Target Schema for final_answer
    target_schema = None
    if schema_key:
        schema_str = schema_lib.get_schema_by_key(schema_key)
        if schema_str and schema_str != "null":
            target_schema = json.loads(schema_str)

    # 4. System Prompt
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
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": task}
    ]

    
    for i in range(iteration_limit):
        system_log(f"[AGENT] Iteration {i}", level="system")
        
        try:
            if provider == "gemini":
                # Convert messages to Gemini format (simplistic)
                contents = []
                for m in messages:
                    contents.append(types.Content(role="user" if m["role"]=="user" else "model", parts=[types.Part(text=m["content"])]))
                
                # Gemini prefers the JSON schema for complex structures or when cleaning is needed
                cleaned_schema = _clean_schema_for_gemini(AgentStep.model_json_schema())
                
                resp = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        # We skip response_schema for Gemini here because it restricts dynamic dictionaries like 'parameters'
                        # if we don't define every possible key upfront. Prompting is sufficient for JSON structure.
                        system_instruction=system_prompt,
                        tools=gemini_native_tools if gemini_native_tools else None
                    )
                )
                response_text = resp.text
            else:
                # OpenAI / Perplexity
                openai_response_format = {"type": "json_object"}
                if provider == "perplexity":
                    # Perplexity does not support 'json_object' yet (causes 400 error)
                    openai_response_format = {"type": "text"}

                resp = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    response_format=openai_response_format
                )
                response_text = resp.choices[0].message.content

            system_log(f"[AGENT] AI raw response: {response_text[:300]}...", level="system")
            
            # Robust JSON extraction
            cleaned_json = _extract_json(response_text)
            step = AgentStep.model_validate_json(cleaned_json)
            
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
                
                return step.final_answer if isinstance(step.final_answer, str) else json.dumps(step.final_answer, ensure_ascii=False)

        except Exception as e:
            system_log(f"[AGENT] Loop error: {str(e)}", level="error")
            return f"Error: {str(e)}"

    return "Error: Maximum iterations reached."
