"""
Seed script: creates default admin, manager, and client users and default node types.
Run once after `docker compose up`:
  docker compose exec backend python -m app.seed
"""
from .core.database import SessionLocal, Base, engine
from .core.security import hash_password
from .models import User, RoleEnum, NodeType, AI_Result

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
                        "name": "Gemini Ask AI",
                        "version": "1.1",
                        "description": "Asks Gemini AI a question using internal library.",
                        "code": "class NodeParameters:
    question: str = 'What is the meaning of life?'

def run(inputs, params):
    # Get question from inputs or params
    question = inputs.get('question') or nodeParameters.question
    print(f'Asking AI: {question}')

    # Call internal library
    result = libs.ask_ai(question)
    print (f\"result: \")
    print (result);
    return {'answer': result}",
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
                        "name": "Tool: Calculator",
                        "version": "1.0",
                        "description": "Mathematical calculation tool for AI Agent",
                        "code": "def run(inputs, params):
    return {
        'name': 'calculator',
        'description': 'Calculates mathematical expressions',
        'parameters': {
            'type': 'object',
            'properties': {
                'expression': {'type': 'string'}
            }
        },
        'execute': libs.calculator
    }",
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
                        "name": "Show workflow data",
                        "version": "1.0",
                        "description": "Misc",
                        "code": "def print_data(data, indent=0):
    space = \"  \" * indent

    if isinstance(data, dict):
        for key, value in data.items():
            print(f\"{space}{key}:\")
            print_data(value, indent + 1)

    elif isinstance(data, list):
        for i, item in enumerate(data):
            print(f\"{space}[{i}]\")
            print_data(item, indent + 1)

    else:
        # Простое значение (строка, число, bool и т.д.)
        print(f\"{space}{data}\")


def run(inputs, params):
    data = libs.get_workflow_data()
    print_data(data)
    return {}",
                        "input_schema": {},
                        "output_schema": {},
                        "parameters": [],
                        "category": "Misc",
                        "icon": "task",
                        "is_async": False
            },
            {
                        "name": "Window Memory",
                        "version": "1.0",
                        "description": "Chat memory with a fixed window size.",
                        "code": "class NodeParameters:
    window_size: int = 5

def run(inputs, params):
    return {'type': 'window', 'size': nodeParameters.window_size}",
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
                        "name": "Delay",
                        "version": "1.1",
                        "description": "time.sleep",
                        "code": "class NodeParameters:
    delay: float = 1.5
  
def run(inputs, params):
    time.sleep(nodeParameters.delay)
    return inputs",
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
                        "name": "Echo",
                        "version": "1.1",
                        "description": "Echo",
                        "code": "class NodeParameters:
    text: str = \"Default value\"

def run(inputs, params):
    print(f\"Echo: {nodeParameters.text}\")
    return inputs",
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
                        "name": "Tool: Database",
                        "version": "1.0",
                        "description": "Database query tool for AI Agent.",
                        "code": "def run(inputs, params):
    return {
        'name': 'database',
        'description': 'Queries the primary database',
        'parameters': {
            'type': 'object',
            'properties': {
                'query': {'type': 'string'}
            }
        },
        'execute': libs.database_query
    }",
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
                        "name": "Reset runtime data",
                        "version": "1.0",
                        "description": "Reset runtime node",
                        "code": "def generate_empty_json(schema):
    if isinstance(schema, dict):
        # Check if schema describes object with properties
        if \"type\" in schema:
            t = schema[\"type\"]
            if t == \"object\":
                obj = {}
                props = schema.get(\"properties\", {})
                for key, subschema in props.items():
                    obj[key] = generate_empty_json(subschema)
                return obj
            elif t == \"array\":
                items_schema = schema.get(\"items\", {})
                # create list with one empty element
                return [generate_empty_json(items_schema)]
            elif t == \"string\":
                return \"\"
            elif t == \"number\":
                return 0
            elif t == \"boolean\":
                return False
            else:
                return None
        else:
            # If dict is direct properties mapping (simplified)
            obj = {}
            for key, subschema in schema.items():
                obj[key] = generate_empty_json(subschema)
            return obj
    elif isinstance(schema, list):
        return [generate_empty_json(schema[0])] if schema else []
    else:
        # fallback for unknown types
        return None

def run(inputs, params):
    schema = libs.get_runtime_schema()
    data = generate_empty_json(schema)
    libs.update_runtime_data(data)
    return {}",
                        "input_schema": {},
                        "output_schema": {},
                        "parameters": [],
                        "category": "Utility",
                        "icon": "task",
                        "is_async": False
            },
            {
                        "name": "OpenAI Chat Model",
                        "version": "1.0",
                        "description": "Configuration for OpenAI Chat Model.",
                        "code": "class NodeParameters:
    model: str = 'gpt-4o-mini'

def run(inputs, params):
    return {'model': nodeParameters.model, 'provider': 'openai'}",
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
                        "name": "Print",
                        "version": "1.0",
                        "description": "Print input parameters",
                        "code": "def run(inputs, params):
    print(inputs)
    return inputs;",
                        "input_schema": {},
                        "output_schema": {},
                        "parameters": [],
                        "category": "Utility",
                        "icon": "text",
                        "is_async": False
            },
            {
                        "name": "Open AI: Simple quesion",
                        "version": "1.0",
                        "description": "Open AI",
                        "code": "class NodeParameters:
    question: str = 'calculate 2+2'
    
def run(inputs, params):
    simple_answer = openai.ask_AI(nodeParameters.question)
    return simple_answer",
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
                        "name": "If ... than ... else",
                        "version": "1.5",
                        "description": "Simple condition example = ",
                        "code": "class NodeParameters:
    Argument: str = \"Param\"
    Value = \"Any\"
    than: int = 0
    MAX_THAN: int = 2

def run(inputs, params):
    if inputs[nodeParameters.Argument] == nodeParameters.Value:
        nodeParameters.than = 1
    else:
        nodeParameters.than = 2
    return inputs",
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
                        "name": "Set value",
                        "version": "1.1",
                        "description": "Set value in runtime",
                        "code": "class NodeParameters:
    Name: str = \"Param\"
    NewValue = \"Any\"

def run(inputs, params):
    data = libs.get_runtime_data ()
    data[nodeParameters.Name] = nodeParameters.NewValue
    libs.update_runtime_data(data)
    
    inputs [nodeParameters.Name] = nodeParameters.NewValue
    return inputs",
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
                        "name": "AI Agent",
                        "version": "1.0",
                        "description": "Modular AI Agent that uses tools, memory, and a chat model.",
                        "code": "class InputParameters:
    model: dict = None
    memory: dict = None
    tools: list = []

class NodeParameters:
    prompt: str = 'Help me with my task'

def run(inputs, params):
    model = inputParameters.model
    memory = inputParameters.memory
    tools = inputParameters.tools
    prompt = nodeParameters.prompt

    print(f'Agent running with model: {model}, tools: {len(tools) if tools else 0}')
    result = libs.agent_run(model, memory, tools, prompt, inputs)
    return {'output': result}",
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
                        "name": "Tool: Workflow Data",
                        "version": "1.0",
                        "description": "Allows AI Agent to read static workflow configuration.",
                        "code": "def run(inputs, params):
    return {
        'name': 'read_workflow_data',
        'description': 'Reads static workflow configuration JSON (environment variables, flow setup)',
        'parameters': {'type': 'object', 'properties': {}},
        'execute': libs.read_workflow_data
    }",
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
                        "name": "Tool: HTTP Request",
                        "version": "1.0",
                        "description": "Generic HTTP Request tool for AI Agent.",
                        "code": "def run(inputs, params):
    return {
        'name': 'http_request',
        'description': 'Performs an HTTP request to any URL',
        'parameters': {
            'type': 'object',
            'properties': {
                'url': {'type': 'string'},
                'method': {'type': 'string', 'default': 'GET'},
                'data': {'type': 'string', 'blank': True}
            }
        },
        'execute': libs.http_request
    }",
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
                        "name": "Tool: Google Search",
                        "version": "1.0",
                        "description": "Web search tool for AI Agent.",
                        "code": "def run(inputs, params):
    return {
        'name': 'google_search',
        'description': 'Searches the web for information using smart provider-aware tools',
        'parameters': {
            'type': 'object',
            'properties': {
                'query': {'type': 'string'}
            }
        },
        'execute': libs.smart_search
    }",
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
                        "name": "Workflow Data Read",
                        "version": "1.0",
                        "description": "Returns the workflow data as a JSON object.",
                        "code": "def run(inputs, params):
    data = libs.get_workflow_data()
    print(f'Workflow Data: {data}')
    return {'data': data}",
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
                        "name": "Tool: Runtime Data",
                        "version": "1.0",
                        "description": "Allows AI Agent to read and write dynamic runtime state.",
                        "code": "def run(inputs, params):
    return [
        {
            'name': 'read_runtime_data',
            'description': 'Reads dynamic runtime state JSON (shared data between nodes)',
            'parameters': {'type': 'object', 'properties': {}},
            'execute': libs.read_runtime_data
        },
        {
            'name': 'write_runtime_data',
            'description': 'Writes or updates dynamic runtime state JSON',
            'parameters': {
                'type': 'object',
                'properties': {
                    'data': {'type': 'string', 'description': 'JSON string to write or merge'}
                },
                'required': ['data']
            },
            'execute': libs.write_runtime_data
        }
    ]",
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
                        "name": "Runtime Data Write",
                        "version": "1.0",
                        "description": "Writes data to the runtime state of the execution.",
                        "code": "class NodeParameters:
    merge: bool = True

def run(inputs, params):
    new_data = inputs.get('data', {})
    if nodeParameters.merge:
        current = libs.get_runtime_data() or {}
        current.update(new_data)
        new_data = current
    libs.update_runtime_data(new_data)
    print(f'Runtime Data Updated: {new_data}')
    return {'success': True}",
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
                        "name": "Tool: Smart Search",
                        "version": "1.0",
                        "description": "Provider-aware search tool that automatically uses the best available search for the active model (OpenAI, Gemini, Perplexity).",
                        "code": "def run(inputs, params):
    return {
        'name': 'smart_search',
        'description': 'Intelligent web search that adapts to the chosen AI model',
        'parameters': {
            'type': 'object',
            'properties': {
                'query': {'type': 'string'}
            }
        },
        'execute': libs.smart_search
    }",
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
            }
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
