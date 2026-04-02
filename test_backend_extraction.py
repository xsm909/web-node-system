import ast
import re
import json
from dataclasses import dataclass

def extract_node_parameters(code: str) -> list:
    """Extract parameters from class NodeParameters in the code."""
    import re
    import ast

    def _parse_class_body(tree) -> list:
        dataclasses = {}
        # First pass: collect dataclasses
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                is_dc = False
                for decorator in node.decorator_list:
                    if (isinstance(decorator, ast.Name) and decorator.id == "dataclass") or \
                       (isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Name) and decorator.func.id == "dataclass"):
                        is_dc = True
                        break
                
                if is_dc:
                    fields = []
                    for item in node.body:
                        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                            ftype = "string"
                            if isinstance(item.annotation, ast.Name):
                                tid = item.annotation.id
                                if tid in ("int", "float", "number"): ftype = "number"
                                elif tid in ("bool", "boolean"): ftype = "boolean"
                            fields.append({
                                "name": item.target.id, 
                                "type": ftype, 
                                "label": item.target.id.replace("_", " ").title()
                            })
                    dataclasses[node.name] = fields

        params = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "NodeParameters":
                for item in node.body:
                    name = None
                    ptype = "string"
                    default = None
                    schema = None
                    
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        name = item.target.id
                        
                        # Handle list[Dataclass] or List[Dataclass]
                        is_list = False
                        inner_type = None
                        
                        if isinstance(item.annotation, ast.Subscript):
                            if isinstance(item.annotation.value, ast.Name) and item.annotation.value.id.lower() == "list":
                                is_list = True
                                # Handle slice for both 3.8 and 3.9+
                                slice_node = item.annotation.slice
                                if isinstance(slice_node, ast.Name):
                                    inner_type = slice_node.id
                                elif hasattr(ast, 'Index') and isinstance(slice_node, ast.Index) and isinstance(slice_node.value, ast.Name):
                                    inner_type = slice_node.value.id
                                elif hasattr(slice_node, 'id'):
                                    inner_type = slice_node.id
                        
                        if is_list and inner_type in dataclasses:
                            ptype = "list_dataclass"
                            schema = dataclasses[inner_type]
                        elif isinstance(item.annotation, ast.Name):
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
                        marker_match = re.search(r"@=table[-|>]+([\w]+)->([\w]+),([\w]+)->([\w]+)", line_content)
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
                        else:
                            # Support for @function_name
                            func_marker_match = re.search(r"@([\w]+)\b", line_content)
                            if func_marker_match:
                                options_source = {
                                    "function": func_marker_match.group(1),
                                    "component": "ComboBox"
                                }

                        sql_constructor_match = re.search(r"@=sql_query_constructor", line_content)

                        params.append({
                            "name": name,
                            "type": ptype,
                            "label": name.replace("_", " ").title(),
                            "default": default,
                            "options_source": options_source,
                            "is_sql_query_constructor": bool(sql_constructor_match),
                            "schema": schema
                        })
                return params
        return []

    tree = ast.parse(code)
    return _parse_class_body(tree)

test_code = """
@dataclass 
class param_info: 
    name: str
    value: str

class NodeParameters:
    api_name: str = \"news\" #@get_api
    api_function: str = \"get_documentation\" #@get_functions_list
    api_parameters: list[param_info]
"""

results = extract_node_parameters(test_code)
print(json.dumps(results, indent=2))
