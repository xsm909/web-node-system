import sys
import os

# Add current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

try:
    from app.main import app
    print("FastAPI app loaded successfully with Prompts router.")
except Exception as e:
    print(f"Error loading FastAPI app: {e}")
    sys.exit(1)
