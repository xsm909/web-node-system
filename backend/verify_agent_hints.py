import sys
import os
import uuid
import json

# Add current directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.agent_hint import AgentHint
from app.models.user import User, RoleEnum
from app.schemas.agent_hint import AgentHintCreate, AgentHintUpdate

def verify():
    db = SessionLocal()
    try:
        # 1. Create a dummy user if not exists
        test_user = db.query(User).filter(User.username == "test_admin").first()
        if not test_user:
            test_user = User(
                username="test_admin",
                hashed_password="hashed_password",
                role=RoleEnum.admin
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)

        # 2. Create an Agent Hint
        hint_key = f"test-hint-{uuid.uuid4().hex[:6]}"
        hint_data = {
            "key": hint_key,
            "category": "Test",
            "hint": "## Test Hint\nThis is a *test* hint.",
            "system_hints": True,
            "meta": {"version": "1.0"}
        }
        
        db_hint = AgentHint(
            **hint_data,
            created_by=test_user.id
        )
        db.add(db_hint)
        db.commit()
        db.refresh(db_hint)
        print(f"✅ Created hint: {db_hint.key} (ID: {db_hint.id})")

        # 3. Verify immutability of key (simulated since SQLAlchemy doesn't strictly prevent it unless configured, but our router will)
        # Here we just verify the data is correct
        assert db_hint.key == hint_key
        assert db_hint.category == "Test"
        assert db_hint.system_hints == True
        assert "test" in db_hint.hint

        # 4. Update hint
        db_hint.category = "Updated Category"
        db_hint.system_hints = False
        db.commit()
        db.refresh(db_hint)
        assert db_hint.category == "Updated Category"
        assert db_hint.system_hints == False
        print("✅ Updated hint category and system_hints")

        # 5. List hints
        hints = db.query(AgentHint).filter(AgentHint.category == "Updated Category").all()
        assert len(hints) >= 1
        print(f"✅ Found {len(hints)} hints in category 'Updated Category'")

        # 6. Delete hint
        db.delete(db_hint)
        db.commit()
        print("✅ Deleted hint")

        print("\nAll database/model tests passed!")

    except Exception as e:
        print(f"❌ Verification failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    verify()
