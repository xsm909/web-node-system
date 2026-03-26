import json
import urllib.request
import urllib.error
import uuid
from openai import OpenAI
from typing import Dict, List, Optional, Any, Union
from ..credentials import get_credential_by_key

# In-memory storage for conversations
_conversations: Dict[str, List[Dict[str, str]]] = {}
_system_prompts: Dict[str, str] = {}

def _get_api_key() -> Optional[str]:
    return get_credential_by_key("OPENAI_API_KEY")

def _make_request(api_key: str, messages: list, model: str, tools: Optional[List[Dict]] = None, timeout: int = 60) -> str:
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
        with urllib.request.urlopen(req, timeout=timeout) as response:
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

def openai_create_new_conversation() -> str:
    """Creates a new conversation and returns its ID."""
    conv_id = str(uuid.uuid4())
    _conversations[conv_id] = []
    _system_prompts[conv_id] = ""
    return conv_id

def openai_set_prompt(conversation_id: str, prompt: str) -> bool:
    """Sets the system prompt for a specific conversation."""
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []
        
    _system_prompts[conversation_id] = prompt
    return True

def openai_ask_chat(conversation_id: str, text: str, model: str = "gpt-5.2") -> str:
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

def openai_ask_single(text: str, model: str = "gpt-4o-mini", timeout: int = 60) -> str:
    """
    Simple version to ask AI a single question without conversation history.
    """
    api_key = _get_api_key()
    if not api_key:
        return "Error: OPENAI_API_KEY not found in credentials."
        
    messages = [{"role": "user", "content": text}]
    return _make_request(api_key, messages, model, timeout=timeout)

def openai_perform_web_search(query: str, model: str = "gpt-5.2") -> str:
    
    api_key = _get_api_key()
    if not api_key:
        return "Error: OPENAI_API_KEY not found in credentials."
    client = OpenAI(api_key=api_key)

    response = client.responses.create(
        model="gpt-5",
        tools=[{"type": "web_search"}],
        input=query,
        reasoning={"effort": "low"}
    )

from ..agent_providers import AgentProvider

class OpenAIAgentProvider(AgentProvider):
    def generate_response(self, messages: List[Dict[str, str]], system_prompt: str, native_tools: Optional[List[Any]] = None, files: Optional[List[str]] = None) -> str:
        client = OpenAI(api_key=self.api_key)
        
        # Section 13: OpenAI responses.create pattern
        formatted_input = ""
        for m in messages:
            prefix = "User: " if m["role"] == "user" else "Assistant: "
            formatted_input += f"{prefix}{m['content']}\n"
            
        resp = client.responses.create(
            model=self.model,
            tools=native_tools if native_tools else None,
            input=formatted_input.strip()
        )
        return resp.output_text
