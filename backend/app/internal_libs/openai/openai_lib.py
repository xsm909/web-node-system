import json
import urllib.request
import urllib.error
import uuid
from openai import OpenAI
from typing import Dict, List, Optional, Any, Union
from ..credentials import get_credential_by_model

# In-memory storage for conversations
_conversations: Dict[str, List[Dict[str, str]]] = {}
_system_prompts: Dict[str, str] = {}

def _get_ai_config(model: str) -> Dict[str, Any]:
    from ..common_lib import resolve_ai_config
    return resolve_ai_config(model)

def _make_request(api_key: str, messages: list, model: str, tools: Optional[List[Dict]] = None, timeout: int = 60, base_url: Optional[str] = None) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    if base_url:
        # Normalize base_url
        if "://" not in base_url:
            base_url = f"http://{base_url}"
        if not base_url.rstrip("/").endswith("/v1"):
            base_url = base_url.rstrip("/") + "/v1"
        url = f"{base_url.rstrip('/')}/chat/completions"

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
    config = _get_ai_config(model)
    api_key = config.get("api_key")
    base_url = config.get("base_url")

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
    
    answer = _make_request(api_key, messages, model, base_url=base_url)
    
    # Check if the request was successful
    if not answer.startswith("Error:") and not answer.startswith("HTTPError"):
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": answer})
        
    return answer

def openai_ask_single(text: str, model: str = "gpt-4o-mini", timeout: int = 60) -> str:
    """
    Simple version to ask AI a single question without conversation history.
    """
    config = _get_ai_config(model)
    api_key = config.get("api_key")
    base_url = config.get("base_url")

    if not api_key:
        return f"Error: API key for model {model} not found in credentials."
        
    messages = [{"role": "user", "content": text}]
    return _make_request(api_key, messages, model, timeout=timeout, base_url=base_url)

def openai_perform_web_search(query: str, model: str = "gpt-5.2") -> str:
    
    config = _get_ai_config(model)
    api_key = config.get("api_key")
    base_url = config.get("base_url")

    if not api_key:
        return f"Error: API key for model {model} not found in credentials."
    
    # Normalize base_url
    final_base_url = None
    if base_url:
        if "://" not in base_url:
            base_url = f"http://{base_url}"
        if not base_url.rstrip("/").endswith("/v1"):
            base_url = base_url.rstrip("/") + "/v1"
        final_base_url = base_url

    client = OpenAI(api_key=api_key, base_url=final_base_url)

    response = client.responses.create(
        model="gpt-5",
        tools=[{"type": "web_search"}],
        input=query,
        reasoning={"effort": "low"}
    )

from ..agent_providers import AgentProvider
from ..logger_lib import system_log

class OpenAIAgentProvider(AgentProvider):
    def generate_response(self, messages: List[Dict[str, str]], system_prompt: str, native_tools: Optional[List[Any]] = None, files: Optional[List[str]] = None) -> tuple[str, str]:
        # Normalize base_url (ensure protocol)
        final_base_url = self.base_url
        if final_base_url and "://" not in final_base_url:
            final_base_url = f"http://{final_base_url}"
        
        system_log(f"[OPENAI_PROVIDER] Initializing client for model {self.model} with base_url: {final_base_url or 'DEFAULT (OpenAI)'}", level="system")
        
        # Mask API key for logs
        masked_key = f"{self.api_key[:6]}...{self.api_key[-4:]}" if self.api_key else "None"
        system_log(f"[OPENAI_PROVIDER] Using API Key: {masked_key}", level="system")

        client = OpenAI(api_key=self.api_key, base_url=final_base_url)
        
        # Section 13: OpenAI responses.create pattern
        # Including system prompt ensures models follow the JSON schema rules
        input_messages = [{"role": "system", "content": system_prompt}] + messages
            
        system_log(f"[OPENAI_PROVIDER] Sending request to {final_base_url or 'https://api.openai.com/v1'}", level="system")
        
        resp = client.responses.create(
            model=self.model,
            tools=native_tools if native_tools else None,
            input=input_messages
        )
        from ..common_lib import safe_json_dumps
        return resp.output_text, safe_json_dumps(resp)

class OpenAICompatibleAgentProvider(AgentProvider):
    def generate_response(self, messages: List[Dict[str, str]], system_prompt: str, native_tools: Optional[List[Any]] = None, files: Optional[List[str]] = None) -> tuple[str, str]:
        # Normalize base_url (ensure protocol and /v1)
        final_base_url = self.base_url
        if final_base_url and "://" not in final_base_url:
            final_base_url = f"http://{final_base_url}"
        
        # Auto-append /v1 if missing
        if final_base_url and not final_base_url.rstrip("/").endswith("/v1"):
            final_base_url = final_base_url.rstrip("/") + "/v1"
            
        system_log(f"[COMPATIBLE_PROVIDER] Initializing client for model {self.model} with base_url: {final_base_url}", level="system")
        
        client = OpenAI(api_key=self.api_key, base_url=final_base_url)
        
        # Build messages for standard chat completion
        input_messages = [{"role": "system", "content": system_prompt}] + messages
            
        system_log(f"[COMPATIBLE_PROVIDER] Sending request to {final_base_url}/chat/completions", level="system")
        
        try:
            resp = client.chat.completions.create(
                model=self.model,
                messages=input_messages,
                tools=native_tools if native_tools else None,
            )
            
            if not resp or not resp.choices or len(resp.choices) == 0:
                raise ValueError(f"Empty response from server at {final_base_url}")
                
            content = resp.choices[0].message.content
            
            # Create a proxy object to match 'response.output_text' pattern if needed elsewhere
            from ..common_lib import safe_json_dumps
            return content, safe_json_dumps(resp)
        except Exception as e:
            system_log(f"[COMPATIBLE_PROVIDER] Error: {str(e)}", level="error")
            raise e
