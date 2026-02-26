import json
import sys
from unittest.mock import MagicMock, patch
import os

# Add the backend directory to sys.path
sys.path.append(os.getcwd())

from app.internal_libs.agent_lib import agent_run

@patch("app.internal_libs.agent_lib._make_request")
@patch("app.internal_libs.agent_lib._get_api_key", return_value="fake-key")
def test_nested_tools(mock_key, mock_request):
    # Scenario: Nested tools (e.g. from multiple node connections)
    mock_request.return_value = '{"tool": "calculator", "parameters": {"expression": "1+1"}}'
    
    # Nested tools list
    tools = [
        {"name": "calculator", "description": "Math tool"},
        [
            {"name": "read_workflow_data", "description": "WF tool"},
            {"name": "write_runtime_data", "description": "Write tool"}
        ]
    ]
    
    prompt = "Do some work."
    agent_run(
        model_config={"model": "gpt-4o-mini"},
        memory_config=None,
        tools=tools,
        prompt=prompt,
        inputs=None,
        execution_id="test-nested-1"
    )
    
    # Get the system prompt sent to the model
    system_prompt = mock_request.call_args[0][1][0]['content']
    print("--- System Prompt with Nested Tools ---")
    print(system_prompt)
    
    # Assertions
    assert "calculator" in system_prompt
    assert "read_workflow_data" in system_prompt
    assert "write_runtime_data" in system_prompt
    assert "RESPONSE FORMAT" in system_prompt
    assert "JSON object" in system_prompt
    
    print("\nVerification successful: Nested tools are flattened and prompt is strengthened.")

if __name__ == "__main__":
    try:
        test_nested_tools()
    except Exception as e:
        print(f"\nVerification failed: {e}")
        sys.exit(1)
