import uuid
import json
import logging
import base64
import mimetypes
from typing import Dict, List, Optional, Any
import google.genai as genai
from google.genai import types
from ..credentials import get_credential_by_model

logger = logging.getLogger(__name__)

# In-memory storage for conversations
_conversations: Dict[str, List[Dict[str, str]]] = {}
_system_prompts: Dict[str, str] = {}

def _get_api_key(model: str) -> Optional[str]:
    return get_credential_by_model(model)

def _get_client(model: Optional[str] = None) -> Optional[genai.Client]:
    api_key = _get_api_key(model)
    if api_key:
        client = genai.Client(api_key=api_key)
        # Debug: list available models
        try:
            logger.info("--- Available Gemini Models ---")
            for m in client.models.list():
                logger.info(f"Model: {m.name}, Supported Methods: {m.supported_generation_methods}")
            logger.info("-------------------------------")
        except Exception as e:
            logger.error(f"Error listing models: {e}")
        return client
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
    client = _get_client(model_name)
    if not client:
        return f"Error: API key for model {model_name} not found in credentials."
        
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
    client = _get_client(model_name)
    if not client:
        return f"Error: API key for model {model_name} not found in credentials."
        
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
    client = _get_client(model_name)
    if not client:
        return f"Error: API key for model {model_name} not found in credentials."

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

from ..agent_providers import AgentProvider

def _clean_schema_for_gemini(schema: Any) -> Any:
    """
    Recursively removes 'additionalProperties' and modifies schema for Gemini compatibility.
    Gemini doesn't support 'additionalProperties' in its response schema.
    """
    if isinstance(schema, dict):
        # Remove additionalProperties if it exists
        schema.pop("additionalProperties", None)
        # Process all values recursively
        for key, value in list(schema.items()):
            schema[key] = _clean_schema_for_gemini(value)
    elif isinstance(schema, list):
        # Process all items in the list recursively
        return [_clean_schema_for_gemini(item) for item in schema]
    return schema

class GeminiAgentProvider(AgentProvider):
    def generate_response(self, messages: List[Dict[str, str]], system_prompt: str, native_tools: Optional[List[Any]] = None, files: Optional[List[str]] = None) -> str:
        client = genai.Client(api_key=self.api_key)
        
        # Convert messages to Gemini format
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            parts = [types.Part(text=m["content"])]
            
            # If this is the first message and we have files, attach them
            if m == messages[0] and files:
                for file_path in files:
                    try:
                        mime_type, _ = mimetypes.guess_type(file_path)
                        if not mime_type:
                            mime_type = "application/octet-stream"
                            
                        with open(file_path, "rb") as f:
                            file_data = f.read()
                            
                        parts.append(types.Part(
                            inline_data=types.Blob(
                                mime_type=mime_type,
                                data=base64.b64encode(file_data).decode("utf-8")
                            )
                        ))
                    except Exception as fe:
                        logger.error(f"Error reading file for Gemini: {file_path} - {str(fe)}")
            
            contents.append(types.Content(role=role, parts=parts))
            
        resp = client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                tools=native_tools if native_tools else None,
                response_mime_type="application/json",
                system_instruction=system_prompt
            )
        )
        # return both text and the full technical response as JSON string
        return resp.text, json.dumps(resp.model_dump(), ensure_ascii=False)

