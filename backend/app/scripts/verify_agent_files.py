import os
import sys

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.internal_libs import agent_lib
from app.internal_libs import temp_files_lib

def test_agent_with_file():
    # 1. Create a dummy image or text file
    test_file_content = "This is a secret code: 12345. Remember it."
    save_info = temp_files_lib.save(test_file_content, "txt", "secret.txt")
    file_path = save_info["path"]
    
    print(f"Test file created at: {file_path}")
    
    # 2. Run agent with this file
    # We use a Gemini model as it has the best file support implemented
    model = "gemini-1.5-flash"
    task = "What is the secret code written in the attached file? Return it as final_answer."
    
    print(f"Running agent with task: {task}")
    
    try:
        result = agent_lib.run(
            model=model,
            tools=[],
            hint="Testing file support",
            task=task,
            files=[file_path]
        )
        
        print(f"Agent result: {result}")
        if "12345" in str(result.get("response_text", "")):
            print("SUCCESS: Agent correctly read the file!")
        else:
            print("FAILURE: Agent did not find the secret code.")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    test_agent_with_file()
