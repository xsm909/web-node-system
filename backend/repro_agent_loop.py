import json
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add the backend directory to sys.path so we can import our modules
# Assuming we are running from /Users/Shared/Work/Web/web-node-system/backend
import os
sys.path.append(os.getcwd())

from app.internal_libs.agent_lib import agent_run

def mock_get_workflow_data(execution_id):
    return {"question": ["10+20", "2*3", "40*32", "40/32"]}

def mock_get_runtime_data(execution_id):
    # We'll use a local dict to simulate persistence across calls in the mock
    if not hasattr(mock_get_runtime_data, "_store"):
        mock_get_runtime_data._store = {}
    return mock_get_runtime_data._store.get(execution_id, {})

def mock_update_runtime_data(execution_id, data):
    if not hasattr(mock_get_runtime_data, "_store"):
        mock_get_runtime_data._store = {}
    mock_get_runtime_data._store[execution_id] = data
    return True

@patch("app.internal_libs.struct_func.get_workflow_data", side_effect=mock_get_workflow_data)
@patch("app.internal_libs.struct_func.get_runtime_data", side_effect=mock_get_runtime_data)
@patch("app.internal_libs.struct_func.update_runtime_data", side_effect=mock_update_runtime_data)
@patch("app.internal_libs.agent_lib._make_request")
@patch("app.internal_libs.agent_lib._get_api_key", return_value="fake-key")
def test_agent_loop(mock_key, mock_request, mock_update, mock_get_run, mock_get_wf):
    # Mocking the AI responses to simulate a realistic flow
    # It needs more than 5 iterations to:
    # 0: read_wf
    # 1: calc 1
    # 2: write 1
    # 3: calc 2
    # 4: write 2
    # 5: calc 3 -> THIS WOULD FAIL before fix
    # ...
    
    responses = [
        '{"tool": "read_workflow_data", "parameters": {}}',
        '{"tool": "calculator", "parameters": {"expression": "10+20"}}',
        '{"tool": "write_runtime_data", "parameters": {"data": {"answer_a": [30]}}}',
        '{"tool": "calculator", "parameters": {"expression": "2*3"}}',
        '{"tool": "write_runtime_data", "parameters": {"data": {"answer_a": [30, 6]}}}',
        '{"tool": "calculator", "parameters": {"expression": "40*32"}}',
        '{"tool": "write_runtime_data", "parameters": {"data": {"answer_a": [30, 6, 1280]}}}',
        '{"tool": "calculator", "parameters": {"expression": "40/32"}}',
        '{"tool": "write_runtime_data", "parameters": {"data": {"answer_a": [30, 6, 1280, 1.25]}}}',
        'Final result: all questions answered correctly.'
    ]
    mock_request.side_effect = responses

    prompt = "Iterate through each element in the array of questions. Generate an answer for every question and append it to answer_a in runtime data."
    result = agent_run(
        model_config={"model": "gpt-4o-mini"},
        memory_config=None,
        tools=[],
        prompt=prompt,
        inputs=None,
        execution_id="ee26fc5d-cb29-4c68-ac09-532d37739c67"
    )

    print(f"Final Result: {result}")
    print(f"Runtime Data: {mock_get_runtime_data('ee26fc5d-cb29-4c68-ac09-532d37739c67')}")
    
    # Check that we reached iteration 9 (which is response index 9)
    assert "Final result" in result
    assert len(mock_get_runtime_data('ee26fc5d-cb29-4c68-ac09-532d37739c67').get("answer_a")) == 4

if __name__ == "__main__":
    test_agent_loop()
