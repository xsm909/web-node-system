import json
from .openai_lib import _conversations, _system_prompts
from . import openai_lib, gemini_lib, perplexity_lib
from .logger_lib import system_log

def agent_run(model_config, memory_config, tools, prompt, inputs=None, execution_id=None):
    """
    Executes an AI Agent run with model, memory, and tools.
    Supports a loop for tool execution and basic memory persistence.
    """
    provider = model_config.get("provider", "openai").lower() if model_config else "openai"
    model = model_config.get("model", "gpt-4o-mini") if model_config else "gpt-4o-mini"

    # Select the appropriate library based on provider
    if provider == "gemini":
        lib = gemini_lib
        api_key = lib._get_api_key()
    elif provider == "perplexity":
        lib = perplexity_lib
        api_key = lib._get_api_key()
    else:
        lib = openai_lib
        api_key = lib._get_api_key()

    if not api_key:
        return f"Error: API Key for {provider} not found."
    
    # Internal Registry Fallback (System-wide tools)
    from . import tools_lib
    INTERNAL_TOOLS = {
        "calculator": tools_lib.calculator,
        "database": tools_lib.database_query,
        "database_query": tools_lib.database_query,
        "http_request": tools_lib.http_request,
        "http_search": tools_lib.http_search,
        "smart_search": tools_lib.smart_search,
        "google_search": tools_lib.smart_search,
        "web_search": tools_lib.smart_search,
        "read_workflow_data": tools_lib.read_workflow_data,
        "read_runtime_data": tools_lib.read_runtime_data,
        "write_runtime_data": tools_lib.write_runtime_data,
    }
    
    # Flatten and Construct tool descriptions for the system prompt
    allowed_tool_names = set()
    tools_desc = ""
    tool_map = {}
    
    def flatten(items):
        res = []
        if isinstance(items, list):
            for i in items: res.extend(flatten(i))
        elif isinstance(items, dict):
            res.append(items)
        return res

    if tools:
        flat_tools = flatten(tools)
        for tool in flat_tools:
            if not isinstance(tool, dict): continue
            name = tool.get('name')
            if not name: continue
            allowed_tool_names.add(name.lower())
            tools_desc += f"- {name}: {tool.get('description', 'No description provided')}\n"
            tool_map[name] = tool

    # Internal Registry Fallback (System-wide tools) - FILTERED
    from . import tools_lib
    ALL_INTERNAL = {
        "calculator": tools_lib.calculator,
        "database": tools_lib.database_query,
        "database_query": tools_lib.database_query,
        "http_request": tools_lib.http_request,
        "http_search": tools_lib.http_search,
        "smart_search": tools_lib.smart_search,
        "google_search": tools_lib.smart_search,
        "web_search": tools_lib.smart_search,
        "read_workflow_data": tools_lib.read_workflow_data,
        "read_runtime_data": tools_lib.read_runtime_data,
        "write_runtime_data": tools_lib.write_runtime_data,
    }
    
    # Only expose internal tools that are explicitly in the allowed list
    INTERNAL_TOOLS = {k: v for k, v in ALL_INTERNAL.items() if k.lower() in allowed_tool_names}

    # Conditional instructions for the prompt
    search_rule = f"- Use 'smart_search' for any information lookup.\n" if "smart_search" in allowed_tool_names else ""
    wf_data_desc = f"- Use 'read_workflow_data' to see static configuration.\n" if "read_workflow_data" in allowed_tool_names else ""
    rt_data_desc = f"- Use 'read_runtime_data' to see shared dynamic state.\n" if "read_runtime_data" in allowed_tool_names else ""
    wr_data_desc = f"- Use 'write_runtime_data' to update shared dynamic state.\n" if "write_runtime_data" in allowed_tool_names else ""

    system_prompt = f"""You are an autonomous AI Agent.
Objective: {prompt}

RESPONSE FORMAT:
If you need to use a tool, you MUST output ONLY a JSON object in this format:
{{"tool": "tool_name", "parameters": {{"param1": "value1"}}}}

RULES:
1. NEVER narrate your thoughts or explain what you are about to do. 
2. NEVER simulate or hallucinate tool results.
3. If a tool is needed, your response MUST be the JSON tool call and NOTHING ELSE.
4. Only provide a natural language final answer AFTER all necessary tool results have been received.
{search_rule}{wf_data_desc}{rt_data_desc}{wr_data_desc}
Available Tools:
{tools_desc if tools_desc else "No specific tools provided."}
"""
    
    messages = []
    session_id = None
    if memory_config:
        # Isolated memory per execution to avoid state leakage
        if execution_id:
            session_id = f"exec-{execution_id}"
        else:
            session_id = "default-session"
            
        if session_id not in _conversations:
             _conversations[session_id] = []
        
        history = _conversations[session_id]

        # Limit history if it's a window memory
        if memory_config.get("type") == "window":
            size = memory_config.get("size", 5)
            history = history[-(size*2):] # *2 because user+assistant pairs
            
        messages.extend(history)

    messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": str(inputs) if inputs else "Start execution"})

    max_iterations = 20
    last_response = "Agent failed to provide a response."
    
    for i in range(max_iterations):
        system_log(f"[AGENT] Iteration {i} starting...", level="system")
        
        if provider == "gemini":
            # Gemini handles history internally if we use chat.send_message
            # but for the loop we might want more control. 
            # For now, let's use the library's ask_ai pattern or similar request.
            response = lib.ask_ai(session_id or "tmp", inputs if i==0 else messages[-1]["content"], model)
        elif provider == "perplexity":
            # Perplexity is OpenAI-compatible
            response = lib._make_request(api_key, messages, model)
        else:
            # OpenAI
            response = lib._make_request(api_key, messages, model)

        system_log(f"[AGENT] RAW AI Response:\n{response[:500]}{'...' if len(response) > 500 else ''}", level="system")
        messages.append({"role": "assistant", "content": response})
        last_response = response
        
        # 1. Standardize Response (Handle official tool calls)
        active_content = response
        if response.startswith("[") and "function" in response:
            try:
                tcs = json.loads(response)
                if isinstance(tcs, list) and len(tcs) > 0:
                    tc = tcs[0]
                    active_content = json.dumps({
                        "tool": tc.get("function", {}).get("name"),
                        "parameters": json.loads(tc.get("function", {}).get("arguments", "{}"))
                    })
            except: pass

        # 2. Extract JSON using robust greedy search
        import re
        best_data = None
        
        # A. Try direct json.loads first (in case it's pure JSON)
        try:
            trimmed = active_content.strip().strip('\ufeff')
            # Remove potential markdown code block artifacts
            if trimmed.startswith("```"):
                lines = trimmed.splitlines()
                if lines[0].startswith("```"): lines = lines[1:]
                if lines and lines[-1].startswith("```"): lines = lines[:-1]
                trimmed = "\n".join(lines).strip()
            
            data = json.loads(trimmed)
            if isinstance(data, dict) and "tool" in data:
                best_data = data
        except Exception as e:
            pass

        if not best_data:
            # Find all candidates starting with { and ending with }
            # We'll try the longest ones first
            candidates = []
            for match in re.finditer(r'\{', active_content):
                start = match.start()
                for end_match in re.finditer(r'\}', active_content[start:]):
                    candidates.append(active_content[start:start+end_match.end()])
            
            # Sort by length descending to find the "largest" valid JSON
            candidates.sort(key=len, reverse=True)
            
            for candidate in candidates:
                try:
                    data = json.loads(candidate)
                    if isinstance(data, dict) and "tool" in data:
                        best_data = data
                        break
                except: continue
        
        if best_data:
            tool_name = str(best_data["tool"]).lower().strip()
            params = best_data.get("parameters", {})
            system_log(f"[AGENT] Processing tool call: {tool_name}", level="system")
            system_log(f"[AGENT] Tool params: {params}", level="system")
            
            result = f"Error: Tool '{tool_name}' not found."
            
            # Lookup with case-insensitivity and prefix matching
            execute_fn = None
            
            # Check internal registry
            for k, fn in INTERNAL_TOOLS.items():
                if k.lower() == tool_name:
                    execute_fn = fn
                    break
            
            # Check dynamic tool map
            if not execute_fn:
                for k, t in tool_map.items():
                    if k.lower() == tool_name:
                        execute_fn = t.get("execute")
                        break

            if execute_fn and callable(execute_fn):
                try:
                    import inspect
                    # Get the parameters the function expects
                    try:
                        sig = inspect.signature(execute_fn)
                        has_execution_id = "execution_id" in sig.parameters
                        has_model_config = "model_config" in sig.parameters
                    except:
                        # Fallback if signature inspection fails (e.g. built-ins)
                        has_execution_id = False
                        has_model_config = False

                    # Unified Dispatcher
                    if tool_name in ["calculator", "calculate"]:
                        q = params.get("expression") or params.get("query")
                        if not q and not isinstance(params, dict): q = str(params)
                        result = execute_fn(q) if q else "Error: Missing expression"
                    
                    elif tool_name in ["database", "database_query"]:
                        q = params.get("query") or params.get("sql")
                        if not q and not isinstance(params, dict): q = str(params)
                        result = execute_fn(q) if q else "Error: Missing SQL query"
                    
                    elif tool_name in ["google_search", "smart_search", "web_search", "search", "http_search"]:
                        q = params.get("query") or params.get("q") or params.get("parameters")
                        if not q and not isinstance(params, dict): q = str(params)
                        
                        kwargs = {}
                        if has_model_config: kwargs["model_config"] = model_config
                        result = execute_fn(q, **kwargs)
                        
                    elif tool_name in ["read_workflow_data", "read_runtime_data"]:
                        kwargs = {}
                        if has_execution_id: kwargs["execution_id"] = execution_id
                        result = execute_fn(**kwargs)
                        
                    elif tool_name == "write_runtime_data":
                        q = params.get("data") or params.get("json")
                        if not q:
                            if isinstance(params, dict) and params:
                                q = params
                            else:
                                q = str(params)
                        
                        kwargs = {}
                        if has_execution_id: kwargs["execution_id"] = execution_id
                        result = execute_fn(q, **kwargs)
                    else:
                        # Generic tool call
                        kwargs = dict(params) if isinstance(params, dict) else {}
                        if has_execution_id and "execution_id" not in kwargs:
                            kwargs["execution_id"] = execution_id
                        
                        try:
                            # Try calling with expanded params first
                            result = execute_fn(**kwargs)
                        except:
                            # Fallback to single string param
                            result = execute_fn(str(params))
                except Exception as e:
                    result = f"Execution error: {str(e)}"
            else:
                result = f"Error: Tool '{tool_name}' not found or lacks execution function."

            
            system_log(f"[AGENT] Tool Result: {result[:500]}{'...' if len(str(result)) > 500 else ''}", level="system")
            messages.append({"role": "user", "content": f"Tool result: {result}"})
            continue # LOOP AGAIN

        # 3. If no tool found, this is the final answer
        system_log(f"[AGENT] Final answer provided. Response length: {len(response)}", level="system")
        if session_id:
             _conversations[session_id].append({"role": "user", "content": str(inputs) if inputs else "User query"})
             _conversations[session_id].append({"role": "assistant", "content": response})
        return response

    return last_response
