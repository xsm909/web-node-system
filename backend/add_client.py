import sys
import os
import uuid
import bcrypt
from sqlalchemy import create_engine, Table, MetaData, Column, String, Enum, ForeignKey
from sqlalchemy.orm import sessionmaker

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import DATABASE_URL
from app.models.user import User, RoleEnum, manager_client
from app.core.database import SessionLocal

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def add_client_and_assign(username, password, manager_username):
    db = SessionLocal()
    try:
        # Check if client already exists
        client = db.query(User).filter(User.username == username).first()
        if not client:
            print(f"Creating client {username}...")
            client = User(
                id=uuid.uuid4(),
                username=username,
                hashed_password=hash_password(password),
                role=RoleEnum.client
            )
            db.add(client)
            db.commit()
            db.refresh(client)
        else:
            print(f"Client {username} already exists.")

        # Find manager
        manager = db.query(User).filter(User.username == manager_username).first()
        if not manager:
            print(f"Manager {manager_username} not found!")
            return

        # Assign client to manager
        if client not in manager.assigned_clients:
            print(f"Assigning {username} to {manager_username}...")
            manager.assigned_clients.append(client)
            db.commit()
            print("Successfully assigned.")
        else:
            print(f"Client {username} is already assigned to {manager_username}.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_client_and_assign("client2", "password", "manager1")
