import os
from google import genai
from .credentials import get_credential_by_model

def check_ai () -> str:
    return f"Ok. It's work!!!!"

def ask_single(prompt: str, model: str = "gemini-2.0-flash") -> str:
    
    """
    Internal function to ask Gemini AI a question.
    Retrieves GEMINI_API_KEY from database credentials.
    """
    api_key = get_credential_by_model(model)
    if not api_key:
        return f"Error: API key for model {model} not found in credentials."
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=model, contents=prompt)
        return response.text
    except Exception as e:
        return f"Error calling Gemini AI: {str(e)}"
