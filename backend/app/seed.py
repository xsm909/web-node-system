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
            try:
                existing = db.query(User).filter(User.username == u["username"]).first()
            except Exception as e:
                print(f"Error querying user {u['username']}: {e}. Possibly legacy data.")
                existing = None
            
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

        # Node Types Seeding
        nodes_data = [
            {
                "name": "Start",
                "version": "1.0",
                "description": "Entry point of the workflow execution system.",
                "code": "def run(inputs, params):\n    print('Workflow started')\n    return {}",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "System",
                "icon": "play",
            },
            {
                "name": "Print Node",
                "version": "1.0",
                "description": "Prints input value and passes it through",
                "code": "def run(inputs, params):\n    value = inputs.get('value', params.get('message', 'Hello!'))\n    print(f'Node output: {value}')\n    return {'value': value}",
                "input_schema": {"value": "string"},
                "output_schema": {"value": "string"},
                "parameters": [{"name": "message", "type": "string", "default": "Hello!"}],
                "category": "Utility",
                "icon": "print",
            },
            {
                "name": "Ask AI",
                "version": "1.0",
                "description": "Asks Gemini AI a question using internal library.",
                "code": (
                    "class NodeParameters:\n"
                    "    question: str = 'What is the meaning of life?'\n\n"
                    "def run(inputs, params):\n"
                    "    # Get question from inputs or params\n"
                    "    question = inputs.get('question') or nodeParameters.question\n"
                    "    print(f'Asking AI: {question}')\n\n"
                    "    # Call internal library\n"
                    "    result = libs.ask_ai(question)\n\n"
                    "    return {'answer': result}"
                ),
                "input_schema": {"question": "string"},
                "output_schema": {"answer": "string"},
                "parameters": [{"name": "question", "type": "string", "default": "What is the meaning of life?"}],
                "category": "AI",
                "icon": "smart_toy",
            },
            {
                "name": "Condition",
                "version": "1.0",
                "description": "If/else branching node. Compares A and B, routes to branch 1 (equal) or branch 2 (not equal).",
                "code": (
                    "class NodeParameters:\n"
                    "    A: int = 1\n"
                    "    B: int = 1\n"
                    "    than: int = 0\n"
                    "    MAX_THAN: int = 2\n\n"
                    "def run(inputs, params):\n"
                    "    if nodeParameters.A == nodeParameters.B:\n"
                    "        nodeParameters.than = 1\n"
                    "    else:\n"
                    "        nodeParameters.than = 2\n"
                    "    return {'response': 'ok'}\n"
                ),
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {"name": "A", "type": "number", "label": "A", "default": 1},
                    {"name": "B", "type": "number", "label": "B", "default": 1},
                    {"name": "than", "type": "number", "label": "Than", "default": 0},
                    {"name": "MAX_THAN", "type": "number", "label": "Max Than", "default": 2},
                ],
                "category": "Logic",
                "icon": "call_split",
            },
        ]

        for node_data in nodes_data:
            existing_node = db.query(NodeType).filter(NodeType.name == node_data["name"]).first()
            if not existing_node:
                node = NodeType(**node_data)
                db.add(node)
                print(f"Created node type: {node_data['name']}")
            else:
                # Update existing node to match seed data
                for key, value in node_data.items():
                    setattr(existing_node, key, value)
                print(f"Updated node type: {node_data['name']}")

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
