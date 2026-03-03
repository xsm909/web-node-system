from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.database import SessionLocal
from app.models.user import User
import uuid

client = TestClient(app)

def test_api():
    db = SessionLocal()
    admin = db.query(User).filter(User.role == "admin").first()
    manager = db.query(User).filter(User.role == "manager").first()
    cl = db.query(User).filter(User.role == "client").first()
    db.close()

    for user in [admin, manager, cl]:
        if not user: continue
        print(f"\n--- Testing for user: {user.username} (role: {user.role}) ---")
        token = create_access_token(data={"sub": user.username})
        headers = {"Authorization": f"Bearer {token}"}
        
        # 1. Get users
        res = client.get("/workflows/users", headers=headers)
        print(f"GET /workflows/users: {res.status_code}")
        print(f"Users: {res.json()}")
        
        # 2. Get own workflows
        res = client.get(f"/workflows/users/{user.id}/workflows", headers=headers)
        print(f"GET /workflows/users/{user.id}/workflows: {res.status_code}")
        print(f"Workflows: {res.json()}")
        
        # 3. Get common workflows
        res = client.get("/workflows/common", headers=headers)
        print(f"GET /workflows/common: {res.status_code}")
        print(f"Common: {len(res.json())} workflows")

if __name__ == "__main__":
    test_api()
