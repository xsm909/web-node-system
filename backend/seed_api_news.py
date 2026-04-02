from app.core.database import SessionLocal
from app.models import NodeType
import uuid
import sys
import os

# Add the current directory to sys.path to find 'app'
sys.path.append(os.getcwd())

def seed_test_node():
    db = SessionLocal()
    try:
        node_id = "e5a4d6b7-c8f9-4e1d-a2b3-c4d5e6f7a8b9"
        # The extraction logic automatically extracts parameters from the code
        code = """from dataclasses import dataclass

@dataclass 
class param_info: 
    name: str
    value: str

class NodeParameters:
    api_name: str = "news" #@get_api
    api_function: str = "get_documentation" #@get_functions_list
    api_parameters: list[param_info]
    

def run(inputs, params):
    res = libs.CallAPIFunction(params.api_name, params.api_function, params.api_parameters)
    return {'API_RESULT': res}
"""
        existing = db.query(NodeType).filter(NodeType.id == node_id).first()
        if existing:
            existing.code = code
            # We don't manually set parameters here because the admin router extracts them on SAVE/GET
            # But during seed, we might need to trigger extraction if we want them immediately
            from app.routers.admin import extract_node_parameters
            existing.parameters = extract_node_parameters(code)
            print(f"Updated node type: API News")
        else:
            from app.routers.admin import extract_node_parameters
            node = NodeType(
                id=node_id,
                name="API News",
                version="1.0",
                description="Test node for list[dataclass] parameters",
                code=code,
                parameters=extract_node_parameters(code),
                category="AI",
                icon="api"
            )
            db.add(node)
            print(f"Created node type: API News")
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_node()
