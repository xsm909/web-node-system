import re
import json
import os
import sys

# Add the app directory to sys.path to allow imports if needed (though we use regex here for simplicity and safety)
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

def extract_hints_from_file(file_path):
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found")
        return []

    with open(file_path, 'r', encoding='utf-8') as f:
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

    # 2. Extract SAFE_GLOBALS (basic builtins and direct libraries)
    safe_globals_match = re.search(r'SAFE_GLOBALS\s*=\s*\{(.*?)\n\}', content, re.DOTALL)
    if safe_globals_match:
        sg_content = safe_globals_match.group(1)
        
        # Look for "key": val where val is a SimpleNamespace OR a direct module/ref
        # Example: "charts": charts,
        direct_matches = re.findall(r'"([^"]+)"\s*:\s*([^,]+)', sg_content)
        for label, val in direct_matches:
            if "SimpleNamespace" in val: continue
            if label.startswith('_'): continue
            if label in ("time", "json", "datetime", "timedelta"):
                hints.append({
                    "label": label,
                    "type": "module",
                    "detail": f"Built-in {label}",
                    "boost": 2
                })
            else:
                hints.append({
                    "label": label,
                    "type": "variable",
                    "detail": f"Exposed library: {label}",
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

    # 4. Special Case: Charts Module
    # If "charts": charts is in SAFE_GLOBALS, scan the internal_libs/charts.py file
    if '"charts": charts' in content or "'charts': charts" in content:
        charts_path = os.path.join(os.path.dirname(__file__), '..', 'internal_libs', 'charts.py')
        if os.path.exists(charts_path):
            with open(charts_path, 'r', encoding='utf-8') as f:
                charts_content = f.read()
            
            # Find all top-level functions in charts.py
            chart_functions = re.findall(r'^def\s+([a-zA-Z0-9_]+)\(', charts_content, re.MULTILINE)
            for func in chart_functions:
                if func.startswith('_') or func == 'apply_corporate_style': continue
                hints.append({
                    "label": f"charts.{func}",
                    "type": "function",
                    "detail": "Chart generation function",
                    "boost": 5
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
