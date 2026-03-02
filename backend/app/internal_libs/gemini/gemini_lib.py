import uuid
import json
from typing import Dict, List, Optional
import google.genai as genai
from google.genai import types
from ..credentials import get_credential_by_key

# In-memory storage for conversations
_conversations: Dict[str, List[Dict[str, str]]] = {}
_system_prompts: Dict[str, str] = {}

def _get_api_key() -> Optional[str]:
    # Support common spellings
    return get_credential_by_key("GEMINI_API_KEY") or get_credential_by_key("GEMINI_API") or get_credential_by_key("GEMENI_API")

def _get_client() -> Optional[genai.Client]:
    api_key = _get_api_key()
    if api_key:
        return genai.Client(api_key=api_key)
    return None

def gemini_create_new_conversation() -> str:
    conv_id = str(uuid.uuid4())
    _conversations[conv_id] = []
    _system_prompts[conv_id] = ""
    return conv_id

def gemini_set_prompt(conversation_id: str, prompt: str) -> bool:
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []
    _system_prompts[conversation_id] = prompt
    return True

def gemini_ask_chat(conversation_id: str, text: str, model_name: str = "gemini-1.5-flash") -> str:
    client = _get_client()
    if not client:
        return "Error: GEMINI_API_KEY not found in credentials."
        
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []

    history = _conversations[conversation_id]
    system_prompt = _system_prompts.get(conversation_id, "")
    
    try:
        # Convert history for the new SDK
        content_history = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            content_history.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
            
        config = types.GenerateContentConfig(
            system_instruction=system_prompt if system_prompt else None
        )
        
        chat = client.chats.create(model=model_name, config=config, history=content_history)
        response = chat.send_message(text)
        
        answer = response.text
        
        # Update history
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": answer})
        
        return answer
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}"

def gemini_ask_single(text: str, model_name: str = "gemini-1.5-flash") -> str:
    client = _get_client()
    if not client:
        return "Error: GEMINI_API_KEY not found in credentials."
        
    try:
        response = client.models.generate_content(model=model_name, contents=text)
        return response.text
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}"

def gemini_perform_web_search(query: str, model_name: str = "gemini-2.0-flash") -> str:
    """
    Performs a web search using Gemini with Google Search grounding tool.
    Returns the model's response grounded in real-time search results.
    """
    client = _get_client()
    if not client:
        return "Error: GEMINI_API_KEY not found in credentials."

    try:
        grounding_tool = types.Tool(
            google_search=types.GoogleSearch()
        )
        config = types.GenerateContentConfig(
            tools=[grounding_tool]
        )
        response = client.models.generate_content(
            model=model_name,
            contents=query,
            config=config
        )
        return response.text
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}"
