import sqlite3
import json
import os

# Database Path
DB_PATH = "/Users/Shared/Work/Web/web-node-system/backend/test.db"

def dump_nodes():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        query = "SELECT * FROM node_types"
        cursor.execute(query)
        rows = cursor.fetchall()
        
        nodes = []
        for row in rows:
            node = dict(row)
            # Parse JSON fields if they are strings
            for field in ['input_schema', 'output_schema', 'parameters']:
                if isinstance(node[field], str):
                    try:
                        node[field] = json.loads(node[field])
                    except:
                        pass
            nodes.append(node)
            
        with open('node_dump.json', 'w') as f:
            json.dump(nodes, f, indent=2)
            
        print(f"Dumped {len(nodes)} nodes to node_dump.json")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    dump_nodes()
