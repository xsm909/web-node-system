import sys
import os
import unittest
from unittest.mock import patch, MagicMock

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock the logger before importing runtime_lib
sys.modules['.logger_lib'] = MagicMock()
sys.modules['backend.app.internal_libs.logger_lib'] = MagicMock()

from app.internal_libs import runtime_lib

class TestRuntimeLib(unittest.TestCase):
    @patch('app.internal_libs.runtime_lib.system_log')
    @patch('app.internal_libs.struct_func.update_runtime_data')
    @patch('app.internal_libs.struct_func.get_runtime_data')
    def test_delete_runtime_value(self, mock_get, mock_update, mock_log):
        # Setup
        exec_id = "test-exec-id"
        key_to_delete = "key1"
        initial_data = {"key1": "value1", "key2": "value2"}
        
        mock_get.return_value = initial_data
        mock_update.return_value = True
        
        # Execute
        result = runtime_lib.delete_runtime_value(exec_id, key_to_delete)
        
        # Verify
        self.assertIn("deleted successfully", result)
        mock_update.assert_called_once()
        updated_data = mock_update.call_args[0][1]
        self.assertNotIn("key1", updated_data)
        self.assertIn("key2", updated_data)

    @patch('app.internal_libs.runtime_lib.system_log')
    @patch('app.internal_libs.struct_func.get_runtime_data')
    def test_delete_runtime_value_not_found(self, mock_get, mock_log):
        # Setup
        exec_id = "test-exec-id"
        key_to_delete = "missing_key"
        initial_data = {"key1": "value1"}
        
        mock_get.return_value = initial_data
        
        # Execute
        result = runtime_lib.delete_runtime_value(exec_id, key_to_delete)
        
        # Verify
        self.assertIn("Warning: Key 'missing_key' not found", result)

if __name__ == '__main__':
    unittest.main()
