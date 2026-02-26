from app.core.database import SessionLocal
from app.models import NodeType
import json
import uuid

def dump_nodes():
    db = SessionLocal()
    try:
        nodes = db.query(NodeType).all()
        nodes_list = []
        for node in nodes:
            node_dict = {
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
            }
            nodes_list.append(node_dict)
        print(json.dumps(nodes_list, indent=4))
    finally:
        db.close()

if __name__ == "__main__":
    dump_nodes()
