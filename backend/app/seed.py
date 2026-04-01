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
            {"username": "manager2", "password": "manager123", "role": RoleEnum.manager},
            {"username": "client1", "password": "client123", "role": RoleEnum.client},
            {"username": "client2", "password": "client123", "role": RoleEnum.client},
            {"username": "client3", "password": "client123", "role": RoleEnum.client},
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

        # Node Types Seeding
        nodes_data = [
            {
                "id": "391f2249-c0ca-42fe-bccb-f1e89e921dfa",
                "name": "Gemini Ask AI",
                "version": "1.1",
                "description": "Asks Gemini AI a question using internal library.",
                "code": "class NodeParameters:\n    question: str = 'What is the meaning of life?'\n\ndef run(inputs, params):\n    # Get question from inputs or params\n    question = inputs.get('question') or nodeParameters.question\n    print(f'Asking AI: {question}')\n\n    # Call internal library\n    result = libs.ask_ai(question)\n    print (f\"result: \")\n    print (result);\n    return {'answer': result}",
                "input_schema": {
                    "question": "string"
                },
                "output_schema": {
                    "answer": "string"
                },
                "parameters": [
                    {
                        "name": "question",
                        "type": "string",
                        "label": "Question",
                        "default": "What is the meaning of life?"
                    }
                ],
                "category": "AI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "4d1cbc99-b9af-4c09-8b82-f5dfaffd8a03",
                "name": "Tool: Calculator",
                "version": "1.0",
                "description": "Mathematical calculation tool for AI Agent",
                "code": "def run(inputs, params):\n    return {\n        'name': 'calculator',\n        'description': 'Calculates mathematical expressions',\n        'parameters': {\n            'type': 'object',\n            'properties': {\n                'expression': {'type': 'string'}\n            }\n        },\n        'execute': libs.calculator\n    }",
                "input_schema": {},
                "output_schema": {
                    "tool": "object",
                    "outputs": [
                        {
                            "name": "tool",
                            "label": "Tool"
                        }
                    ]
                },
                "parameters": [],
                "category": "AI Tools",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "47968a89-7a64-4b29-9fda-3c6ee1ed17cc",
                "name": "Show workflow data",
                "version": "1.0",
                "description": "Misc",
                "code": "def print_data(data, indent=0):\n    space = \"  \" * indent\n\n    if isinstance(data, dict):\n        for key, value in data.items():\n            print(f\"{space}{key}:\")\n            print_data(value, indent + 1)\n\n    elif isinstance(data, list):\n        for i, item in enumerate(data):\n            print(f\"{space}[{i}]\")\n            print_data(item, indent + 1)\n\n    else:\n        # \u041f\u0440\u043e\u0441\u0442\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 (\u0441\u0442\u0440\u043e\u043a\u0430, \u0447\u0438\u0441\u043b\u043e, bool \u0438 \u0442.\u0434.)\n        print(f\"{space}{data}\")\n\n\ndef run(inputs, params):\n    data = libs.get_workflow_data()\n    print_data(data)\n    return {}",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Misc",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "aafd23e2-a09b-4d9c-bb64-e9eb43d4351b",
                "name": "Window Memory",
                "version": "1.0",
                "description": "Chat memory with a fixed window size.",
                "code": "class NodeParameters:\n    window_size: int = 5\n\ndef run(inputs, params):\n    return {'type': 'window', 'size': nodeParameters.window_size}",
                "input_schema": {},
                "output_schema": {
                    "memory": "object",
                    "outputs": [
                        {
                            "name": "memory",
                            "label": "Memory"
                        }
                    ]
                },
                "parameters": [
                    {
                        "name": "window_size",
                        "type": "number",
                        "label": "Window Size",
                        "default": 5
                    }
                ],
                "category": "AI",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "8c5ccd2a-0352-4523-b14c-f840ab741bca",
                "name": "Delay",
                "version": "1.1",
                "description": "time.sleep",
                "code": "class NodeParameters:\n    delay: float = 1.5\n  \ndef run(inputs, params):\n    time.sleep(nodeParameters.delay)\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "delay",
                        "type": "number",
                        "label": "Delay",
                        "default": 1.5
                    }
                ],
                "category": "Utility",
                "icon": "timer",
                "is_async": False
            },
            {
                "id": "79126309-2b37-4662-80c1-364faacecd8c",
                "name": "Echo",
                "version": "1.1",
                "description": "Echo",
                "code": "class NodeParameters:\n    text: str = \"Default value\"\n\ndef run(inputs, params):\n    print(f\"Echo: {nodeParameters.text}\")\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "text",
                        "type": "string",
                        "label": "Text",
                        "default": "Default value"
                    }
                ],
                "category": "Utility",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "43f31448-9ae5-418c-9b1e-920a0b3e7995",
                "name": "Tool: Database",
                "version": "1.0",
                "description": "Database query tool for AI Agent.",
                "code": "def run(inputs, params):\n    return {\n        'name': 'database',\n        'description': 'Queries the primary database',\n        'parameters': {\n            'type': 'object',\n            'properties': {\n                'query': {'type': 'string'}\n            }\n        },\n        'execute': libs.database_query\n    }",
                "input_schema": {},
                "output_schema": {
                    "tool": "object",
                    "outputs": [
                        {
                            "name": "tool",
                            "label": "Tool"
                        }
                    ]
                },
                "parameters": [],
                "category": "AI Tools",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "c1f25995-95cc-42f9-8e2a-1985fc2b9712",
                "name": "Reset runtime data",
                "version": "1.0",
                "description": "Reset runtime node",
                "code": "def run(inputs, params):\n    libs.update_runtime_data({})\n    return {}",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Utility",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "6e1bc8fb-f814-4ce7-979a-a834af78ea01",
                "name": "OpenAI Chat Model",
                "version": "1.0",
                "description": "Configuration for OpenAI Chat Model.",
                "code": "class NodeParameters:\n    model: str = 'gpt-4o-mini'\n\ndef run(inputs, params):\n    return {'model': nodeParameters.model, 'provider': 'openai'}",
                "input_schema": {},
                "output_schema": {
                    "model": "object",
                    "outputs": [
                        {
                            "name": "model",
                            "label": "Model"
                        }
                    ]
                },
                "parameters": [
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gpt-4o-mini"
                    }
                ],
                "category": "AI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "3cab7d65-947a-452f-8dde-56dbacb65903",
                "name": "Gemini Chat Model",
                "version": "1.0",
                "description": "Configuration for Gemini Chat Model.",
                "code": "class NodeParameters:\n    model: str = 'gemini-1.5-flash'\n\ndef run(inputs, params):\n    return {'model': nodeParameters.model, 'provider': 'gemini'}",
                "input_schema": {},
                "output_schema": {
                    "model": "object",
                    "outputs": [
                        {
                            "name": "model",
                            "label": "Model"
                        }
                    ]
                },
                "parameters": [
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gemini-1.5-flash"
                    }
                ],
                "category": "AI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "8a9cfcc8-454f-4d13-b35e-58d43d49d9e7",
                "name": "Perplexity Chat Model",
                "version": "1.0",
                "description": "Configuration for Perplexity Chat Model.",
                "code": "class NodeParameters:\n    model: str = 'sonar'\n\ndef run(inputs, params):\n    return {'model': nodeParameters.model, 'provider': 'perplexity'}",
                "input_schema": {},
                "output_schema": {
                    "model": "object",
                    "outputs": [
                        {
                            "name": "model",
                            "label": "Model"
                        }
                    ]
                },
                "parameters": [
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "sonar"
                    }
                ],
                "category": "AI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "5533dd91-9996-4867-9aa1-e7043c0c54ea",
                "name": "Print",
                "version": "1.0",
                "description": "Print input parameters",
                "code": "def run(inputs, params):\n    print(inputs)\n    return inputs;",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Utility",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "1df4abd0-b95a-48c4-97a8-1c5c02e59608",
                "name": "Open AI: Simple quesion",
                "version": "1.0",
                "description": "Open AI",
                "code": "class NodeParameters:\n    question: str = 'calculate 2+2'\n    \ndef run(inputs, params):\n    simple_answer = openai.ask_AI(nodeParameters.question)\n    return simple_answer",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "question",
                        "type": "string",
                        "label": "Question",
                        "default": "calculate 2+2"
                    }
                ],
                "category": "AI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "1158f3e7-cee1-41bb-ac07-0ec0057df4b4",
                "name": "If ... than ... else",
                "version": "1.5",
                "description": "Simple condition example = ",
                "code": "class NodeParameters:\n    Argument: str = \"Param\"\n    Value = \"Any\"\n    than: int = 0\n    MAX_THAN: int = 2\n\ndef run(inputs, params):\n    if inputs[nodeParameters.Argument] == nodeParameters.Value:\n        nodeParameters.than = 1\n    else:\n        nodeParameters.than = 2\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "Argument",
                        "type": "string",
                        "label": "Argument",
                        "default": "Param"
                    },
                    {
                        "name": "Value",
                        "type": "string",
                        "label": "Value",
                        "default": "Any"
                    },
                    {
                        "name": "than",
                        "type": "number",
                        "label": "Than",
                        "default": 0
                    },
                    {
                        "name": "MAX_THAN",
                        "type": "number",
                        "label": "Max Than",
                        "default": 2
                    }
                ],
                "category": "Conditions",
                "icon": "graph",
                "is_async": False
            },
            {
                "id": "41859ad8-e9e0-4cb4-86bc-44b4126f3bf8",
                "name": "Set value",
                "version": "1.1",
                "description": "Set value in runtime",
                "code": "class NodeParameters:\n    Name: str = \"Param\"\n    NewValue = \"Any\"\n\ndef run(inputs, params):\n    data = libs.get_runtime_data ()\n    data[nodeParameters.Name] = nodeParameters.NewValue\n    libs.update_runtime_data(data)\n    \n    inputs [nodeParameters.Name] = nodeParameters.NewValue\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "Name",
                        "type": "string",
                        "label": "Name",
                        "default": "Param"
                    },
                    {
                        "name": "NewValue",
                        "type": "string",
                        "label": "Newvalue",
                        "default": "Any"
                    }
                ],
                "category": "Runtime data",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "2352b452-822b-4e20-80ea-19d331953e66",
                "name": "AI Agent",
                "version": "1.0",
                "description": "Modular AI Agent that uses tools, memory, and a chat model.",
                "code": "class InputParameters:\n    model: dict = None\n    memory: dict = None\n    tools: list = []\n\nclass NodeParameters:\n    prompt: str = 'Help me with my task'\n\ndef run(inputs, params):\n    model = inputParameters.model\n    memory = inputParameters.memory\n    tools = inputParameters.tools\n    prompt = nodeParameters.prompt\n\n    print(f'Agent running with model: {model}, tools: {len(tools) if tools else 0}')\n    result = libs.agent_run(model, memory, tools, prompt, inputs)\n    return {'output': result}",
                "input_schema": {
                    "model": "object",
                    "memory": "object",
                    "tools": "array",
                    "inputs": [
                        {
                            "name": "model",
                            "label": "Model"
                        },
                        {
                            "name": "memory",
                            "label": "Memory"
                        },
                        {
                            "name": "tools",
                            "label": "Tools"
                        }
                    ]
                },
                "output_schema": {
                    "output": "string",
                    "outputs": [
                        {
                            "name": "output",
                            "label": "Output"
                        }
                    ]
                },
                "parameters": [
                    {
                        "name": "prompt",
                        "type": "string",
                        "label": "Prompt",
                        "default": "Help me with my task"
                    }
                ],
                "category": "AI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "493f90d4-fa9d-4635-a56e-d80b74871fa3",
                "name": "Tool: Workflow Data",
                "version": "1.0",
                "description": "Allows AI Agent to read static workflow configuration.",
                "code": "def run(inputs, params):\n    return {\n        'name': 'read_workflow_data',\n        'description': 'Reads static workflow configuration JSON (environment variables, flow setup)',\n        'parameters': {'type': 'object', 'properties': {}},\n        'execute': libs.read_workflow_data\n    }",
                "input_schema": {},
                "output_schema": {
                    "tool": "object",
                    "outputs": [
                        {
                            "name": "tool",
                            "label": "Tool"
                        }
                    ]
                },
                "parameters": [],
                "category": "AI Tools",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "8be76f73-3be7-44cc-ae1c-161dd95e630b",
                "name": "Tool: HTTP Request",
                "version": "1.0",
                "description": "Generic HTTP Request tool for AI Agent.",
                "code": "def run(inputs, params):\n    return {\n        'name': 'http_request',\n        'description': 'Performs an HTTP request to any URL',\n        'parameters': {\n            'type': 'object',\n            'properties': {\n                'url': {'type': 'string'},\n                'method': {'type': 'string', 'default': 'GET'},\n                'data': {'type': 'string', 'blank': True}\n            }\n        },\n        'execute': libs.http_request\n    }",
                "input_schema": {},
                "output_schema": {
                    "tool": "object",
                    "outputs": [
                        {
                            "name": "tool",
                            "label": "Tool"
                        }
                    ]
                },
                "parameters": [],
                "category": "AI Tools",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "6f287465-c589-41f9-906d-fb154cd72670",
                "name": "Tool: Google Search",
                "version": "1.0",
                "description": "Web search tool for AI Agent.",
                "code": "def run(inputs, params):\n    return {\n        'name': 'google_search',\n        'description': 'Searches the web for information using smart provider-aware tools',\n        'parameters': {\n            'type': 'object',\n            'properties': {\n                'query': {'type': 'string'}\n            }\n        },\n        'execute': libs.smart_search\n    }",
                "input_schema": {},
                "output_schema": {
                    "tool": "object",
                    "outputs": [
                        {
                            "name": "tool",
                            "label": "Tool"
                        }
                    ]
                },
                "parameters": [],
                "category": "AI Tools",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "0b788cea-b6f8-467a-b543-3c1c035640a2",
                "name": "Workflow Data Read",
                "version": "1.0",
                "description": "Returns the workflow data as a JSON object.",
                "code": "def run(inputs, params):\n    data = libs.get_workflow_data()\n    print(f'Workflow Data: {data}')\n    return {'data': data}",
                "input_schema": {},
                "output_schema": {
                    "data": "object",
                    "outputs": [
                        {
                            "name": "data",
                            "label": "Data"
                        }
                    ]
                },
                "parameters": [],
                "category": "Data",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "dffffaed-349f-4d42-8f3e-6ef97b2feca2",
                "name": "Tool: Runtime Data",
                "version": "1.0",
                "description": "Allows AI Agent to read and write dynamic runtime state.",
                "code": "def run(inputs, params):\n    return [\n        {\n            'name': 'read_runtime_data',\n            'description': 'Reads dynamic runtime state JSON (shared data between nodes)',\n            'parameters': {'type': 'object', 'properties': {}},\n            'execute': libs.read_runtime_data\n        },\n        {\n            'name': 'write_runtime_data',\n            'description': 'Writes or updates dynamic runtime state JSON',\n            'parameters': {\n                'type': 'object',\n                'properties': {\n                    'data': {'type': 'string', 'description': 'JSON string to write or merge'}\n                },\n                'required': ['data']\n            },\n            'execute': libs.write_runtime_data\n        }\n    ]",
                "input_schema": {},
                "output_schema": {
                    "tool": "object",
                    "outputs": [
                        {
                            "name": "tool",
                            "label": "Tool"
                        }
                    ]
                },
                "parameters": [],
                "category": "AI Tools",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "ea770531-fded-49d1-8bd8-3f612b96565a",
                "name": "Runtime Data Write",
                "version": "1.0",
                "description": "Writes data to the runtime state of the execution.",
                "code": "class NodeParameters:\n    merge: bool = True\n\ndef run(inputs, params):\n    new_data = inputs.get('data', {})\n    if nodeParameters.merge:\n        current = libs.get_runtime_data() or {}\n        current.update(new_data)\n        new_data = current\n    libs.update_runtime_data(new_data)\n    print(f'Runtime Data Updated: {new_data}')\n    return {'success': True}",
                "input_schema": {
                    "data": "object"
                },
                "output_schema": {
                    "success": "boolean",
                    "outputs": [
                        {
                            "name": "success",
                            "label": "Success"
                        }
                    ]
                },
                "parameters": [
                    {
                        "name": "merge",
                        "type": "boolean",
                        "label": "Merge",
                        "default": True
                    }
                ],
                "category": "Data",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "7ce38cfe-0f1a-4eca-947f-47b3e0f2441e",
                "name": "Tool: Smart Search",
                "version": "1.0",
                "description": "Provider-aware search tool that automatically uses the best available search for the active model (OpenAI, Gemini, Perplexity).",
                "code": "def run(inputs, params):\n    return {\n        'name': 'smart_search',\n        'description': 'Intelligent web search that adapts to the chosen AI model',\n        'parameters': {\n            'type': 'object',\n            'properties': {\n                'query': {'type': 'string'}\n            }\n        },\n        'execute': libs.smart_search\n    }",
                "input_schema": {},
                "output_schema": {
                    "tool": "object",
                    "outputs": [
                        {
                            "name": "tool",
                            "label": "Tool"
                        }
                    ]
                },
                "parameters": [],
                "category": "AI Tools",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "fa99a568-3a63-4ffb-9d97-b70b12b76fae",
                "name": "TestNode",
                "version": "1.0",
                "description": None,
                "code": "def run(inputs, params):\n    # Test if responce_data is available\n    res = responce_data.add_responce(\n        entity_id=params.entity_id,\n        entity_type=\"test\",\n        category=\"test_cat\",\n        context={\"hello\": \"executor\"},\n        context_type=\"json\"\n    )\n    return {\"record_id\": res}\n",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "test",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "b8a9e98a-85bb-4aa0-b3df-eeb1cec059de",
                "name": "JSONTestNodeV2",
                "version": "1.0",
                "description": None,
                "code": "def run(inputs, params):\n    schema = {\n        \"type\": \"object\",\n        \"properties\": {\n            \"name\": {\"type\": \"string\"}\n        },\n        \"required\": [\"name\"]\n    }\n    \n    valid_data = '{\"name\": \"Alice\"}'\n    invalid_data = '{\"age\": 30}'\n    \n    res_v = common.is_valid_json(valid_data, schema)\n    res_i = common.is_valid_json(invalid_data, schema)\n    \n    return {\"valid\": res_v, \"invalid\": res_i}\n",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "test",
                "icon": "task",
                "is_async": False
            }
        ]

        # Sync nodes: Update existing, create new, and DELETE unnecessary ones
        seed_ids = [n["id"] for n in nodes_data if "id" in n]
        seed_names = [n["name"] for n in nodes_data if "id" not in n]
        
        # 1. DELETE nodes that are not in nodes_data
        all_db_nodes = db.query(NodeType).all()
        for db_node in all_db_nodes:
            # Delete if not matched by ID (if ID exists in seed) AND not matched by name/category (if no ID in seed)
            is_in_seed = False
            if str(db_node.id) in seed_ids:
                is_in_seed = True
            elif db_node.name in seed_names:
                # If we don't have an ID for this name in seed, we assume it matches
                is_in_seed = True
                
            if not is_in_seed:
                db.delete(db_node)
                print(f"Deleted unnecessary node type: {db_node.name}")

        # 2. CREATE or UPDATE nodes
        for node_data in nodes_data:
            existing_node = None
            if "id" in node_data:
                existing_node = db.query(NodeType).filter(NodeType.id == node_data["id"]).first()
            
            if not existing_node:
                existing_node = db.query(NodeType).filter(
                    NodeType.name == node_data["name"],
                    NodeType.category == node_data.get("category")
                ).first()

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
