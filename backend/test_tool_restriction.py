import json
import sys
from unittest.mock import MagicMock, patch
import os

# Add the backend directory to sys.path
sys.path.append(os.getcwd())

from app.internal_libs.agent_lib import agent_run

@patch("app.internal_libs.agent_lib._make_request")
@patch("app.internal_libs.agent_lib._get_api_key", return_value="fake-key")
def test_tool_restriction(mock_key, mock_request):
    # Scenario 1: Only calculator provided. Agent should NOT see search instructions.
    mock_request.return_value = "I don't have a search tool, so I can only calculate."
    
    prompt = "Search for the weather in Tokyo and then calculate 1+1."
    tools = [{"name": "calculator", "description": "Calculates stuff"}]
    
    result = agent_run(
        model_config={"model": "gpt-4o-mini"},
        memory_config=None,
        tools=tools,
        prompt=prompt,
        inputs=None,
        execution_id="test-restriction-1"
    )
    
    # Get the system prompt sent to the model
    system_prompt = mock_request.call_args[0][1][0]['content']
    print("--- System Prompt with only 'calculator' ---")
    print(system_prompt)
    
    assert "smart_search" not in system_prompt
    assert "read_workflow_data" not in system_prompt
    assert "calculator" in system_prompt

    # Scenario 2: Search provided. Agent SHOULD see search instructions.
    mock_request.reset_mock()
    tools.append({"name": "smart_search", "description": "Searches the web"})
    
    agent_run(
        model_config={"model": "gpt-4o-mini"},
        memory_config=None,
        tools=tools,
        prompt=prompt,
        inputs=None,
        execution_id="test-restriction-2"
    )
    
    system_prompt_2 = mock_request.call_args[0][1][0]['content']
    print("\n--- System Prompt with 'calculator' and 'smart_search' ---")
    print(system_prompt_2)
    
    assert "smart_search" in system_prompt_2
    assert "calculator" in system_prompt_2

if __name__ == "__main__":
    try:
        test_tool_restriction()
        print("\nVerification successful: Tool restriction is working correctly.")
    except Exception as e:
        print(f"\nVerification failed: {e}")
        sys.exit(1)
