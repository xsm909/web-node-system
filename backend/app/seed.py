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
                "id": "23dc8df3-c1c3-48c1-8e0f-d0f5b746c942",
                "name": "Clear analytics data",
                "version": "1.0",
                "description": "Clear answer of model",
                "code": "class NodeParameters:\n    analytic_type:str = \"Mention\"\n    \ndef clear_answers_of_model (session_id, category, analytic_type):\n    query = f\"\"\"\n    DELETE FROM intermediate_results\n    WHERE session_id = '{session_id}' \n      AND sub_category = '{category}' \n      AND (category = 'Analysis|{analytic_type}')\n    \"\"\"\n    inner_database.unsafe_request(query)\n    \n                              \n        \ndef run(inputs, params):\n    \n    runtime = libs.get_runtime_data()\n    client_id = runtime[\"_active_client_id\"]\n    session_id = runtime[\"_session_id\"]\n    category = runtime[\"_category\"]\n\n    clear_answers_of_model (session_id, category, params.analytic_type)\n    \n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "analytic_type",
                        "type": "string",
                        "label": "Analytic Type",
                        "default": "Mention",
                        "options_source": None
                    }
                ],
                "category": "Database|Analytics",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "d79f032f-99de-49fd-8e96-319e89dbdf57",
                "name": "Get all client metadata",
                "version": "1.0",
                "description": "",
                "code": "def run(inputs, params):\n    client_id = common.get_active_client()\n    print (client_id['id'])\n    return metadata.get_all_metadata ('client', client_id['id'])",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Metadata",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "42394a9d-1631-42c5-8790-81a83154a196",
                "name": "Get client metadata",
                "version": "1.0",
                "description": "",
                "code": "class NodeParameters:\n    key: str = \"Default value\"  # @table-schemas->key,schemas->key\n    \ndef run(inputs, params):\n    client_id = common.get_active_client()\n    print (client_id['id'])\n    return metadata.get_metadata ('client', client_id['id'], params.key)",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "key",
                        "type": "string",
                        "label": "Key",
                        "default": "Default value",
                        "options_source": {
                            "table": "schemas",
                            "value_field": "key",
                            "label_field": "key",
                            "component": "ComboBox"
                        }
                    }
                ],
                "category": "Metadata",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "67c570d8-10d6-4e16-b00c-03535f6fe38d",
                "name": "Simple prompts generator",
                "version": "1.0",
                "description": "",
                "code": "def run(inputs, params):\n    result_schema = \"common-prompts\"\n    client_id = common.get_active_client()\n    res = meta.get_client_metadata_by_schema (client_id['id'], \"brand\")\n\n    for brand in res:\n        print (brand['name'])\n        print (brand['__id__'])\n\n    \n        agent_hint = agent.get_agent_hint_by_key (\"brand_prompt_generator\")\n        agent_task = json.dumps(brand, ensure_ascii=False, indent=2)\n        \n        provider = \"gemini-pro-latest\"\n        result = agent.run(\n            model=provider,       # \u041c\u043e\u0434\u0435\u043b\u044c (openai, gemini, perplexity)\n            tools=[\"google_search\",\"get_all_client_metadata\", \"get_schema_by_key\"], # \u0421\u043f\u0438\u0441\u043e\u043a \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u043e\u0432\n            hint=agent_hint,\n            task=agent_task,\n            schema_key = result_schema,\n            iteration_limit=5\n        )\n\n        prompts.add_prompt (brand['__id__'], \"records\", \"awareness\", result, result_schema, client_id['id'])",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "AI",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "7691cfb8-7b62-4ac9-8278-89d3facff144",
                "name": "Get answer on the prompt and save",
                "version": "1.0",
                "description": "",
                "code": "class NodeParameters:\n    model : str = \"gemini-pro-latest\"\n    prompt_category : str\n    search: bool = True\n\ndef run(inputs, params):\n    \n    runtime = libs.get_runtime_data()\n    client_id = common.get_active_client()['id']\n    result_schema = \"common-response-links\"\n    agent_hint = agent.get_agent_hint_by_key ('simple-question')\n    tools = [];\n    provider = common.GetAIByModel (params.model)\n    gen_category = f\"{params.prompt_category}|{provider}\";\n\n    if params.search:\n        if provider == 'Gemini':\n            tools = [\"google_search\"]\n        else:\n            tools = [\"smart_search\"]\n    \n    prompts_list = prompts.get_prompts_by_category_with_reference_id (\n            params.prompt_category, \n            client_id\n            )\n    \n    for prompt in prompts_list:\n        r = json.loads(prompt['content'])\n        entity_id = prompt['id']\n\n        #check empty\n        if not entity_id:\n            return\n        \n        #clear data\n        response_data.clear_recent_records_by_entity_and_category (\n                entity_id,\n                gen_category,\n                30\n            )\n        for p in r['prompts']:\n            print(f\"Question>> {provider}>> {p}\")\n            agent_task = json.dumps(p)\n            retries = 3\n            \n            for attempt in range(retries):\n                try:\n                    \n                    result = agent.run(\n                        model=params.model,\n                        tools=tools,\n                        hint=agent_hint,\n                        task=agent_task,\n                        schema_key=result_schema,\n                        iteration_limit=15\n                    )\n                    break  \n                except Exception as e:\n                    print(f\"Error: {e}\")\n                    if attempt < retries - 1:\n                        print(\"Retry in 5 seconds...\")\n                        time.sleep(5)\n                    else:\n                        raise  # \u043f\u043e\u0441\u043b\u0435 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0439 \u043f\u043e\u043f\u044b\u0442\u043a\u0438 \u043f\u0440\u043e\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0435\u043c \u0438\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435\n    \n            print(result)\n\n            \n            response_data.add_response (\n                entity_id = entity_id,\n                entity_type = 'prompts',\n                category = gen_category,\n                context = result,\n                context_type = result_schema,\n                reference_id = client_id,\n                reference_type = 'users'\n                \n            )\n            \n    return {}",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gemini-pro-latest",
                        "options_source": None
                    },
                    {
                        "name": "prompt_category",
                        "type": "string",
                        "label": "Prompt Category",
                        "default": None,
                        "options_source": None
                    },
                    {
                        "name": "search",
                        "type": "boolean",
                        "label": "Search",
                        "default": True,
                        "options_source": None
                    }
                ],
                "category": "AI|Analysis",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "d1b937b7-6200-4449-aa8b-e90d53542d54",
                "name": "function checker 2",
                "version": "1.0",
                "description": "",
                "code": "def run(inputs, params):\n    client_id = common.get_active_client()\n    print (client_id)\n    res = meta.get_client_metadata_by_schema (client_id['id'], \"category\")\n    \n    for item in res:\n        for persona_id in item['persona']:\n            persona = meta.get_metadata_by_id(persona_id)\n            \n            print (item['name'] + \" - \" + persona['persona_name'])\n    return {}",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "temp",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "089549e1-1ea8-4c61-a739-afb66300ff3b",
                "name": "build_recursive_query",
                "version": "1.2",
                "description": "Database query",
                "code": "class NodeParameters:\n    id: str = \"\"\n    key: str = \"\"\n    \n\ndef build_recursive_query(record_id: str, schema_key: str) -> str:\n    \"\"\"\n    \u0424\u043e\u0440\u043c\u0438\u0440\u0443\u0435\u0442 SQL-\u0437\u0430\u043f\u0440\u043e\u0441 \u0434\u043b\u044f PostgreSQL:\n    1) \u041d\u0430\u0445\u043e\u0434\u0438\u0442 id \u0441\u0445\u0435\u043c\u044b \u043f\u043e schema.key\n    2) \u041d\u0430\u0445\u043e\u0434\u0438\u0442 root \u0440\u043e\u0434\u0438\u0442\u0435\u043b\u044f \u0434\u043b\u044f \u043f\u0435\u0440\u0435\u0434\u0430\u043d\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438\n    3) \u0412\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u0432\u0441\u0435\u0445 \u043f\u043e\u0442\u043e\u043c\u043a\u043e\u0432 root \u0441 \u043d\u0443\u0436\u043d\u043e\u0439 \u0441\u0445\u0435\u043c\u043e\u0439\n    \"\"\"\n    query = f\"\"\"\nWITH schema_id AS (\n    SELECT id\n    FROM schemas\n    WHERE key = '{schema_key}'\n),\nroot AS (\n    -- \u0438\u0449\u0435\u043c \u043a\u043e\u0440\u0435\u043d\u044c \u0434\u043b\u044f \u0434\u0430\u043d\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438\n    WITH RECURSIVE tree AS (\n        SELECT id, parent_id\n        FROM records\n        WHERE id = '{record_id}'\n\n        UNION ALL\n\n        SELECT r.id, r.parent_id\n        FROM records r\n        JOIN tree t ON r.id = t.parent_id\n    )\n    SELECT id AS root_id\n    FROM tree\n    WHERE parent_id IS NULL\n    LIMIT 1\n),\ndescendants AS (\n    -- \u0440\u0435\u043a\u0443\u0440\u0441\u0438\u0432\u043d\u043e \u0441\u043e\u0431\u0438\u0440\u0430\u0435\u043c \u0432\u0441\u0435\u0445 \u043f\u043e\u0442\u043e\u043c\u043a\u043e\u0432 root\n    WITH RECURSIVE tree AS (\n        SELECT r.id, r.parent_id, r.schema_id\n        FROM records r\n        JOIN root ON r.id = root.root_id\n\n        UNION ALL\n\n        SELECT r.id, r.parent_id, r.schema_id\n        FROM records r\n        JOIN tree t ON r.parent_id = t.id\n    )\n    SELECT *\n    FROM tree\n)\nSELECT id\nFROM descendants\nWHERE schema_id = (SELECT id FROM schema_id);\n\"\"\"\n    return query\n\ndef run(inputs, params):\n    query = build_recursive_query (params.id, params.key)\n    result = inner_database.unsafe_request(query)\n    return result\n    ",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "id",
                        "type": "string",
                        "label": "Id",
                        "default": "",
                        "options_source": None
                    },
                    {
                        "name": "key",
                        "type": "string",
                        "label": "Key",
                        "default": "",
                        "options_source": None
                    }
                ],
                "category": "Database",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "00b5baeb-c29d-4236-98d2-c06cb2e5b683",
                "name": "Window Memory",
                "version": "1.0",
                "description": "Chat memory with a fixed window size.",
                "code": "class NodeParameters:\n    window_size: int = 5\n\ndef run(inputs, params):\n    return {'type': 'window', 'size': params.window_size}",
                "input_schema": {},
                "output_schema": {
                    "memory": "object"
                },
                "parameters": [
                    {
                        "name": "window_size",
                        "type": "number",
                        "label": "Window Size",
                        "default": 5
                    }
                ],
                "category": "AI|Memory",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "21050925-7b7c-4366-a05c-233565408157",
                "name": "Perform Web Search",
                "version": "1.0",
                "description": "Gemini AI question with web search",
                "code": "class NodeParameters:\n    question: str = 'What was a positive news story from today?'\n    model: str = 'gemini-2.0-flash'\n    \ndef run(inputs, params):\n    respons = gemini.perform_web_search(params.question, params.model)\n    return respons",
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
                        "default": "What was a positive news story from today?"
                    },
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gemini-2.0-flash"
                    }
                ],
                "category": "AI|Chat|Gemini",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "232bbc82-bc33-47c4-8eea-9bfd8e31dec1",
                "name": "Tool: Smart Search",
                "version": "1.0",
                "description": "Provider-aware search tool that automatically uses the best available search for the active model (OpenAI, Gemini, Perplexity).",
                "code": "def run(inputs, params):\n    return {\n        'name': 'smart_search',\n        'description': 'Intelligent web search that adapts to the chosen AI model',\n        'parameters': {\n            'type': 'object',\n            'properties': {\n                'query': {'type': 'string'}\n            }\n        },\n        'execute': libs.smart_search\n    }",
                "input_schema": {},
                "output_schema": {
                    "tool": "object"
                },
                "parameters": [],
                "category": "AI|Tools",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "3db6021e-0a60-4521-adaa-7de8e46680c1",
                "name": "Show workflow data",
                "version": "1.0",
                "description": "Misc",
                "code": "def print_data(data, indent=0):\n    space = \"  \" * indent\n\n    if isinstance(data, dict):\n        for key, value in data.items():\n            print(f\"{space}{key}:\")\n            print_data(value, indent + 1)\n\n    elif isinstance(data, list):\n        for i, item in enumerate(data):\n            print(f\"{space}[{i}]\")\n            print_data(item, indent + 1)\n\n    else:\n        # \u041f\u0440\u043e\u0441\u0442\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 (\u0441\u0442\u0440\u043e\u043a\u0430, \u0447\u0438\u0441\u043b\u043e, bool \u0438 \u0442.\u0434.)\n        print(f\"{space}{data}\")\n\n\ndef run(inputs, params):\n    data = libs.get_workflow_data()\n    print_data(data)\n    return {}",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Utility|Console",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "3db851a2-2ead-48d2-98e0-bab4d4fdc374",
                "name": "Simple question",
                "version": "1.2",
                "description": "Asks Gemini AI a question using internal library.",
                "code": "class NodeParameters:\n    question: str = 'What is the meaning of life?'\n    model: str = 'gemini-1.5-flash'\n\ndef run(inputs, params):\n    question = params.question\n    model = params.model\n    result = gemini.ask_single(question, model)\n    return result",
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
                    },
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gemini-1.5-flash"
                    }
                ],
                "category": "AI|Chat|Gemini",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "464a7974-f119-4593-9773-288762010869",
                "name": "Simple question",
                "version": "1.2",
                "description": "Asks Gemini AI a question using internal library.",
                "code": "class NodeParameters:\n    question: str = 'What is the meaning of life?'\n    model: str = 'sonar'\n\ndef run(inputs, params):\n    question = params.question\n    model = params.model\n    result = perplexity.ask_single(question, model)\n    return result",
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
                    },
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "sonar"
                    }
                ],
                "category": "AI|Chat|Perplexity",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "649bb229-0d7d-48e1-b1e5-fd6fef6fc78b",
                "name": "Perform Web Search",
                "version": "1.0",
                "description": "Open  AI question with web search",
                "code": "class NodeParameters:\n    question: str = 'What was a positive news story from today?'\n    model: str = 'gpt-4o'\n    \ndef run(inputs, params):\n    respons = openai.perform_web_search(params.question, params.model)\n    return respons",
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
                        "default": "What was a positive news story from today?"
                    },
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gpt-4o"
                    }
                ],
                "category": "AI|Chat|OpenAI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "68afd1cd-c639-41e7-ba6d-88811e2f1729",
                "name": "Workflow Data Read",
                "version": "1.0",
                "description": "Returns the workflow data as a JSON object.",
                "code": "def run(inputs, params):\n    data = libs.get_workflow_data()\n    print(f'Workflow Data: {data}')\n    return {'data': data}",
                "input_schema": {},
                "output_schema": {
                    "data": "object"
                },
                "parameters": [],
                "category": "Data|Workflow",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "5815fb62-cac0-4ac8-bac0-2b865c0d57fd",
                "name": "Echo",
                "version": "1.1",
                "description": "Echo",
                "code": "class NodeParameters:\n    text: str = \"Default value\"\n    runtime: bool = True;\n\ndef run(inputs, params):\n    \n    pattern = params[\"text\"]\n    if params.runtime:\n        result = pattern.format(**libs.get_runtime_data())\n    else:\n        result = pattern.format(**inputs)\n        \n    print(result)\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "text",
                        "type": "string",
                        "label": "Text",
                        "default": "Default value"
                    },
                    {
                        "name": "runtime",
                        "type": "boolean",
                        "label": "Runtime",
                        "default": True
                    }
                ],
                "category": "Utility|Console",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "2301f433-3341-44f2-a679-1bf841bb7202",
                "name": "Set value",
                "version": "1.1",
                "description": "Set value in runtime",
                "code": "class NodeParameters:\n    Name: str = \"Param\"\n    NewValue = \"Any\"\n    Update: bool = True\n\ndef run(inputs, params):\n\n    data = libs.get_runtime_data()\n\n    if params.Name not in data or params.Update:\n        data[params.Name] = params.NewValue\n        libs.update_runtime_data(data)\n\n    return inputs",
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
                    },
                    {
                        "name": "Update",
                        "type": "boolean",
                        "label": "Update",
                        "default": True
                    }
                ],
                "category": "Data|Runtime",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "6d611cd6-7229-40c8-9742-d8b7e2657c3f",
                "name": "loop for n",
                "version": "1.3",
                "description": "Simple loop",
                "code": "class NodeParameters:    \n    n: int = 10\n    MAX_THEN: int = 2\n    #output description\n    CUSTOM_OUTPUT=True\n    DEFAULT_OUTPUT=True\n    THEN1_FINISH = 1\n    THEN2_DO = 2\n    #node description\n    NODE_TYPE=\"LOOP\"\n\ndef run(inputs, params):\n    for i in range(0,params.n):\n        data = {\n            \"index\": i\n        }\n        workflow.execute_node (params.THEN2_DO,data)\n    workflow.execute_node (params.THEN1_FINISH)\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "n",
                        "type": "number",
                        "label": "N",
                        "default": 10
                    },
                    {
                        "name": "MAX_THEN",
                        "type": "number",
                        "label": "Max Then",
                        "default": 2
                    },
                    {
                        "name": "CUSTOM_OUTPUT",
                        "type": "number",
                        "label": "Custom Output",
                        "default": True
                    },
                    {
                        "name": "DEFAULT_OUTPUT",
                        "type": "number",
                        "label": "Default Output",
                        "default": True
                    },
                    {
                        "name": "THEN1_FINISH",
                        "type": "number",
                        "label": "Then1 Finish",
                        "default": 1
                    },
                    {
                        "name": "THEN2_DO",
                        "type": "number",
                        "label": "Then2 Do",
                        "default": 2
                    },
                    {
                        "name": "NODE_TYPE",
                        "type": "string",
                        "label": "Node Type",
                        "default": "LOOP"
                    }
                ],
                "category": "Logic|Loop",
                "icon": "graph",
                "is_async": False
            },
            {
                "id": "70455703-60f4-481c-9316-e0b1d02917d4",
                "name": "OpenAI Chat Model",
                "version": "1.0",
                "description": "Configuration for OpenAI Chat Model.",
                "code": "class NodeParameters:\n    model: str = 'gpt-4o-mini'\n\ndef run(inputs, params):\n    return {'model': params.model, 'provider': 'openai'}",
                "input_schema": {},
                "output_schema": {
                    "model": "object"
                },
                "parameters": [
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gpt-4o-mini"
                    }
                ],
                "category": "AI|Models|OpenAI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "896d5010-c857-4f8c-9704-e56ac6aabfb2",
                "name": "Perplexity Chat Model",
                "version": "1.0",
                "description": "Configuration for Perplexity Chat Model.",
                "code": "class NodeParameters:\n    model: str = 'sonar'\n\ndef run(inputs, params):\n    return {'model': params.model, 'provider': 'perplexity'}",
                "input_schema": {},
                "output_schema": {
                    "model": "object"
                },
                "parameters": [
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "sonar"
                    }
                ],
                "category": "AI|Models|Perplexity",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "94d21098-f472-4344-bd8b-800edca853a3",
                "name": "Delay",
                "version": "1.1",
                "description": "time.sleep",
                "code": "class NodeParameters:\n    delay: float = 1.5\n  \ndef run(inputs, params):\n    time.sleep(params.delay)\n    return inputs",
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
                "category": "Utility|Time",
                "icon": "timer",
                "is_async": False
            },
            {
                "id": "96148ebf-9995-48eb-8f3e-7d0f0540b798",
                "name": "Gemini Chat Model",
                "version": "1.0",
                "description": "Configuration for Gemini Chat Model.",
                "code": "class NodeParameters:\n    model: str = 'gemini-1.5-flash'\n\ndef run(inputs, params):\n    return {'model': params.model, 'provider': 'gemini'}",
                "input_schema": {},
                "output_schema": {
                    "model": "object"
                },
                "parameters": [
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gemini-1.5-flash"
                    }
                ],
                "category": "AI|Models",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "a2f85281-0eb4-4f22-87b4-eb788697e944",
                "name": "Get active client",
                "version": "1.0",
                "description": "",
                "code": "def run(inputs, params):\n    return common.get_active_client()",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Utility",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "b09d0d31-8e6a-4667-9110-88d03f3dad0c",
                "name": "Print",
                "version": "1.0",
                "description": "Print input parameters",
                "code": "def run(inputs, params):\n    print(inputs)\n    return inputs;",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Utility|Console",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "cda2737b-2609-4d21-92a0-1f7a2f031633",
                "name": "If ... than ... else",
                "version": "1.7",
                "description": "Simple condition example = ",
                "code": "class NodeParameters:    \n    Argument: str = \"Param\"\n    Value = \"Any\"\n    MAX_THEN: int = 2\n    CUSTOM_OUTPUT=True\n    THEN1_THEN = 1\n    THEN2_ELSE = 2\n    THEN = 0\n    NODE_TYPE=\"COMPARE\"\n\ndef run(inputs, params):\n    if inputs[params.Argument] == params.Value:\n        params.THEN = params.THEN1_THEN;\n    else:\n        params.THEN = params.THEN2_ELSE;\n    return inputs",
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
                        "name": "MAX_THEN",
                        "type": "number",
                        "label": "Max Then",
                        "default": 2
                    },
                    {
                        "name": "CUSTOM_OUTPUT",
                        "type": "number",
                        "label": "Custom Output",
                        "default": True
                    },
                    {
                        "name": "THEN1_THEN",
                        "type": "number",
                        "label": "Then1 Then",
                        "default": 1
                    },
                    {
                        "name": "THEN2_ELSE",
                        "type": "number",
                        "label": "Then2 Else",
                        "default": 2
                    },
                    {
                        "name": "THEN",
                        "type": "number",
                        "label": "Then",
                        "default": 0
                    },
                    {
                        "name": "NODE_TYPE",
                        "type": "string",
                        "label": "Node Type",
                        "default": "COMPARE"
                    }
                ],
                "category": "Logic|Conditions",
                "icon": "graph",
                "is_async": False
            },
            {
                "id": "7194c010-4a63-4c35-9de4-b970f56271d3",
                "name": "sql query",
                "version": "1.2",
                "description": "Database query",
                "code": "class NodeParameters:\n    query: str = \"select users.username, users.role from users\"\n    runtime: bool = True\n\ndef run(inputs, params):\n    \n    pattern = params[\"query\"]\n    if params.runtime:\n        query = pattern.format(**libs.get_runtime_data())\n    else:\n        query = pattern.format(**inputs)\n    \n    result = inner_database.unsafe_request(query)\n    return result\n    ",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "query",
                        "type": "string",
                        "label": "Query",
                        "default": "select users.username, users.role from users"
                    },
                    {
                        "name": "runtime",
                        "type": "boolean",
                        "label": "Runtime",
                        "default": True
                    }
                ],
                "category": "Database",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "d5936531-2e19-444d-b88e-02c4474bb212",
                "name": "Gemini Chat Model",
                "version": "1.0",
                "description": "Configuration for Gemini Chat Model.",
                "code": "class NodeParameters:\n    model: str = 'gemini-1.5-flash'\n\ndef run(inputs, params):\n    return {'model': params.model, 'provider': 'gemini'}",
                "input_schema": {},
                "output_schema": {
                    "model": "object"
                },
                "parameters": [
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gemini-1.5-flash"
                    }
                ],
                "category": "AI|Models|Gemini",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "d6bcad12-0e8d-4114-8512-f589341698a0",
                "name": "Perform Web Search",
                "version": "1.0",
                "description": "Perplexity AI question with web search",
                "code": "class NodeParameters:\n    question: str = 'What was a positive news story from today?'\n    model: str = 'sonar'\n    \ndef run(inputs, params):\n    respons = perplexity.perform_web_search(params.question, params.model)\n    return respons",
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
                        "default": "What was a positive news story from today?"
                    },
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "sonar"
                    }
                ],
                "category": "AI|Chat|Perplexity",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "f1b356ff-85c1-469c-95c3-46d3a01827a5",
                "name": "Runtime Data Read",
                "version": "1.0",
                "description": "Returns the runtime data as a JSON object.",
                "code": "def run(inputs, params):\n    data = libs.get_runtime_data()\n    return data",
                "input_schema": {},
                "output_schema": {
                    "data": "object"
                },
                "parameters": [],
                "category": "Data|Runtime",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "f932ccd8-6862-4942-a59d-f4e30f50b503",
                "name": "loop array",
                "version": "1.3",
                "description": "Simple loop",
                "code": "class NodeParameters:    \n    array_name = \"array\"\n    MAX_THEN: int = 2\n    #output description\n    CUSTOM_OUTPUT = True\n    DEFAULT_OUTPUT = True\n    THEN1_FINISH = 1\n    THEN2_DO = 2\n    #node description\n    NODE_TYPE = \"LOOP\"\n\ndef run(inputs, params):\n    items = inputs.get(params.array_name, [])  # \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u043c \u043c\u0430\u0441\u0441\u0438\u0432\n\n    # \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u043c, \u0447\u0442\u043e \u044d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u0441\u043f\u0438\u0441\u043e\u043a\n    if not isinstance(items, list):\n        print(f\"Error: {params.array_name} isn't array\")\n        return inputs\n\n    for item in items:\n        workflow.execute_node(params.THEN2_DO, item)\n\n    workflow.execute_node(params.THEN1_FINISH)\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "array_name",
                        "type": "string",
                        "label": "Array Name",
                        "default": "array"
                    },
                    {
                        "name": "MAX_THEN",
                        "type": "number",
                        "label": "Max Then",
                        "default": 2
                    },
                    {
                        "name": "CUSTOM_OUTPUT",
                        "type": "number",
                        "label": "Custom Output",
                        "default": True
                    },
                    {
                        "name": "DEFAULT_OUTPUT",
                        "type": "number",
                        "label": "Default Output",
                        "default": True
                    },
                    {
                        "name": "THEN1_FINISH",
                        "type": "number",
                        "label": "Then1 Finish",
                        "default": 1
                    },
                    {
                        "name": "THEN2_DO",
                        "type": "number",
                        "label": "Then2 Do",
                        "default": 2
                    },
                    {
                        "name": "NODE_TYPE",
                        "type": "string",
                        "label": "Node Type",
                        "default": "LOOP"
                    }
                ],
                "category": "Logic|Loop",
                "icon": "graph",
                "is_async": False
            },
            {
                "id": "c290e2eb-8cb7-4c4c-a2d1-9f0f69b9e8e9",
                "name": "Runtime Data Write",
                "version": "1.0",
                "description": "Writes data to the runtime state of the execution.",
                "code": "class NodeParameters:\n    name_from: str = 'output'\n    name_as: str = 'users'\n    merge: bool = True\n\ndef run(inputs, params):\n    # 1. \u0411\u0435\u0440\u0435\u043c \u0434\u0430\u043d\u043d\u044b\u0435 \u0438\u0437 \u0432\u0445\u043e\u0434\u0430. \u0415\u0441\u043b\u0438 \u0432 name_from 'output', \n    # \u0442\u043e payload \u0431\u0443\u0434\u0435\u0442 \u0440\u0430\u0432\u0435\u043d \u0442\u043e\u043c\u0443 \u0441\u0430\u043c\u043e\u043c\u0443 \u0441\u043f\u0438\u0441\u043a\u0443 [...]\n    payload = inputs.get(params.name_from, {})\n    \n    if params.merge:\n        # 2. \u0411\u0435\u0440\u0435\u043c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 runtime (\u0442\u0430\u043c \u043b\u0435\u0436\u0438\u0442 {\"_session_id\": \"1\"})\n        current = libs.get_runtime_data() or {}\n        \n        # 3. \u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u043c \u0432 \u043d\u0435\u0433\u043e \u043a\u043b\u044e\u0447 'users' \u0441\u043e \u0441\u043f\u0438\u0441\u043a\u043e\u043c\n        current[params.name_as] = payload\n        \n        # 4. \u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c \u0412\u0415\u0421\u042c \u0441\u043b\u043e\u0432\u0430\u0440\u044c current. \n        # \u0422\u0435\u043f\u0435\u0440\u044c \u0432 \u0431\u0430\u0437\u0435 \u0431\u0443\u0434\u0435\u0442 {\"_session_id\": \"1\", \"users\": [...]}\n        libs.update_runtime_data(current)\n    else:\n        # \u0415\u0441\u043b\u0438 \u043d\u0435 \u043c\u0435\u0440\u0436\u0438\u043c, \u043f\u0440\u043e\u0441\u0442\u043e \u0441\u043e\u0437\u0434\u0430\u0435\u043c \u043d\u043e\u0432\u044b\u0439 \u043e\u0431\u044a\u0435\u043a\u0442\n        libs.update_runtime_data({params.name_as: payload})\n    \n    return libs.get_runtime_data()\n",
                "input_schema": {
                    "data": "object"
                },
                "output_schema": {
                    "success": "boolean"
                },
                "parameters": [
                    {
                        "name": "name_from",
                        "type": "string",
                        "label": "Name From",
                        "default": "output"
                    },
                    {
                        "name": "name_as",
                        "type": "string",
                        "label": "Name As",
                        "default": "users"
                    },
                    {
                        "name": "merge",
                        "type": "boolean",
                        "label": "Merge",
                        "default": True
                    }
                ],
                "category": "Data|Runtime",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "078b3951-b63c-4c4d-8c4c-a66a7bed127a",
                "name": "Simple question",
                "version": "1.2",
                "description": "Open AI Simple Question",
                "code": "class NodeParameters:\n    question: str = 'What is the meaning of life?'\n    model: str = 'gpt-4o-mini'\n    runtime: bool = False\n\ndef run(inputs, params):\n    \n    pattern = params[\"question\"]\n    if params.runtime:\n        question = pattern.format(**libs.get_runtime_data())\n    else:\n        question = pattern.format(**inputs)\n\n    \n    model = params.model\n    result = openai.ask_single(question, model)\n    return result",
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
                    },
                    {
                        "name": "model",
                        "type": "string",
                        "label": "Model",
                        "default": "gpt-4o-mini"
                    },
                    {
                        "name": "runtime",
                        "type": "boolean",
                        "label": "Runtime",
                        "default": False
                    }
                ],
                "category": "AI|Chat|OpenAI",
                "icon": "graph_2",
                "is_async": False
            },
            {
                "id": "c71008b9-9b88-4405-8780-53105361b7f8",
                "name": "Prepare AI Question",
                "version": "1.2",
                "description": "Get clients' tasks and save as questions ",
                "code": "def get_task (category, client_id):\n    query = f\"\"\"\n    SELECT \n    ai_tasks.task->>'values' AS task, \n    ai_tasks.id\n        FROM ai_tasks\n    JOIN data_types \n        ON ai_tasks.data_type_id = data_types.id\n    WHERE data_types.type = '{category}'\n      AND ai_tasks.owner_id = '{client_id}'\n    \"\"\"\n    result = inner_database.unsafe_request(query)\n    print (result)\n    return result\n\ndef clear_sequence (session_id, category):\n    query = f\"\"\"\n    DELETE FROM intermediate_results\n    WHERE session_id = '{session_id}' \n      AND sub_category = '{category}' \n      AND (category = 'AI_Question' OR category LIKE 'AI_Answer|%')\n    \"\"\"\n    inner_database.unsafe_request(query)\n                              \ndef save_task_as_question(data, category, client_id, session_id):\n    if not data:\n        return 0\n\n    values_list = []\n    question_count = 0\n\n    for item in data:\n        # item[\"task\"] \u0441\u0435\u0439\u0447\u0430\u0441 \u0441\u0442\u0440\u043e\u043a\u0430, \u043a\u043e\u0442\u043e\u0440\u0430\u044f \u0441\u0430\u043c\u0430 \u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f JSON-\u043c\u0430\u0441\u0441\u0438\u0432\u043e\u043c\n        tasks_array = json.loads(item[\"task\"])  # \u043f\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0435\u043c \u0441\u0442\u0440\u043e\u043a\u0443 JSON \u0432 \u0441\u043f\u0438\u0441\u043e\u043a\n        for question_text in tasks_array:\n            question_count += 1\n            # \u042d\u043a\u0440\u0430\u043d\u0438\u0440\u0443\u0435\u043c \u0430\u043f\u043e\u0441\u0442\u0440\u043e\u0444\u044b \u0434\u043b\u044f SQL\n            json_data = json.dumps({\"Question\": question_text}).replace(\"'\", \"''\")\n\n            values_list.append(\n                f\"(gen_random_uuid(), '{session_id}', '{item['id']}', '{client_id}', 'AI_Question', '{category}', '{json_data}', NOW(), NOW())\"\n            )\n\n    if not values_list:\n        return 0\n\n    query = f\"\"\"\n    INSERT INTO intermediate_results (\n        id,\n        session_id,\n        reference_id,\n        client_id,\n        category,\n        sub_category,\n        data,\n        created_at,\n        updated_at\n    )\n    VALUES\n        {',\\n'.join(values_list)};\n    \"\"\"\n\n    inner_database.unsafe_request(query)\n\n    return question_count\n        \ndef run(inputs, params):\n    \n    runtime = libs.get_runtime_data()\n    client_id = runtime[\"_active_client_id\"]\n    session_id = runtime[\"_session_id\"]\n    category = runtime[\"_category\"]\n    \n\n    #save update runtime\n    result = get_task (category, client_id);\n    clear_sequence (session_id, category)\n    question_count=save_task_as_question (result, category, client_id, session_id)\n\n    runtime['_questions'] = question_count;\n    libs.update_runtime_data(runtime)\n\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Database",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "9ce52039-0d0c-4a2b-92e1-023cb9508641",
                "name": "function checker",
                "version": "1.0",
                "description": "",
                "code": "def run(inputs, params):\n    # \u0417\u0430\u0434\u0430\u0435\u043c \u0432\u043e\u043f\u0440\u043e\u0441 \u0430\u0433\u0435\u043d\u0442\u0443\n    client_id = common.get_active_client()\n    agent_hint = agent.get_agent_hint_by_key (\"md-metadata-formatting\")\n    agent_task = \"\u041a\u0430\u043a\u0430\u044f \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u0446\u0435\u043d\u0430 \u0430\u043a\u0446\u0438\u0439 Google (Alphabet Class C)? \u0438 \u0441\u0441\u044b\u043b\u043a\u0438 \u043d\u0430 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438, \u043d\u0443\u0436\u0435\u043d \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0441 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0438\u0435\u043c\"#f\"client_id = {client_id[\"id\"]}\"\n    \n    provider = \"gemini-pro-latest\"\n    result = agent.run(\n        model=provider,       # \u041c\u043e\u0434\u0435\u043b\u044c (openai, gemini, perplexity)\n        tools=[\"google_search\",\"get_all_client_metadata\", \"get_schema_by_key\"], # \u0421\u043f\u0438\u0441\u043e\u043a \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u043e\u0432\n        hint=agent_hint,\n        task=agent_task,\n        schema_key = \"common-response-links\",\n        iteration_limit=5\n    )\n    \n    \n    return result",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "temp",
                "icon": "task",
                "is_async": False
            },
            {
                "id": "66171aa4-8781-4e88-bf92-ec2be6d01ba2",
                "name": "Create or get session ID",
                "version": "1.2",
                "description": "Create or get session ID by client",
                "code": "def run(inputs, params):\n\n    # \u041f\u043e\u043b\u0443\u0447\u0430\u0435\u043c client_id\n    runtime = libs.get_runtime_data()\n    client_id = runtime[\"_active_client_id\"]\n    sub_category = runtime[\"_category\"]\n    session_expires_in_days = runtime[\"_session_expires_in_days\"]\n\n    # 1. \u0418\u0449\u0435\u043c \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u044e\u044e \u0441\u0435\u0441\u0441\u0438\u044e \u0437\u0430 N \u0434\u043d\u0435\u0439\n    select_query = f\"\"\"\n    SELECT session_id\n    FROM intermediate_results\n    WHERE client_id = '{client_id}'\n      AND created_at >= NOW() - INTERVAL '{session_expires_in_days} days'\n      AND category = 'Session'\n      AND sub_category = '{sub_category}'\n    ORDER BY created_at DESC\n    LIMIT 1;\n    \"\"\"\n\n    result = inner_database.unsafe_request(select_query)\n\n    # \u0415\u0441\u043b\u0438 \u043d\u0430\u0448\u043b\u0438 \u2014 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u043c session_id\n    if result and len(result) > 0:\n        session_id = result[0][\"session_id\"]\n        runtime[\"_session_id\"] = str(session_id)\n        libs.update_runtime_data(runtime)\n        \n        return session_id\n\n\n    # 2. \u0415\u0441\u043b\u0438 \u043d\u0435 \u043d\u0430\u0448\u043b\u0438 \u2014 \u0441\u043e\u0437\u0434\u0430\u0451\u043c \u043d\u043e\u0432\u0443\u044e\n    insert_query = f\"\"\"\n    INSERT INTO intermediate_results (\n        id,\n        session_id,\n        reference_id,\n        client_id,\n        created_by,\n        updated_by,\n        created_at,\n        updated_at,\n        category,\n        sub_category,\n        data,\n        short_description\n    )\n    VALUES (\n        gen_random_uuid(),\n        gen_random_uuid(),\n        NULL,\n        '{client_id}',\n        NULL,\n        NULL,\n        NOW(),\n        NOW(),\n        'Session',\n        '{sub_category}',\n        NULL,\n        NULL\n    )\n    RETURNING session_id;\n    \"\"\"\n\n    insert_result = inner_database.unsafe_request(insert_query)\n    print('add')\n    # \u0412\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u043c \u043d\u043e\u0432\u0443\u044e session_id\n    session_id = insert_result[0][\"session_id\"]\n    runtime['_session_id'] = str(session_id)\n    libs.update_runtime_data(runtime)\n    return session_id",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Database",
                "icon": "text",
                "is_async": False
            },
            {
                "id": "bf9e371f-a0bb-494d-91ba-e9419e1032f6",
                "name": "Getting analysis with AI",
                "version": "1.0",
                "description": "Get questions of clients' and answer",
                "code": "class NodeParameters:\n    analytic_type: str = \"Mention\"\n    AI_Task: str  # @table-AI_Tasks->id,AI_Tasks->description\n\n\ndef get_answer_for_analys(session_id, category):\n\n    query = f\"\"\"\n    SELECT id, reference_id, data\n    FROM intermediate_results\n    WHERE session_id = '{session_id}'\n    AND sub_category = '{category}'\n    AND category like 'AI_Answer|%'\n    ORDER BY created_at\n    \"\"\"\n\n    return inner_database.unsafe_request(query)\n\n\ndef save_analyis(answer_id, result, session_id, category, client_id, Analytic_type, AI_Task):\n\n    json_data = str(result).replace(\"'\", \"''\")\n\n    query = f\"\"\"\n    INSERT INTO intermediate_results (\n        id,\n        session_id,\n        reference_id,\n        client_id,\n        category,\n        sub_category,\n        data,\n        created_at,\n        updated_at\n    )\n    VALUES (\n        gen_random_uuid(),\n        '{session_id}',\n        '{answer_id}',\n        '{client_id}',\n        'Analysis|{AI_Task}',\n        '{category}',\n        '{json_data}',\n        NOW(),\n        NOW()\n    );\n    \"\"\"\n\n    inner_database.unsafe_request(query)\n\n\ndef process_answer(session_id, category, client_id, answers, AI_TaskID, Analytic_type):\n\n    query = f\"\"\"\n        SELECT ai_tasks.ai_model, ai_tasks.task\n        FROM ai_tasks\n        WHERE ai_tasks.id = '{AI_TaskID}'\n    \"\"\"\n\n    task_data = inner_database.unsafe_request(query)\n\n    task_text = task_data[0]['task']['value']\n    ai_task_prompt = analytics.process_analytics_request(client_id, task_text)\n\n    model = task_data[0]['ai_model']\n    AI_type = common.GetAIByModel(model)\n\n    count_of_anlysis = 0\n\n    for answer in answers:\n\n        count_of_anlysis += 1\n\n        answer_text = answer['data']['Answer']\n        question_text = ai_task_prompt + answer_text\n\n        if AI_type == \"OpenAI\":\n            ai_result = openai.perform_web_search(question_text, model)\n\n        elif AI_type == \"Gemini\":\n            ai_result = gemini.perform_web_search(question_text, model)\n\n        elif AI_type == \"Perplexity\":\n            ai_result = perplexity.perform_web_search(question_text, model)\n\n        else:\n            ai_result = \"Unknown AI\"\n\n        print(f'Answer {AI_type} {count_of_anlysis}: {ai_result}')\n\n        save_analyis(\n            answer[\"id\"],\n            ai_result,\n            session_id,\n            category,\n            client_id,\n            AI_TaskID,\n            Analytic_type\n        )\n\n    return count_of_anlysis\n\n\ndef run(inputs, params):\n\n    runtime = libs.get_runtime_data()\n\n    client_id = runtime[\"_active_client_id\"]\n    session_id = runtime[\"_session_id\"]\n    Category = runtime[\"_category\"]\n\n    Analytic_type = params.analytic_type\n    AI_TaskID = params.AI_Task\n\n    answers = get_answer_for_analys(session_id, Category)\n\n    print('---------------- AI Analysis ----------------')\n\n    processed_answers = process_answer(\n        session_id,\n        Category,\n        client_id,\n        answers,\n        AI_TaskID,\n        Analytic_type\n    )\n\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [
                    {
                        "name": "analytic_type",
                        "type": "string",
                        "label": "Analytic Type",
                        "default": "Mention",
                        "options_source": None
                    },
                    {
                        "name": "AI_Task",
                        "type": "string",
                        "label": "Ai Task",
                        "default": None,
                        "options_source": {
                            "table": "AI_Tasks",
                            "value_field": "id",
                            "label_field": "description",
                            "component": "ComboBox",
                            "filters": {
                                "owner_id": "AI_Task"
                            }
                        }
                    }
                ],
                "category": "AI|Analysis",
                "icon": "graph-2",
                "is_async": False
            },
            {
                "id": "94a06316-3627-4ab2-b95e-36a26fc8839a",
                "name": "Getting answers from AI",
                "version": "1.0",
                "description": "Get questions of clients' and answer",
                "code": "def get_questions(session_id, category):\n    query = f\"\"\"\n    SELECT id, reference_id, data\n    FROM intermediate_results\n    WHERE session_id = '{session_id}'\n    AND sub_category = '{category}'\n    AND category = 'AI_Question'\n    ORDER BY created_at\n    \"\"\"\n\n    return inner_database.unsafe_request(query)\n\ndef save_answer(question_id, answer, session_id, category, client_id, AnswerAI):\n\n    json_data = json.dumps({\"Answer\": answer}).replace(\"'\", \"''\")\n\n    query = f\"\"\"\n    INSERT INTO intermediate_results (\n        id,\n        session_id,\n        reference_id,\n        client_id,\n        category,\n        sub_category,\n        data,\n        created_at,\n        updated_at\n    )\n    VALUES (\n        gen_random_uuid(),\n        '{session_id}',\n        '{question_id}',\n        '{client_id}',\n        'AI_Answer|{AnswerAI}',\n        '{category}',\n        '{json_data}',\n        NOW(),\n        NOW()\n    );\n    \"\"\"\n\n    inner_database.unsafe_request(query)    \n\ndef process_questions(session_id, category, client_id, AnswerAI, Model, Additional_query):\n    questions = get_questions(session_id, category)\n    count_of_answer = 0\n    for question in questions:\n        count_of_answer=count_of_answer+1\n        \n        question_text = question[\"data\"].get(\"Question\")  \n        print (f'Ask {AnswerAI} {count_of_answer}: {question_text}')\n        \n        if AnswerAI == \"OpenAI\":\n            answer = openai.perform_web_search(question_text, Model)\n        elif AnswerAI == \"Gemini\":\n            answer = gemini.perform_web_search(question_text, Model)\n        elif AnswerAI == \"Perplexity\":\n            answer = perplexity.perform_web_search(question_text + Additional_query, Model)\n        else:\n            answer = \"Unknown AI\"\n        \n        print (f'Answer {AnswerAI} {count_of_answer}: {answer}')\n        save_answer(\n            question[\"id\"],\n            answer,\n            session_id,\n            category,\n            client_id,\n            AnswerAI\n        )   \n    return count_of_answer\n        \ndef run(inputs, params):\n    \n    runtime = libs.get_runtime_data()\n    client_id = runtime[\"_active_client_id\"]\n    session_id = runtime[\"_session_id\"]\n    Model = runtime[\"_AIModel\"]\n    AnswerAI = common.GetAIByModel(Model)\n    Category = runtime[\"_category\"]\n    Additional_query = runtime[\"_additional_query\"]\n    \n    qustions = get_questions (session_id, Category)\n    \n    print ('---------------- AI Answer ----------------')\n    \n    answers = process_questions(\n        session_id,\n        Category,\n        client_id, \n        AnswerAI, \n        Model,\n        Additional_query)\n    \n    runtime[f'_answers_{AnswerAI}'] = answers\n\n    libs.update_runtime_data(runtime)\n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "AI",
                "icon": "graph-2",
                "is_async": False
            },
            {
                "id": "21a0c4b5-f180-4072-aefc-a71be1193d3a",
                "name": "Clear answers of model",
                "version": "1.0",
                "description": "Clear answer of model",
                "code": "def clear_answers_of_model (session_id, category, ClearAI):\n    query = f\"\"\"\n    DELETE FROM intermediate_results\n    WHERE session_id = '{session_id}' \n      AND sub_category = '{category}' \n      AND (category = 'AI_Answer|{ClearAI}')\n    \"\"\"\n    inner_database.unsafe_request(query)\n                              \n        \ndef run(inputs, params):\n    \n    runtime = libs.get_runtime_data()\n    client_id = runtime[\"_active_client_id\"]\n    session_id = runtime[\"_session_id\"]\n    Model = runtime[\"_AIModel\"]\n    ClearAI = common.GetAIByModel(Model)\n    category = runtime[\"_category\"]\n\n    clear_answers_of_model (session_id, category, ClearAI)\n    \n    return inputs",
                "input_schema": {},
                "output_schema": {},
                "parameters": [],
                "category": "Database",
                "icon": "text",
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
