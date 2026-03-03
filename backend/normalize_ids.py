from app.core.database import SessionLocal
from app.models.workflow import Workflow
import uuid

def normalize_ids():
    db = SessionLocal()
    try:
        workflows = db.query(Workflow).all()
        count = 0
        for wf in workflows:
            if wf.owner_id == "common":
                continue
            try:
                # Re-parse as UUID and back to string to ensure hyphenation
                normalized = str(uuid.UUID(wf.owner_id.replace("-", "")))
                if wf.owner_id != normalized:
                    print(f"Normalizing {wf.name}: {wf.owner_id} -> {normalized}")
                    wf.owner_id = normalized
                    count += 1
            except Exception as e:
                print(f"Skipping normalization for {wf.owner_id}: {e}")
        
        if count > 0:
            db.commit()
            print(f"Committed {count} normalizations.")
        else:
            print("No normalizations needed.")
    finally:
        db.close()

if __name__ == "__main__":
    normalize_ids()
