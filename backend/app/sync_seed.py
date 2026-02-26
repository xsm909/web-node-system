import os
import json
import re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL
from app.models import NodeType

# Path to seed.py relative to backend directory
SEED_FILE_PATH = "app/seed.py"

def get_node_data():
    """Extract all node types from the database."""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        nodes = session.query(NodeType).all()
        nodes_list = []
        for node in nodes:
            nodes_list.append({
                "name": node.name,
                "version": node.version,
                "description": node.description,
                "code": node.code,
                "input_schema": node.input_schema,
                "output_schema": node.output_schema,
                "parameters": node.parameters,
                "category": node.category,
                "icon": node.icon,
                "is_async": node.is_async
            })
        return nodes_list
    finally:
        session.close()

def format_python_data(data):
    """Format the JSON data into a valid Python list string with correct indentation."""
    # Convert to JSON with high indent for formatting
    json_str = json.dumps(data, indent=12, ensure_ascii=False)
    
    # Convert JSON literals to Python literals
    python_str = (
        json_str.replace("true", "True")
        .replace("false", "False")
        .replace("null", "None")
    )
    
    # Prefix with required indentation for nodes_data block
    return "        nodes_data = " + python_str.strip()

def update_seed_file(new_nodes_data_block):
    """Replace the nodes_data block in seed.py using regex."""
    if not os.path.exists(SEED_FILE_PATH):
        print(f"Error: {SEED_FILE_PATH} not found.")
        return False

    with open(SEED_FILE_PATH, "r") as f:
        content = f.read()

    # Regex to find the nodes_data = [ ... ] block inside seed_database function
    # It looks for nodes_data = [ and then non-greedily captures until the closing ]
    # that is followed by the for loop.
    pattern = r'(\s+)nodes_data = \[.*?\]\s+(?=for node_data in nodes_data:)'
    
    # We capture the indentation of the start to preserve it
    # But since we provide the whole block from the capture, we just replace it.
    
    updated_content = re.sub(
        r'nodes_data = \[.*?\](?=\s+for node_data in nodes_data:)',
        new_nodes_data_block,
        content,
        flags=re.DOTALL
    )

    if content == updated_content:
        print("Warning: No changes made to seed.py. Potential regex mismatch.")
        return False

    with open(SEED_FILE_PATH, "w") as f:
        f.write(updated_content)
    
    num_nodes = len(new_nodes_data_block.split('"name":')) - 1
    print(f"Successfully updated {SEED_FILE_PATH} with {num_nodes} nodes.")
    return True

if __name__ == "__main__":
    print("Synchronizing seed.py with database...")
    nodes = get_node_data()
    if not nodes:
        print("No nodes found in database. Skipping update.")
    else:
        python_block = format_python_data(nodes)
        if update_seed_file(python_block):
            print("Done!")
