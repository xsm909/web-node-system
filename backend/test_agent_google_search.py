import sys
import os
import json

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.internal_libs import agent_lib
from app.internal_libs.logger_lib import system_log

def test_google_search():
    print("--- Testing Agent with Google Search Grounding ---")
    
    # Task that requires recent information
    task = "Какая сегодня цена акций Google (Alphabet Class C)?"
    hint = "Use Google Search to find real-time stock information. Respond in Russian."
    
    # We use gemini-1.5-flash which we know supports grounding well
    model = "gemini-1.5-flash"
    tools = ["google_search"]
    
    try:
        result = agent_lib.run(
            model=model,
            tools=tools,
            hint=hint,
            task=task,
            iteration_limit=5
        )
        print("\nAGENT RESULT:")
        print(result)
        
        # Basic validation: should contain a number (likely the stock price)
        if any(char.isdigit() for char in result):
            print("\nSUCCESS: Result seems to contain numerical data (probably the stock price).")
        else:
            print("\nWARNING: Result does not contain numbers. Check if grounding worked.")
            
    except Exception as e:
        print(f"\nERROR: {str(e)}")

if __name__ == "__main__":
    test_google_search()
