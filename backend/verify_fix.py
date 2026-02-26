import json
import sys
from unittest.mock import MagicMock, patch

# Mock internal_libs before any imports from app
mock_logger_lib = MagicMock()
sys.modules['app.internal_libs.logger_lib'] = mock_logger_lib
mock_logger_lib.system_log = MagicMock()

import app.internal_libs.tools_lib as tools_lib
import app.internal_libs.agent_lib as agent_lib


def test_write_runtime_data_robustness():
    print("Testing write_runtime_data robustness...")
    execution_id = "00000000-0000-0000-0000-000000000000"
    
    with patch('app.internal_libs.struct_func.get_runtime_data', return_value={}), \
         patch('app.internal_libs.struct_func.update_runtime_data', return_value=True):
        
        # Test with dict
        res_dict = tools_lib.write_runtime_data({"answer_a": [1, 2, 3]}, execution_id=execution_id)
        assert res_dict == "Runtime data updated successfully."
        print("✓ Dict input works")
        
        # Test with JSON string
        res_str = tools_lib.write_runtime_data('{"answer_a": [1, 2, 3]}', execution_id=execution_id)
        assert res_str == "Runtime data updated successfully."
        print("✓ JSON string input works")
        
        # Test with non-JSON string (should fail gracefully)
        res_err = tools_lib.write_runtime_data('not a json', execution_id=execution_id)
        assert "Error: Invalid JSON string" in res_err
        print("✓ Invalid string handled")

def test_agent_run_parameter_extraction():
    print("\nTesting agent_run parameter extraction...")
    
    # Mocking _make_request to return a tool call
    mock_response = json.dumps({
        "tool": "write_runtime_data",
        "parameters": {"answer_a": [4, 5, 6]} # Common direct format
    })
    
    with patch('app.internal_libs.agent_lib._get_api_key', return_value="test_key"), \
         patch('app.internal_libs.agent_lib._make_request', side_effect=[mock_response, "Task finished"]), \
         patch('app.internal_libs.tools_lib.write_runtime_data', return_value="Success") as mock_write:
        
        agent_lib.agent_run(
            model_config={"model": "test-model"},
            memory_config=None,
            tools=[],
            prompt="Save answers",
            execution_id="test-id"
        )
        
def test_agent_run_lambda_compatibility():
    print("\nTesting agent_run lambda compatibility...")
    
    # Simulating a bound lambda from executor.py
    # This lambda DOES NOT accept execution_id
    bound_lambda = lambda data: f"Success with {data}"
    
    # Mocking _make_request to return a tool call
    mock_response = json.dumps({
        "tool": "write_runtime_data",
        "parameters": {"answer_a": [7, 8, 9]}
    })
    
    with patch('app.internal_libs.agent_lib._get_api_key', return_value="test_key"), \
         patch('app.internal_libs.agent_lib._make_request', side_effect=[mock_response, "Task finished"]), \
         patch('app.internal_libs.tools_lib.write_runtime_data', side_effect=ValueError("Should not call raw if map has it")):
        
        # We need to pass the bound lambda in the tool_map
        # In real scenario, it comes from 'tools' argument
        tools = [
            {
                "name": "write_runtime_data",
                "description": "Save data",
                "execute": bound_lambda
            }
        ]
        
        # Since INTERNAL_TOOLS currently takes priority, we temporarily patch it out 
        # or rely on the fact that if it's in tool_map it should work even if it WAS a lambda.
        # Actually, let's just test if the unified dispatcher works with the lambda.
        
        res = agent_lib.agent_run(
            model_config={"model": "test-model"},
            memory_config=None,
            tools=tools,
            prompt="Save answers",
            execution_id="test-id"
        )
        
        print("✓ Lambda compatibility works (didn't crash)")

def test_session_isolation():
    print("\nTesting session isolation...")
    with patch('app.internal_libs.agent_lib._get_api_key', return_value="test_key"), \
         patch('app.internal_libs.agent_lib._make_request', return_value="Response"):
        
        # Run 1
        agent_lib.agent_run({}, {"type": "window"}, [], "p1", execution_id="id1")
        # Run 2
        agent_lib.agent_run({}, {"type": "window"}, [], "p2", execution_id="id2")
        
        import app.internal_libs.openai_lib as openai_lib
        assert "exec-id1" in openai_lib._conversations
        assert "exec-id2" in openai_lib._conversations
        print("✓ Session isolation works")


if __name__ == "__main__":
    try:
        test_write_runtime_data_robustness()
        test_agent_run_parameter_extraction()
        test_agent_run_lambda_compatibility()
        test_session_isolation()
        print("\nAll tests passed!")
    except Exception as e:
        print(f"\nTest failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
