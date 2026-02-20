import sys
import os

# Set up path to import from the project
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'app')))
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.routers.admin import extract_node_parameters

test_code = """
class NodeParameters:
    text: str = "Default text"

def run(inputs, params):
    print(nodeParameters.text)
    return {}
"""

params = extract_node_parameters(test_code)
print(f"Extracted Params: {params}")
