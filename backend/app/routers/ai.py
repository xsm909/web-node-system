from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
import os
import re
import json
from ..core.database import get_db
from ..core.security import require_role, get_current_user
from ..internal_libs.openai.openai_lib import openai_ask_single
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["ai"])
manager_access = Depends(require_role("manager", "admin"))

class AIGenerateRequest(BaseModel):
    prompt: str
    hint_type: str # e.g., 'sql', 'task_analytics'
    model: str = "gpt-4o"
    is_modify: bool = False
    context: Optional[Dict[str, Any]] = None

class AIGenerateResponse(BaseModel):
    result: Any

@router.post("/generate", response_model=AIGenerateResponse)
def generate_ai_content(
    data: AIGenerateRequest, 
    db: Session = Depends(get_db), 
    _=manager_access
):
    valid_hints = ["sql", "task_analytics", "report_template"]
    if data.hint_type not in valid_hints:
         raise HTTPException(status_code=400, detail=f"Invalid hint_type. Allowed: {', '.join(valid_hints)}")

    prompt_text = data.prompt
    if not prompt_text:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
        
    # Read context from hints directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    hints_path = os.path.join(current_dir, "..", "schemas", "ai_hints", f"{data.hint_type}.md")
    
    hints_content = ""
    try:
        if os.path.exists(hints_path):
            with open(hints_path, "r") as f:
                hints_content = f.read()
        else:
            hints_content = "No specific instructions provided for this topic."
    except Exception as e:
        print(f"Error reading hints at {hints_path}: {e}")
        hints_content = "Generic assistant mode."

    additional_context = ""
    if data.context:
        additional_context = f"\nADDITIONAL CONTEXT: {json.dumps(data.context)}"

    if data.is_modify:
        ai_prompt = f"""
        You are an expert assistant. 
        Please MODIFY the existing content based on the user's request.
        
        INSTRUCTIONS & GUIDELINES:
        {hints_content}
        
        {additional_context}
        
        USER MODIFICATION REQUEST:
        {prompt_text}
        
        IMPORTANT:
        - Output ONLY the modified content in the expected format (plain text, JSON, or SQL as per instructions).
        - No markdown formatting, no code blocks, no explanations.
        """
    else:
        ai_prompt = f"""
        You are an expert assistant. 
        Please create new content based on the following user prompt.
        
        INSTRUCTIONS & GUIDELINES:
        {hints_content}
        
        {additional_context}
        
        USER PROMPT:
        {prompt_text}
        
        IMPORTANT:
        - Output ONLY the generated content in the expected format (plain text, JSON, or SQL as per instructions).
        - No markdown formatting, no code blocks, no explanations.
        """
    
    response_text = openai_ask_single(ai_prompt, data.model, timeout=120)
    
    if response_text.startswith("Error:") or response_text.startswith("HTTPError"):
        raise HTTPException(status_code=500, detail=response_text)
        
    # Clean up response
    clean_text = response_text
    # Common code block cleanups
    clean_text = re.sub(r'^```(sql|json|html|jinja2|j2)?\n', '', clean_text, flags=re.IGNORECASE | re.MULTILINE)
    clean_text = re.sub(r'```$', '', clean_text, flags=re.MULTILINE)
    clean_text = clean_text.strip()
    
    # If hint_type suggests JSON, try parsing
    if data.hint_type.startswith('task'):
        try:
            return {"result": json.loads(clean_text)}
        except:
             return {"result": clean_text}
             
    return {"result": clean_text}
