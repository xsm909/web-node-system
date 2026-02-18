import ast
from RestrictedPython import compile_restricted, safe_globals, RestrictingNodeTransformer, Guards

class CustomRestrictingNodeTransformer(RestrictingNodeTransformer):
    def visit_AnnAssign(self, node):
        if node.value is None:
            return self.visit(node.target)
        assign_node = ast.Assign(
            targets=[node.target],
            value=node.value,
            lineno=node.lineno,
            col_offset=node.col_offset
        )
        return self.visit_Assign(assign_node)

ALLOWED_MODULES = ["math", "json", "datetime", "re", "random"]

def restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
    if name in ALLOWED_MODULES:
        return __import__(name, globals, locals, fromlist, level)
    raise ImportError(f"Module '{name}' is not allowed")

code = """
import math
import json
try:
    import os
except ImportError as e:
    print(f"Caught expected error: {e}")

def run():
    print(f"sqrt(16) = {math.sqrt(16)}")
    print(f"json string: {json.dumps({'a': 1})}")

run()
"""

class MockCollector:
    def _call_print(self, *args):
        print(*args)

try:
    byte_code = compile_restricted(
        code, 
        "<test>", 
        "exec", 
        policy=CustomRestrictingNodeTransformer
    )
    print("Compilation Success!")
    
    node_globals = {
        **safe_globals,
        "print": print,
        "_print_": lambda _getattr_=None: MockCollector(),
        "_getattr_": Guards.safer_getattr,
        "_setattr_": Guards.guarded_setattr,
        "_delattr_": Guards.guarded_delattr,
        "__builtins__": {
            **safe_globals["__builtins__"], 
            "print": print,
            "__import__": restricted_import
        }
    }
    
    print("Executing...")
    exec(byte_code, node_globals)
    print("Execution Success!")
except Exception as e:
    import traceback
    print(f"Error: {e}")
    traceback.print_exc()
