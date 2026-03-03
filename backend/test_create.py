from app.core.database import SessionLocal
from app.models.workflow import Workflow
import uuid

db = SessionLocal()
try:
    # Get a user (admin)
    from app.models.user import User
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        print("No admin found")
    else:
        wf = Workflow(
            name="Test Script Workflow",
            owner_id=str(admin.id),
            created_by=admin.id,
            graph={"nodes": [], "edges": []}
        )
        db.add(wf)
        db.commit()
        db.refresh(wf)
        print(f"Workflow created: {wf.id}, {wf.name}, owner: {wf.owner_id}")
finally:
    db.close()
