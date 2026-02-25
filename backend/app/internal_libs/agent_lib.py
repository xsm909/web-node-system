import json
from .openai_lib import _get_api_key, _make_request, _conversations, _system_prompts
from .logger_lib import system_log

def agent_run(model_config, memory_config, tools, prompt, inputs=None):
    """
    Executes an AI Agent run with model, memory, and tools.
    Supports a loop for tool execution and basic memory persistence.
    """
    api_key = _get_api_key()
    if not api_key:
        return "Error: OPENAI_API_KEY not found."

    model = model_config.get("model", "gpt-4o-mini") if model_config else "gpt-4o-mini"
    
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
        "save_ai_result": tools_lib.save_ai_result,
        "database_save": tools_lib.save_ai_result,
    }
    
    # Construct tool descriptions for the system prompt
    tools_desc = ""
    tool_map = {}
    if tools:
        # If it's a single tool, convert to list
        if isinstance(tools, dict) and "name" in tools:
            tools = [tools]
        
        if isinstance(tools, list):
            for tool in tools:
                if not isinstance(tool, dict): continue
                name = tool.get('name')
                tools_desc += f"- {name}: {tool.get('description')}\n"
                tool_map[name] = tool

    system_prompt = f"""You are an autonomous AI Agent with access to specialized tools.
Goal: {prompt}

CRITICAL RULES:
1. NEVER simulate or hallucinate tool results. You MUST call the real tool and wait for the "Tool result:" message.
2. If you need to search, use 'smart_search'.
3. If you need to save to a database, use 'save_ai_result' with the information you found.
4. If you are taking an action, your response MUST be ONLY a JSON object. No conversational filler.
5. Provide a final natural language answer ONLY after you have received all tool results.

Available Tools:
{tools_desc}
- save_ai_result: Saves search results or data to the database.

Action Format:
{{"tool": "tool_name", "parameters": {{"param1": "value1"}}}}
"""
    
    # Handle conversation history if memory is provided
    messages = []
    session_id = None
    if memory_config:
        # In this simple implementation, we'll use a fixed session ID for the execution
        # In a real n8n-like system, this would come from the workflow state
        session_id = "workflow-execution-session" 
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

    max_iterations = 5
    last_response = "Agent failed to provide a response."
    
    for i in range(max_iterations):
        system_log(f"[AGENT] Iteration {i} starting...", level="system")
        response = _make_request(api_key, messages, model)
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
                        
                        import inspect
                        try:
                            sig = inspect.signature(execute_fn)
                            if "model_config" in sig.parameters:
                                result = execute_fn(q, model_config=model_config)
                            else:
                                result = execute_fn(q)
                        except:
                            result = execute_fn(q)
                    else:
                        try: result = execute_fn(**params)
                        except: result = execute_fn(str(params))
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
