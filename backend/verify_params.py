import ast
import sys
import os

# Add the parent directory to sys.path to import internal libs
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def extract_node_parameters(code: str) -> list:
    """Extract parameters from class NodeParameters in the code."""
    try:
        tree = ast.parse(code)
        params = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "NodeParameters":
                for item in node.body:
                    name = None
                    ptype = "string"
                    default = None
                    
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        name = item.target.id
                        # Map Python types to frontend field types
                        if isinstance(item.annotation, ast.Name):
                            tid = item.annotation.id
                            if tid in ("int", "float", "number"):
                                ptype = "number"
                            elif tid in ("bool", "boolean"):
                                ptype = "boolean"
                        
                        # Extract default value from AnnAssign
                        if item.value:
                            if isinstance(item.value, ast.Constant):
                                default = item.value.value
                            elif hasattr(item.value, 'n'): # Legacy
                                default = item.value.n
                            elif hasattr(item.value, 's'): # Legacy
                                default = item.value.s
                            elif hasattr(item.value, 'value'): # Legacy NameConstant
                                default = item.value.value
                    
                    elif isinstance(item, ast.Assign) and len(item.targets) == 1 and isinstance(item.targets[0], ast.Name):
                        name = item.targets[0].id
                        # Infer type from default value
                        if isinstance(item.value, ast.Constant):
                            default = item.value.value
                            if isinstance(default, (int, float)):
                                ptype = "number"
                            elif isinstance(default, bool):
                                ptype = "boolean"
                        elif hasattr(item.value, 'n'): # Legacy compatibility
                            default = item.value.n
                            ptype = "number"
                        elif hasattr(item.value, 's'): # Legacy compatibility
                            default = item.value.s
                        elif hasattr(item.value, 'value'): # Legacy NameConstant
                            default = item.value.value
                            if isinstance(default, bool):
                                ptype = "boolean"

                    if name:
                        params.append({
                            "name": name,
                            "type": ptype,
                            "label": name.replace("_", " ").title(),
                            "default": default
                        })
                return params
    except Exception as e:
        print(f"Error: {e}")
        pass
    return []

test_code = """
class NodeParameters:
    text: str = "Default value"
    count: int = 10
    enabled: bool = True
    no_default: float

def run(inputs, params):
    print(f"Text parameter: {nodeParameters.text}")
    return {"status": "ok"}
"""

parameters = extract_node_parameters(test_code)
print(f"Extracted parameters: {parameters}")

tree = ast.parse(test_code)
for node in tree.body:
    if isinstance(node, ast.ClassDef) and node.name == "NodeParameters":
        for item in node.body:
            if isinstance(item, ast.AnnAssign):
                print(f"AnnAssign target: {item.target.id}")
                if item.value:
                    print(f"AnnAssign value dump: {ast.dump(item.value)}")

# Assertions
expected = [
    {"name": "text", "type": "string", "label": "Text", "default": "Default value"},
    {"name": "count", "type": "number", "label": "Count", "default": 10},
    {"name": "enabled", "type": "boolean", "label": "Enabled", "default": True},
    {"name": "no_default", "type": "number", "label": "No Default", "default": None}
]

for i, p in enumerate(parameters):
    print(f"Checking parameter {p['name']}...")
    assert p["name"] == expected[i]["name"]
    assert p["type"] == expected[i]["type"]
    assert p["default"] == expected[i]["default"]

print("Backend verification PASSED!")
