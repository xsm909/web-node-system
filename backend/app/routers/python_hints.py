from fastapi import APIRouter, HTTPException
import json
import os

router = APIRouter(prefix="/python-hints", tags=["Python Hints"])

HINTS_FILE = os.path.join(os.path.dirname(__file__), "..", "resources", "python_hints.json")

@router.get("/")
async def get_python_hints():
    """Returns a list of available python functions and modules for autofill."""
    if not os.path.exists(HINTS_FILE):
        return []
    
    try:
        with open(HINTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read hints: {str(e)}")
