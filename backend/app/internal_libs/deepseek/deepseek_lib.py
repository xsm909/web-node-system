import json
import urllib.request
import urllib.error
import uuid
from typing import Dict, List, Optional, Any, Union
from openai import OpenAI
from ..agent_providers import AgentProvider
from ..credentials import get_credential_by_model

# In-memory storage for conversations
_conversations: Dict[str, List[Dict[str, str]]] = {}
_system_prompts: Dict[str, str] = {}

def _get_api_key(model: str) -> Optional[str]:
    return get_credential_by_model(model)

def _make_request(api_key: str, messages: list, model: str) -> str:
    url = "https://api.deepseek.com/chat/completions"
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
        return f"Error calling DeepSeek API: {str(e)}"

def deepseek_create_new_conversation() -> str:
    conv_id = str(uuid.uuid4())
    _conversations[conv_id] = []
    _system_prompts[conv_id] = ""
    return conv_id

def deepseek_set_prompt(conversation_id: str, prompt: str) -> bool:
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []
    _system_prompts[conversation_id] = prompt
    return True

def deepseek_ask_chat(conversation_id: str, text: str, model: str = "deepseek-chat") -> str:
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

def deepseek_ask_single(text: str, model: str = "deepseek-chat") -> str:
    api_key = _get_api_key(model)
    if not api_key:
        return "Error: DEEPSEEK_API_KEY not found in credentials."
        
    messages = [{"role": "user", "content": text}]
    return _make_request(api_key, messages, model)

class DeepSeekAgentProvider(AgentProvider):
    def generate_response(self, messages: List[Dict[str, str]], system_prompt: str, native_tools: Optional[List[Any]] = None, files: Optional[List[str]] = None) -> str:
        client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        
        # DeepSeek uses standard Chat Completions
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        # Note: native_tools (search) is not yet common via direct API for deepseek
        # but we pass it anyway if it evolves.
        
        resp = client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            response_format={"type": "text"}
        )
        from ..common_lib import safe_json_dumps
        return resp.choices[0].message.content, safe_json_dumps(resp)
