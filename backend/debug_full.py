"""
Full debug script: runs exactly what the frontend does, step by step.
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models.user import User
from app.models.workflow import Workflow
import uuid

def debug():
    db = SessionLocal()
    try:
        print("\n=== USERS IN DATABASE ===")
        users = db.query(User).all()
        for u in users:
            print(f"  id={u.id} (type={type(u.id).__name__}), username={u.username}, role={u.role}")
        
        print("\n=== WORKFLOWS IN DATABASE ===")
        workflows = db.query(Workflow).all()
        for wf in workflows:
            print(f"  id={wf.id}, name={wf.name}, owner_id='{wf.owner_id}' (type={type(wf.owner_id).__name__}), category={wf.category}, status={wf.status}")
        
        print("\n=== MATCHING TEST (simulating frontend fetch) ===")
        for u in users:
            user_id_str = str(u.id)
            print(f"\n  User: {u.username} ({user_id_str})")
            
            # Test 1: Exact string match
            exact = db.query(Workflow).filter(Workflow.owner_id == user_id_str).all()
            print(f"    Exact match (owner_id == '{user_id_str}'): {len(exact)} workflows")
            
            # Test 2: Lowercase
            lower = db.query(Workflow).filter(Workflow.owner_id == user_id_str.lower()).all()
            print(f"    Lowercase match: {len(lower)} workflows")
            
            # Show all workflow owner_ids for manual check
            for wf in workflows:
                matches = wf.owner_id == user_id_str
                print(f"      wf '{wf.name}': owner_id='{wf.owner_id}' == '{user_id_str}'? {matches}")
                
        print("\n=== COMMON WORKFLOWS ===")
        common = db.query(Workflow).filter(Workflow.owner_id == "common").all()
        print(f"  Common workflows: {len(common)}")
        for wf in common:
            print(f"    - {wf.name}")
            
    finally:
        db.close()

if __name__ == "__main__":
    debug()
