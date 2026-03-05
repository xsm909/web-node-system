import json
import os
from app.core.database import SessionLocal
from app.models.workflow import Workflow

def sync():
    db = SessionLocal()
    try:
        workflows = db.query(Workflow).all()
        workflow_data = []
        for w in workflows:
            workflow_data.append({
                "id": str(w.id),
                "name": w.name,
                "owner_id": w.owner_id,
                "category": w.category,
                "status": w.status.value,
                "graph": w.graph,
                "workflow_data": w.workflow_data
            })
        
        output_path = os.path.join(os.path.dirname(__file__), "seed_workflow_data.py")
        with open(output_path, "w") as f:
            f.write("WORKFLOWS_DATA = \\\n")
            f.write(json.dumps(workflow_data, indent=4))
            f.write("\n")
        print(f"Dumped {len(workflow_data)} workflows to {output_path}")
    finally:
        db.close()

if __name__ == "__main__":
    sync()
