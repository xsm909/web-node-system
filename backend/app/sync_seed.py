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
                "id": str(node.id),
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
    """Format the data into a valid Python list string using json.dumps."""
    # json.dumps ensures all strings are correctly escaped and on a single line
    json_str = json.dumps(data, indent=4)
    
    # Convert JSON literals to Python literals
    python_str = (
        json_str.replace("true", "True")
        .replace("false", "False")
        .replace("null", "None")
    )
    
    # Prepend 8 spaces to each line to fit inside the seed() function indentation
    lines = python_str.splitlines()
    res = ["        nodes_data = " + lines[0]]
    for line in lines[1:]:
        res.append("        " + line)
        
    return "\n".join(res)

def update_seed_file(new_nodes_data_block):
    """Replace the nodes_data block in seed.py using regex."""
    if not os.path.exists(SEED_FILE_PATH):
        print(f"Error: {SEED_FILE_PATH} not found.")
        return False

    with open(SEED_FILE_PATH, "r") as f:
        content = f.read()

    # Regex to find the nodes_data block and any surrounding comments that look like 'Node Types Seeding'
    # It replaces the whole block including redundant comments
    pattern = r'\n\s*# Node Types Seeding.*?\n\s*nodes_data = \[.*?\](?=\n\s+# Sync nodes)'
    replacement = "\n\n        # Node Types Seeding\n" + new_nodes_data_block
    
    updated_content = re.sub(
        pattern,
        lambda _: replacement,
        content,
        flags=re.DOTALL
    )

    if content == updated_content:
        # Fallback if the first regex didn't match (e.g. if the comment is missing)
        updated_content = re.sub(
            r'\n\s*nodes_data = \[.*?\](?=\n\s+# Sync nodes)',
            lambda _: "\n" + new_nodes_data_block,
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
