from app.core.database import SessionLocal
from app.models.workflow import Workflow

def deep_check():
    db = SessionLocal()
    try:
        workflows = db.query(Workflow).all()
        for wf in workflows:
            print(f"Workflow {wf.id} ('{wf.name}'):")
            graph = wf.graph or {}
            nodes = graph.get("nodes", [])
            edges = graph.get("edges", [])
            
            missing_node_ids = []
            for i, node in enumerate(nodes):
                if not node.get("id"):
                    missing_node_ids.append(i)
            
            missing_edge_ids = []
            for i, edge in enumerate(edges):
                if not edge.get("id"):
                    missing_edge_ids.append(i)
            
            if missing_node_ids:
                print(f"  Nodes missing ID: {missing_node_ids}")
            else:
                print(f"  All {len(nodes)} nodes have IDs.")
                
            if missing_edge_ids:
                print(f"  Edges missing ID: {missing_edge_ids}")
            else:
                print(f"  All {len(edges)} edges have IDs.")
                
            # Also check for owner_id and status
            print(f"  Owner: {wf.owner_id}, Status: {wf.status}")
            
    except Exception as e:
        print(f"Error checking workflows: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    deep_check()
