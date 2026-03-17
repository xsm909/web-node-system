import re
import json
import os
import sys

# Add the app directory to sys.path to allow imports if needed (though we use regex here for simplicity and safety)
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

def extract_hints():
    executor_path = os.path.join(os.path.dirname(__file__), '..', 'services', 'executor.py')
    if not os.path.exists(executor_path):
        print(f"Error: {executor_path} not found")
        return

    with open(executor_path, 'r', encoding='utf-8') as f:
        content = f.read()

    hints = []

    # 1. Extract ALLOWED_MODULES
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

    # 2. Extract SAFE_GLOBALS (basic builtins)
    # We'll just hardcode some common ones or look for them in __builtins__
    builtins_match = re.search(r'"__builtins__":\s*\{(.*?)\}', content, re.DOTALL)
    if builtins_match:
        builtins_str = builtins_match.group(1)
        # Look for "key": val
        builtin_items = re.findall(r'"([^"]+)"\s*:', builtins_str)
        for item in builtin_items:
            if item.startswith('_'): continue
            hints.append({
                "label": item,
                "type": "function", # most are functions or types acting as functions
                "detail": "Built-in",
                "boost": 2
            })

    # 3. Extract Namespaces (libs, openai, gemini, etc)
    # We look for SimpleNamespace definitions in SAFE_GLOBALS
    namespace_matches = re.finditer(r'"([^"]+)"\s*:\s*SimpleNamespace\((.*?)\)', content, re.DOTALL)
    for match in namespace_matches:
        ns_name = match.group(1)
        ns_content = match.group(2)
        
        hints.append({
            "label": ns_name,
            "type": "variable",
            "detail": f"{ns_name} namespace",
            "boost": 3
        })

        # Find members in the namespace
        # pattern: name=path
        members = re.findall(r'(\w+)\s*=\s*[\w\.]+', ns_content)
        for member in members:
            hints.append({
                "label": f"{ns_name}.{member}",
                "type": "function",
                "detail": f"{ns_name} function",
                "boost": 4
            })

    # Add standard boilerplate run function
    hints.append({
        "label": "run",
        "type": "function",
        "detail": "Standard entry point: run(inputs, params)",
        "snippet": "def run(inputs, params):\n    ${1:}\n    return ${2:{}}",
        "boost": 10
    })

    output_path = os.path.join(os.path.dirname(__file__), '..', 'resources', 'python_hints.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(hints, f, indent=4)
    
    print(f"Generated {len(hints)} hints to {output_path}")

if __name__ == "__main__":
    extract_hints()
