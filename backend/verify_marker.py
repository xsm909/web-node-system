import sys
import os
import json

# Add backend to path to import admin
sys.path.append("/Users/Shared/Work/Web/web-node-system/backend")

from app.routers.admin import extract_node_parameters

def test_extraction():
    code = """
class NodeParameters:
    anaytic_type:str = "Mention"
    AI_Task:str #@table-AI_Tasks->id,AI_Tasks->description
    another_param:int = 10 #@table->OtherTable->key,OtherTable->label
    no_marker:str = "test"
"""
    params = extract_node_parameters(code)
    print(json.dumps(params, indent=2))
    
    expected = [
        {
            "name": "anaytic_type",
            "type": "string",
            "label": "Anaytic Type",
            "default": "Mention",
            "options_source": None
        },
        {
            "name": "AI_Task",
            "type": "string",
            "label": "Ai Task",
            "default": None,
            "options_source": {
                "table": "AI_Tasks",
                "value_field": "id",
                "label_field": "description"
            }
        },
        {
            "name": "another_param",
            "type": "number",
            "label": "Another Param",
            "default": 10,
            "options_source": {
                "table": "OtherTable",
                "value_field": "key",
                "label_field": "label"
            }
        },
        {
            "name": "no_marker",
            "type": "string",
            "label": "No Marker",
            "default": "test",
            "options_source": None
        }
    ]
    
    # Simple check
    assert len(params) == 4
    assert params[1]["options_source"]["table"] == "AI_Tasks"
    assert params[2]["options_source"]["table"] == "OtherTable"
    print("\nVerification successful!")

if __name__ == "__main__":
    test_extraction()
