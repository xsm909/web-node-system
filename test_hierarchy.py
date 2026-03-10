import sys
import os
import uuid
import json
from sqlalchemy.orm import Session

# Add current directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from backend.app.core.database import SessionLocal
from backend.app.models import Record, MetaAssignment, Schema, User

def test_hierarchy():
    db = SessionLocal()
    try:
        print("Starting verification test...")
        
        # 1. Get or create a user and schema
        user = db.query(User).first()
        if not user:
            print("Creating test user...")
            from backend.app.core.security import get_password_hash
            user = User(username="testuser", hashed_password=get_password_hash("test"), role="admin")
            db.add(user)
            db.commit()
            db.refresh(user)

        schema = db.query(Schema).first()
        if not schema:
            print("Creating test schema...")
            schema = Schema(key="test-schema", content={"type": "object", "title": "Test Schema"})
            db.add(schema)
            db.commit()
            db.refresh(schema)

        print(f"Using user: {user.username}, schema: {schema.key}")

        # 2. Create parent record
        parent = Record(schema_id=schema.id, data={"name": "Parent Record"})
        db.add(parent)
        db.commit()
        db.refresh(parent)
        print(f"Created parent record: {parent.id}")

        # 3. Assign parent to the user entity
        assignment = MetaAssignment(
            record_id=parent.id,
            entity_type='user',
            entity_id=user.id,
            assigned_by=user.id,
            owner_id=user.id
        )
        db.add(assignment)
        db.commit()
        print(f"Assigned parent to user {user.id}")

        # 4. Create child record
        child = Record(schema_id=schema.id, parent_id=parent.id, data={"name": "Child Record"})
        db.add(child)
        db.commit()
        db.refresh(child)
        print(f"Created child record: {child.id} with parent_id: {child.parent_id}")

        # 5. Verify retrieval
        # Querying parent with children
        retrieved_parent = db.query(Record).filter(Record.id == parent.id).first()
        print(f"Retrieved parent children count: {len(retrieved_parent.children)}")
        
        if len(retrieved_parent.children) == 1 and retrieved_parent.children[0].id == child.id:
            print("SUCCESS: Hierarchy verified in database.")
        else:
            print("FAILURE: Hierarchy mismatch.")

    finally:
        db.close()

if __name__ == "__main__":
    test_hierarchy()
