from app.core.database import SessionLocal
from app.models.workflow import Workflow
import json

def inspect_workflows():
    db = SessionLocal()
    try:
        workflows = db.query(Workflow).all()
        print(f"Total workflows found: {len(workflows)}")
        for wf in workflows:
            print(f"Workflow ID: {wf.id}, Name: {wf.name}, Owner ID: {wf.owner_id}")
            # Check if graph has nodes and if nodes have IDs
            graph = wf.graph
            if not graph:
                print(f"  Warning: Workflow {wf.id} has no graph data.")
                continue
            
            nodes = graph.get("nodes", [])
            print(f"  Nodes count: {len(nodes)}")
            for node in nodes:
                node_id = node.get("id")
                if not node_id:
                    print(f"    Warning: Node in workflow {wf.id} is missing an 'id'.")
        
    except Exception as e:
        print(f"Error inspecting workflows: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect_workflows()
