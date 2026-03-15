import sys
import os
import uuid

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from app.core.database import SessionLocal
from app.models.response import Response

def verify():
    db = SessionLocal()
    test_id = uuid.uuid4()
    # A long string to test 'unlimited' length (TEXT/String)
    long_raw = "Start" + "A" * 10000 + "End"
    
    try:
        print(f"Creating test response with ID {test_id}...")
        test_response = Response(
            id=test_id,
            entity_id=uuid.uuid4(),
            entity_type="user", # assuming 'user' exists or regclass allows it
            category="test_raw",
            raw=long_raw
        )
        db.add(test_response)
        db.commit()
        
        print("Retrieving test response...")
        retrieved = db.query(Response).filter(Response.id == test_id).first()
        
        if retrieved and retrieved.raw == long_raw:
            print("SUCCESS: 'raw' field successfully saved and retrieved with long content.")
        else:
            print("FAILURE: Could not retrieve correct 'raw' content.")
            if not retrieved:
                print("Record not found.")
            elif retrieved.raw != long_raw:
                print(f"Content mismatch. Lengths: {len(retrieved.raw)} vs {len(long_raw)}")
        
        # Cleanup
        db.delete(retrieved)
        db.commit()
        print("Cleanup successful.")

    except Exception as e:
        print(f"ERROR during verification: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    verify()
