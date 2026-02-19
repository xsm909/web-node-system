"""
Seed script: creates default admin, manager, and client users.
Run once after `docker compose up`:
  docker compose exec backend python -m app.seed
"""
from .core.database import SessionLocal, Base, engine
from .core.security import hash_password
from .models import User, RoleEnum, NodeType

Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        # Create users if they don't exist
        users_data = [
            {"username": "admin", "password": "admin123", "role": RoleEnum.admin},
            {"username": "manager1", "password": "manager123", "role": RoleEnum.manager},
            {"username": "client1", "password": "client123", "role": RoleEnum.client},
        ]
        created_users = {}
        for u in users_data:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if not existing:
                user = User(username=u["username"], hashed_password=hash_password(u["password"]), role=u["role"])
                db.add(user)
                db.flush()
                created_users[u["username"]] = user
                print(f"Created user: {u['username']} ({u['role']})")
            else:
                created_users[u["username"]] = existing
                print(f"User already exists: {u['username']}")

        # Assign client1 to manager1
        manager = created_users.get("manager1")
        client = created_users.get("client1")
        if manager and client and client not in manager.assigned_clients:
            manager.assigned_clients.append(client)
            print("Assigned client1 to manager1")

        if not db.query(NodeType).filter(NodeType.name == "Start").first():
            node = NodeType(
                name="Start",
                version="1.0",
                description="Entry point of the workflow execution system.",
                code="def run(inputs, params):\n    print('Workflow started')\n    return {}",
                input_schema={},
                output_schema={},
                parameters=[],
                category="System",
            )
            db.add(node)
            print("Created mandatory node type: Start")

        # Create a sample node type
        if not db.query(NodeType).filter(NodeType.name == "Print Node").first():
            node = NodeType(
                name="Print Node",
                version="1.0",
                description="Prints input value and passes it through",
                code="def run(inputs, params):\n    value = inputs.get('value', params.get('message', 'Hello!'))\n    print(f'Node output: {value}')\n    return {'value': value}",
                input_schema={"value": "string"},
                output_schema={"value": "string"},
                parameters=[{"name": "message", "type": "string", "default": "Hello!"}],
                category="Utility",
            )
            db.add(node)
            print("Created sample node type: Print Node")

        db.commit()
        print("\nSeed completed successfully!")
        print("\nDefault credentials:")
        print("  Admin:   admin / admin123")
        print("  Manager: manager1 / manager123")
        print("  Client:  client1 / client123")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
