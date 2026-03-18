import re
import json
import os
import sys
import ast

# Add the app directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

def get_signatures_from_file(file_path):
    """Parses a Python file and returns a dict of {func_name: signature_string}."""
    if not os.path.exists(file_path):
        return {}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            tree = ast.parse(f.read())
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return {}

    signatures = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            # Extract arguments
            args = []
            for arg in node.args.args:
                args.append(arg.arg)
            if node.args.vararg:
                args.append(f"*{node.args.vararg.arg}")
            if node.args.kwarg:
                args.append(f"**{node.args.kwarg.arg}")
            
            signatures[node.name] = f"{node.name}({', '.join(args)})"
    return signatures

def resolve_internal_lib_map(file_path):
    """Parses imports in a file to map local names to their source files in internal_libs."""
    if not os.path.exists(file_path):
        return {}

    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            tree = ast.parse(f.read())
        except:
            return {}

    import_map = {}
    base_dir = os.path.join(os.path.dirname(file_path), '..', 'internal_libs')

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.level > 0: # Relative import
                # Resolve module path
                module_parts = node.module.split('.') if node.module else []
                # Simple heuristic for our structure: ..internal_libs.xxx
                if 'internal_libs' in module_parts:
                    idx = module_parts.index('internal_libs')
                    lib_name = module_parts[idx + 1] if len(module_parts) > idx + 1 else None
                    if lib_name:
                        lib_path = os.path.join(base_dir, f"{lib_name}.py")
                        for alias in node.names:
                            import_map[alias.name] = lib_path
                elif node.level == 2: # ..something
                     # Maybe it's a direct import from internal_libs/__init__.py or similar
                     pass

    return import_map

def extract_hints_from_file(file_path):
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found")
        return []

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    try:
        tree = ast.parse(content)
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return []

    hints = []
    import_map = resolve_internal_lib_map(file_path)
    
    # Cache for signatures of internal libs
    lib_signatures_cache = {}

    def get_cached_signature(lib_path, func_name):
        if lib_path not in lib_signatures_cache:
            lib_signatures_cache[lib_path] = get_signatures_from_file(lib_path)
        return lib_signatures_cache[lib_path].get(func_name)

    # 1. Extract ALLOWED_MODULES (using regex for simplicity as it's a simple list)
    modules_match = re.search(r'ALLOWED_MODULES\s*=\s*\[(.*?)\]', content, re.DOTALL)
    if modules_match:
        modules_str = modules_match.group(1)
        modules = re.findall(r'"([^"]+)"|\'([^\']+)\'', modules_str)
        for m in modules:
            module_name = m[0] or m[1]
            hints.append({
                "label": module_name,
                "type": "module",
                "detail": "Allowed module",
                "boost": 1
            })

    # 2. Extract SAFE_GLOBALS and SimpleNamespaces
    # We'll look for the SAFE_GLOBALS assignment
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == 'SAFE_GLOBALS':
                    if isinstance(node.value, ast.Dict):
                        for k, v in zip(node.value.keys, node.value.values):
                            if isinstance(k, ast.Constant):
                                label = k.value
                                if label.startswith('_'): continue
                                
                                # Check if it's a SimpleNamespace
                                if isinstance(v, ast.Call) and isinstance(v.func, ast.Name) and v.func.id == 'SimpleNamespace':
                                    hints.append({
                                        "label": label,
                                        "type": "variable",
                                        "detail": f"{label} namespace",
                                        "boost": 3
                                    })
                                    # Process keywords in SimpleNamespace(a=b, ...)
                                    for kw in v.keywords:
                                        member_name = kw.arg
                                        detail = f"{label} function"
                                        
                                        # Try to resolve signature
                                        if isinstance(kw.value, ast.Name):
                                            ref_name = kw.value.id
                                            lib_path = import_map.get(ref_name)
                                            if lib_path:
                                                sig = get_cached_signature(lib_path, ref_name)
                                                if sig:
                                                    detail = sig
                                        
                                        hints.append({
                                            "label": f"{label}.{member_name}",
                                            "type": "function",
                                            "detail": detail,
                                            "boost": 4
                                        })
                                else:
                                    # Direct exposure
                                    if label in ("time", "json", "datetime", "timedelta"):
                                        hints.append({
                                            "label": label,
                                            "type": "module",
                                            "detail": f"Built-in {label}",
                                            "boost": 2
                                        })
                                    elif label == "charts":
                                        # Special handling for charts (defined as a module usually)
                                        hints.append({
                                            "label": "charts",
                                            "type": "module",
                                            "detail": "Charts library",
                                            "boost": 2
                                        })
                                        charts_path = os.path.join(os.path.dirname(file_path), '..', 'internal_libs', 'charts.py')
                                        if os.path.exists(charts_path):
                                            chart_sigs = get_signatures_from_file(charts_path)
                                            for func, sig in chart_sigs.items():
                                                if func.startswith('_') or func == 'apply_corporate_style': continue
                                                hints.append({
                                                    "label": f"charts.{func}",
                                                    "type": "function",
                                                    "detail": sig,
                                                    "boost": 5
                                                })
                                    else:
                                        hints.append({
                                            "label": label,
                                            "type": "variable",
                                            "detail": f"Exposed library: {label}",
                                            "boost": 2
                                        })

    return hints

def extract_hints():
    services_dir = os.path.join(os.path.dirname(__file__), '..', 'services')
    executors = [
        os.path.join(services_dir, 'executor.py'),
        os.path.join(services_dir, 'report_executor.py')
    ]
    
    all_hints = []
    seen_labels = set()
    
    for exec_path in executors:
        file_hints = extract_hints_from_file(exec_path)
        for hint in file_hints:
            if hint["label"] not in seen_labels:
                all_hints.append(hint)
                seen_labels.add(hint["label"])

    # Add standard boilerplate run function
    all_hints.append({
        "label": "run",
        "type": "function",
        "detail": "Standard entry point: run(inputs, params)",
        "snippet": "def run(inputs, params):\n    ${1:}\n    return ${2:{}}",
        "boost": 10
    })

    # Add report specific entry point
    all_hints.append({
        "label": "GenerateReport",
        "type": "function",
        "detail": "Report entry point: GenerateReport(params)",
        "snippet": "def GenerateReport(params):\n    ${1:}\n    return ${2:{}}, True",
        "boost": 10
    })

    output_path = os.path.join(os.path.dirname(__file__), '..', 'resources', 'python_hints.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_hints, f, indent=4)
    
    print(f"Generated {len(all_hints)} hints to {output_path}")

if __name__ == "__main__":
    extract_hints()
