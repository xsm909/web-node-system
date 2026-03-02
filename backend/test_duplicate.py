import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.node import NodeType
from app.core.config import DATABASE_URL

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_duplicate():
    db = SessionLocal()
    try:
        # Create first node type
        node1 = NodeType(name="TestNode", category="Cat A", description="Test 1")
        db.add(node1)
        db.commit()
        print("Created node 1: TestNode / Cat A")

        # Create second node type with same name but different category (Should succeed)
        node2 = NodeType(name="TestNode", category="Cat B", description="Test 2")
        db.add(node2)
        db.commit()
        print("Created node 2: TestNode / Cat B (Success!)")

        # Create third node type with same name and same category (Should fail)
        node3 = NodeType(name="TestNode", category="Cat A", description="Test 3")
        db.add(node3)
        try:
            db.commit()
            print("ERROR: Created node 3 with duplicate name/category, which should have failed.")
        except Exception as e:
            db.rollback()
            print("Node 3 failed expectedly due to UniqueConstraint:", type(e).__name__)

        # Cleanup
        db.delete(node1)
        db.delete(node2)
        db.commit()
        print("Cleanup successful.")

    except Exception as e:
        print("Unexpected error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    test_duplicate()
