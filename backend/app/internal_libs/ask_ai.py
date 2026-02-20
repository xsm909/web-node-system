import os
import google.generativeai as genai
from .credentials import get_credential_by_key

def check_ai () -> str:
    return f"Ok. It's work!!!!"

def ask_ai(prompt: str, model: str = "gemini-2.0-flash") -> str:
    
    """
    Internal function to ask Gemini AI a question.
    Retrieves GEMINI_API_KEY from database credentials.
    """
    api_key = get_credential_by_key("GEMINI_API_KEY")
    if not api_key:
        # Fallback to env var for backward compatibility during transition
        return "Error api key not found"
        
    if not api_key:
        return "Error: GEMINI_API_KEY not found in database or environment variables."
    
    try:
        genai.configure(api_key=api_key)
        model_instance = genai.GenerativeModel(model)
        response = model_instance.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error calling Gemini AI: {str(e)}"
