"""
Seed script: creates default admin, manager, and client users and default node types.
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
                "name": "AI Agent",
                "version": "1.0",
                "description": "Modular AI Agent that uses tools, memory, and a chat model.",
                "code": (
                    "class InputParameters:\n"
                    "    model: dict = None\n"
                    "    memory: dict = None\n"
                    "    tools: list = []\n\n"
                    "class NodeParameters:\n"
                    "    prompt: str = 'Help me with my task'\n\n"
                    "def run(inputs, params):\n"
                    "    model = inputParameters.model\n"
                    "    memory = inputParameters.memory\n"
                    "    tools = inputParameters.tools\n"
                    "    prompt = nodeParameters.prompt\n\n"
                    "    print(f'Agent running with model: {model}, tools: {len(tools) if tools else 0}')\n"
                    "    result = libs.agent_run(model, memory, tools, prompt, inputs)\n"
                    "    return {'output': result}"
                ),
                "input_schema": {"model": "object", "memory": "object", "tools": "array"},
                "output_schema": {"output": "string"},
                "parameters": [{"name": "prompt", "type": "string", "default": "Help me with my task"}],
                "category": "AI",
                "icon": "smart_toy",
            },
            {
                "name": "OpenAI Chat Model",
                "version": "1.0",
                "description": "Configuration for OpenAI Chat Model.",
                "code": (
                    "class NodeParameters:\n"
                    "    model: str = 'gpt-4o-mini'\n\n"
                    "def run(inputs, params):\n"
                    "    return {'model': nodeParameters.model, 'provider': 'openai'}"
                ),
                "input_schema": {},
                "output_schema": {"model": "object"},
                "parameters": [{"name": "model", "type": "string", "default": "gpt-4o-mini"}],
                "category": "AI",
                "icon": "settings_suggest",
            },
            {
                "name": "Window Memory",
                "version": "1.0",
                "description": "Chat memory with a fixed window size.",
                "code": (
                    "class NodeParameters:\n"
                    "    window_size: int = 5\n\n"
                    "def run(inputs, params):\n"
                    "    return {'type': 'window', 'size': nodeParameters.window_size}"
                ),
                "input_schema": {},
                "output_schema": {"memory": "object"},
                "parameters": [{"name": "window_size", "type": "number", "default": 5}],
                "category": "AI",
                "icon": "memory",
            },
            {
                "name": "Tool: Calculator",
                "version": "1.0",
                "description": "Mathematical calculation tool for AI Agent.",
                "code": (
                    "def run(inputs, params):\n"
                    "    return {\n"
                    "        'name': 'calculator',\n"
                    "        'description': 'Calculates mathematical expressions',\n"
                    "        'parameters': {\n"
                    "            'type': 'object',\n"
                    "            'properties': {\n"
                    "                'expression': {'type': 'string'}\n"
                    "            }\n"
                    "        },\n"
                    "        'execute': libs.calculator\n"
                    "    }"
                ),
                "input_schema": {},
                "output_schema": {"tool": "object"},
                "parameters": [],
                "category": "AI Tools",
                "icon": "calculate",
            },
            {
                "name": "Tool: Database",
                "version": "1.0",
                "description": "Database query tool for AI Agent.",
                "code": (
                    "def run(inputs, params):\n"
                    "    return {\n"
                    "        'name': 'database',\n"
                    "        'description': 'Queries the primary database',\n"
                    "        'parameters': {\n"
                    "            'type': 'object',\n"
                    "            'properties': {\n"
                    "                'query': {'type': 'string'}\n"
                    "            }\n"
                    "        },\n"
                    "        'execute': libs.database_query\n"
                    "    }"
                ),
                "input_schema": {},
                "output_schema": {"tool": "object"},
                "parameters": [],
                "category": "AI Tools",
                "icon": "database",
            },
            {
                "name": "Tool: HTTP Request",
                "version": "1.0",
                "description": "Generic HTTP Request tool for AI Agent.",
                "code": (
                    "def run(inputs, params):\n"
                    "    return {\n"
                    "        'name': 'http_request',\n"
                    "        'description': 'Performs an HTTP request to any URL',\n"
                    "        'parameters': {\n"
                    "            'type': 'object',\n"
                    "            'properties': {\n"
                    "                'url': {'type': 'string'},\n"
                    "                'method': {'type': 'string', 'default': 'GET'},\n"
                    "                'data': {'type': 'string', 'blank': True}\n"
                    "            }\n"
                    "        },\n"
                    "        'execute': libs.http_request\n"
                    "    }"
                ),
                "input_schema": {},
                "output_schema": {"tool": "object"},
                "parameters": [],
                "category": "AI Tools",
                "icon": "http",
            },
            {
                "name": "Tool: Google Search",
                "version": "1.0",
                "description": "Web search tool for AI Agent.",
                "code": (
                    "def run(inputs, params):\n"
                    "    return {\n"
                    "        'name': 'google_search',\n"
                    "        'description': 'Searches the web for information',\n"
                    "        'parameters': {\n"
                    "            'type': 'object',\n"
                    "            'properties': {\n"
                    "                'query': {'type': 'string'}\n"
                    "            }\n"
                    "        },\n"
                    "        'execute': libs.http_search\n"
                    "    }"
                ),
                "input_schema": {},
                "output_schema": {"tool": "object"},
                "parameters": [],
                "category": "AI Tools",
                "icon": "search",
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

    finally:
        db.close()


if __name__ == "__main__":
    seed()
