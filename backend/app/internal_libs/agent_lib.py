import json
from .openai_lib import _get_api_key, _make_request, _conversations, _system_prompts

def agent_run(model_config, memory_config, tools, prompt, inputs=None):
    """
    Executes an AI Agent run with model, memory, and tools.
    Supports a loop for tool execution and basic memory persistence.
    """
    api_key = _get_api_key()
    if not api_key:
        return "Error: OPENAI_API_KEY not found."

    model = model_config.get("model", "gpt-4o-mini") if model_config else "gpt-4o-mini"
    
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

    system_prompt = f"""You are an AI Agent with access to tools.
Prompt: {prompt}

Available Tools:
{tools_desc}

If you need to use a tool, respond ONLY with a JSON object:
{{"tool": "tool_name", "parameters": {{"param1": "value1", ...}}}}

After receiving tool results, continue until you have the final answer.
When you have the final answer, respond with it directly (not as JSON).
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
        response = _make_request(api_key, messages, model)
        messages.append({"role": "assistant", "content": response})
        last_response = response
        
        try:
            # Try to parse response as JSON for tool call
            clean_response = response.strip()
            if "```" in clean_response:
                # Extract JSON from code blocks if present
                if "```json" in clean_response:
                    clean_response = clean_response.split("```json")[1].split("```")[0].strip()
                else:
                    clean_response = clean_response.split("```")[1].split("```")[0].strip()

            if clean_response.startswith("{") and clean_response.endswith("}"):
                data = json.loads(clean_response)
                if "tool" in data:
                    tool_name = data["tool"]
                    params = data.get("parameters", {})
                    
                    if tool_name in tool_map:
                        tool = tool_map[tool_name]
                        execute_fn = tool.get("execute")
                        if execute_fn and callable(execute_fn):
                            print(f"Agent executing tool: {tool_name} with {params}")
                            try:
                                # We try to pass arguments based on tool type
                                if tool_name == "calculator" or "expression" in params:
                                    result = execute_fn(params.get("expression", str(params)))
                                elif tool_name == "database" or "query" in params:
                                    result = execute_fn(params.get("query", str(params)))
                                elif tool_name == "http_request":
                                    result = execute_fn(params.get("method", "GET"), params.get("url", ""), params.get("data"))
                                elif tool_name == "google_search" or "query" in params:
                                    result = execute_fn(params.get("query", str(params)))
                                else:
                                    result = execute_fn(**params)
                            except Exception as e:
                                result = f"Tool execution error: {str(e)}"
                        else:
                            result = f"Error: Tool '{tool_name}' has no execute function."
                    else:
                        result = f"Error: Tool '{tool_name}' not found."
                    
                    print(f"Tool result: {result}")
                    messages.append({"role": "user", "content": f"Tool result: {result}"})
                    continue # Loop to let agent process result
        except Exception as e:
            # Not a tool call or parsing failed, assume it's progress or final answer
            pass

        # If it's not a tool call, we assume it's the final answer
        if session_id:
             _conversations[session_id].append({"role": "user", "content": str(inputs) if inputs else "User query"})
             _conversations[session_id].append({"role": "assistant", "content": response})
        
        return response

    return last_response
