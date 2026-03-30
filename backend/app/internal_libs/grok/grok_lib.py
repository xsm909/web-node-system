import json
import urllib.request
import urllib.error
import uuid
from typing import Any, Dict, List, Optional, Union
from openai import OpenAI
from ..agent_providers import AgentProvider
from ..credentials import get_credential_by_model

# In-memory storage for conversations
_conversations: Dict[str, List[Dict[str, str]]] = {}
_system_prompts: Dict[str, str] = {}

def _get_api_key(model: str) -> Optional[str]:
    return get_credential_by_model(model)

def _make_request(api_key: str, messages: list, model: str) -> str:
    url = "https://api.x.ai/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    data = {
        "model": model,
        "messages": messages
    }
        
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode("utf-8"), 
        headers=headers, 
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        error_info = e.read().decode("utf-8")
        return f"HTTPError {e.code}: {error_info}"
    except Exception as e:
        return f"Error calling Grok API: {str(e)}"

def grok_create_new_conversation() -> str:
    conv_id = str(uuid.uuid4())
    _conversations[conv_id] = []
    _system_prompts[conv_id] = ""
    return conv_id

def grok_set_prompt(conversation_id: str, prompt: str) -> bool:
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []
    _system_prompts[conversation_id] = prompt
    return True

def grok_ask_chat(conversation_id: str, text: str, model: str = "grok-2") -> str:
    api_key = _get_api_key(model)
    if not api_key:
        return f"Error: API key for model {model} not found in credentials."
        
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
    
    if not answer.startswith("Error:") and not answer.startswith("HTTPError"):
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": answer})
        
    return answer

def grok_ask_single(text: str, model: str = "grok-2") -> str:
    api_key = _get_api_key()
    if not api_key:
        return "Error: XAI_API_KEY (or GROK_API_KEY) not found in credentials."
        
    messages = [{"role": "user", "content": text}]
    return _make_request(api_key, messages, model)

def grok_perform_web_search(query: str, model: str = "grok-2") -> str:
    """
    Performs a web search using Grok.
    Grok models typically have real-time access enabled.
    """

class GrokAgentProvider(AgentProvider):
    def generate_response(self, messages: List[Dict[str, str]], system_prompt: str, native_tools: Optional[List[Any]] = None, files: Optional[List[str]] = None) -> str:
        client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        
        # Section 13: Grok uses Responses API for native search tools
        # We pass a list of messages to input to ensure system prompt is prioritized
        input_messages = [{"role": "system", "content": system_prompt}] + messages
            
        kwargs = {
            "model": self.model,
            "input": input_messages
        }
        if native_tools:
            kwargs["tools"] = native_tools
            
        resp = client.responses.create(**kwargs)
        return resp.output_text
