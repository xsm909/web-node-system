from app.core.database import SessionLocal
from app.models.user import User, manager_client
import uuid

def check():
    db = SessionLocal()
    try:
        # Check association table
        print("Rows in manager_client:")
        rows = db.execute(manager_client.select()).fetchall()
        for row in rows:
            print(row)
            
        # Check managers of client1
        client = db.query(User).filter(User.username == "client1").first()
        if client:
            print(f"Client: {client.username} ({client.id})")
            print(f"Assigned Managers: {[m.username for m in client.assigned_managers]}")
            
        # Check clients of manager1
        manager = db.query(User).filter(User.username == "manager1").first()
        if manager:
            print(f"Manager: {manager.username} ({manager.id})")
            print(f"Assigned Clients: {[c.username for c in manager.assigned_clients]}")
            
    finally:
        db.close()

if __name__ == "__main__":
    check()
