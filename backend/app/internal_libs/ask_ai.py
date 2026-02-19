import os
import google.generativeai as genai
from typing import Optional

def check_ai () -> str:
    return f"Ok. It's work"

def ask_ai(prompt: str, model: str = "gemini-1.5-flash") -> str:
    """
    Internal function to ask Gemini AI a question.
    Requires GEMINI_API_KEY in environment variables.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Error: GEMINI_API_KEY not found in environment variables."
    
    try:
        genai.configure(api_key=api_key)
        model_instance = genai.GenerativeModel(model)
        response = model_instance.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error calling Gemini AI: {str(e)}"
