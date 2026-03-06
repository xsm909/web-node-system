import re
import ast
import json

def extract_node_parameters(code: str) -> list:
    """Extract parameters from class NodeParameters in the code."""
    import re

    def _parse_class_body(tree) -> list:
        params = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "NodeParameters":
                for item in node.body:
                    name = None
                    ptype = "string"
                    default = None
                    
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        name = item.target.id
                        if isinstance(item.annotation, ast.Name):
                            tid = item.annotation.id
                            if tid in ("int", "float", "number"):
                                ptype = "number"
                            elif tid in ("bool", "boolean"):
                                ptype = "boolean"
                        
                        if item.value:
                            if isinstance(item.value, ast.Constant):
                                default = item.value.value
                            elif isinstance(item.value, ast.Num):
                                default = item.value.n
                            elif isinstance(item.value, ast.Str):
                                default = item.value.s
                            elif isinstance(item.value, ast.NameConstant):
                                default = item.value.value
                    
                    elif isinstance(item, ast.Assign) and len(item.targets) == 1 and isinstance(item.targets[0], ast.Name):
                        name = item.targets[0].id
                        if isinstance(item.value, ast.Constant):
                            default = item.value.value
                            if isinstance(default, (int, float)):
                                ptype = "number"
                            elif isinstance(default, bool):
                                ptype = "boolean"
                        elif isinstance(item.value, ast.Num):
                            default = item.value.n
                            ptype = "number"
                        elif isinstance(item.value, ast.Str):
                            default = item.value.s
                        elif isinstance(item.value, ast.NameConstant):
                            default = item.value.value
                            if isinstance(default, bool):
                                ptype = "boolean"

                    if name:
                        # Extract @table marker from comments on the same line
                        options_source = None
                        line_content = code.splitlines()[item.lineno-1] if item.lineno <= len(code.splitlines()) else ""
                        marker_match = re.search(r"@table[-|>]+([\w]+)->([\w]+),([\w]+)->([\w]+)", line_content)
                        if marker_match:
                            table_name = marker_match.group(1)
                            options_source = {
                                "table": table_name,
                                "value_field": marker_match.group(2),
                                "label_field": marker_match.group(4),
                                "component": "ComboBox"
                            }
                            if table_name == "AI_Tasks":
                                options_source["filters"] = {"owner_id": "AI_Task"}

                        params.append({
                            "name": name,
                            "type": ptype,
                            "label": name.replace("_", " ").title(),
                            "default": default,
                            "options_source": options_source
                        })
                return params
        return []

    # Try full parse first
    try:
        tree = ast.parse(code)
        return _parse_class_body(tree)
    except SyntaxError:
        pass

    # Fallback: extract only the NodeParameters class block via regex
    try:
        match = re.search(r'(class\s+NodeParameters\s*:.*?)(?=\n(?:class\s|def\s)|\Z)', code, re.DOTALL)
        if match:
            class_code = match.group(1)
            tree = ast.parse(class_code)
            return _parse_class_body(tree)
    except Exception:
        pass
    return []

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
    
    # Simple check
    assert len(params) == 4
    assert params[1]["options_source"]["table"] == "AI_Tasks"
    assert params[1]["options_source"]["value_field"] == "id"
    assert params[1]["options_source"]["label_field"] == "description"
    assert params[1]["options_source"]["component"] == "ComboBox"
    assert params[1]["options_source"]["filters"]["owner_id"] == "AI_Task"
    
    assert params[2]["options_source"]["table"] == "OtherTable"
    assert params[2]["options_source"]["value_field"] == "key"
    assert params[2]["options_source"]["label_field"] == "label"
    assert params[2]["options_source"]["component"] == "ComboBox"
    assert "filters" not in params[2]["options_source"]
    
    print("\nVerification successful!")

if __name__ == "__main__":
    test_extraction()
