import uuid
import json
from typing import Dict, List, Optional
import google.generativeai as genai
from .credentials import get_credential_by_key

# In-memory storage for conversations
_conversations: Dict[str, List[Dict[str, str]]] = {}
_system_prompts: Dict[str, str] = {}

def _get_api_key() -> Optional[str]:
    # Support common spellings
    return get_credential_by_key("GEMINI_API_KEY") or get_credential_by_key("GEMINI_API") or get_credential_by_key("GEMENI_API")

def _setup_genai():
    api_key = _get_api_key()
    if api_key:
        genai.configure(api_key=api_key)
    return api_key

def _convert_to_gemini_history(history: List[Dict[str, str]]) -> List[Dict]:
    """Converts standard {'role': ..., 'content': ...} to Gemini's format."""
    gemini_history = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        gemini_history.append({"role": role, "parts": [msg["content"]]})
    return gemini_history

def create_new_conversation() -> str:
    conv_id = str(uuid.uuid4())
    _conversations[conv_id] = []
    _system_prompts[conv_id] = ""
    return conv_id

def set_prompt(conversation_id: str, prompt: str) -> bool:
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []
    _system_prompts[conversation_id] = prompt
    return True

def ask_ai(conversation_id: str, text: str, model_name: str = "gemini-1.5-flash") -> str:
    api_key = _setup_genai()
    if not api_key:
        return "Error: GEMINI_API_KEY not found in credentials."
        
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []

    history = _conversations[conversation_id]
    system_prompt = _system_prompts.get(conversation_id, "")
    
    try:
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt if system_prompt else None
        )
        
        chat = model.start_chat(history=_convert_to_gemini_history(history))
        response = chat.send_message(text)
        
        answer = response.text
        
        # Update history
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": answer})
        
        return answer
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}"

def ask_AI(text: str, model_name: str = "gemini-1.5-flash") -> str:
    api_key = _setup_genai()
    if not api_key:
        return "Error: GEMINI_API_KEY not found in credentials."
        
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(text)
        return response.text
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}"
