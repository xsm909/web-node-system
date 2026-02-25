import json
import urllib.request
import urllib.error
import uuid
from typing import Dict, List, Optional
from .credentials import get_credential_by_key

# In-memory storage for conversations
_conversations: Dict[str, List[Dict[str, str]]] = {}
_system_prompts: Dict[str, str] = {}

def _get_api_key() -> Optional[str]:
    return get_credential_by_key("OPENAI_API_KEY")

def _make_request(api_key: str, messages: list, model: str, tools: Optional[List[Dict]] = None) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    data = {
        "model": model,
        "messages": messages
    }
    if tools:
        data["tools"] = tools
        
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode("utf-8"), 
        headers=headers, 
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            
            # Check for tool calls first (if we specifically requested them)
            message = result["choices"][0]["message"]
            if message.get("tool_calls"):
                # For web_search_preview, it usually returns the results directly if called correctly,
                # but if it needs a multi-step execution, this simple wrapper might need more logic.
                # However, for the 'preview' search, it often embeds the result or returns content.
                return json.dumps(message.get("tool_calls"))

            return message["content"]
    except urllib.error.HTTPError as e:
        error_info = e.read().decode("utf-8")
        return f"HTTPError {e.code}: {error_info}"
    except Exception as e:
        return f"Error calling OpenAI API: {str(e)}"

def create_new_conversation() -> str:
    """Creates a new conversation and returns its ID."""
    conv_id = str(uuid.uuid4())
    _conversations[conv_id] = []
    _system_prompts[conv_id] = ""
    return conv_id

def set_prompt(conversation_id: str, prompt: str) -> bool:
    """Sets the system prompt for a specific conversation."""
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []
        
    _system_prompts[conversation_id] = prompt
    return True

def ask_ai(conversation_id: str, text: str, model: str = "gpt-4o-mini") -> str:
    """
    Sends a message to the conversation and returns the AI's response.
    """
    api_key = _get_api_key()
    if not api_key:
        return "Error: OPENAI_API_KEY not found in credentials."
        
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []

    history = _conversations[conversation_id]
    
    messages = []
    system_prompt = _system_prompts.get(conversation_id, "")
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
        
    messages.extend(history)
    messages.append({"role": "user", "content": text})
    
    answer = _make_request(api_key, messages, model)
    
    # Check if the request was successful
    if not answer.startswith("Error:") and not answer.startswith("HTTPError"):
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": answer})
        
    return answer

def ask_AI(text: str, model: str = "gpt-4o-mini") -> str:
    """
    Simple version to ask AI a single question without conversation history.
    """
    api_key = _get_api_key()
    if not api_key:
        return "Error: OPENAI_API_KEY not found in credentials."
        
    messages = [{"role": "user", "content": text}]
    return _make_request(api_key, messages, model)

def perform_web_search(query: str) -> str:
    """
    Uses OpenAI's web_search_preview tool to search the internet.
    Note: This requires a model and API key that supports this tool.
    """
    api_key = _get_api_key()
    if not api_key:
        return "Error: OPENAI_API_KEY not found in credentials."
    
    messages = [
        {"role": "system", "content": "You are a helpful assistant with web search capabilities. Answer the user's query by searching the web."},
        {"role": "user", "content": f"Search the web for: {query}"}
    ]
    
    # Define the web_search tool (preview format)
    # Note: The exact name/definition might vary depending on whether it's 'web_search' or 'web_search_preview'
    # Based on common implementations:
    tools = [
        {
            "type": "web_search",
            "web_search": {} # This is the structure for the built-in search tool
        }
    ]
    
    # We use gpt-4o as it's most likely to have this tool enabled
    result = _make_request(api_key, messages, model="gpt-4o", tools=tools)
    
    # Handle the specific 400 error when 'web_search' is not supported
    if "invalid_value" in result and "web_search" in result:
        return "Error: OpenAI Web Search is not supported by your current API key or model. Please use a different tool or provider."
        
    return result
