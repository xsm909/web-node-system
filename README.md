# Workflow Engine System

A modern web platform for managing and executing business processes as node graphs. Built with FastAPI, React (React Flow), and PostgreSQL.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started

Follow these steps to get the project running on a new machine or server:

### 1. Clone the repository
```bash
git clone <repository-url>
cd web-node-system
```

### 2. Build and Start the Containers
This command will build the frontend and backend images and start the services (including PostgreSQL).
```bash
docker compose up -d --build
```

### 3. Seed the Database
After the containers are up, run the seed script to create default users and mandatory node types (like the 'Start' node).
```bash
docker compose exec backend python -m app.seed
```

### 4. Access the Application
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

### 5. Update Seed File (Optional)
If you have added or modified nodes in the Database (via Admin Panel) and want to save them to the `seed.py` file to keep them in the source code:
```bash
docker compose exec backend python -m app.sync_seed
```
This script will pull the current node types from the database and overwrite the `nodes_data` in `app/seed.py`.

### 6. Database Connection (Beekeeper Studio / pgAdmin)
Use these settings to connect to the database from your host machine:
- **Type**: `PostgreSQL`
- **Host**: `localhost`
- **Port**: `5432`
- **User**: `user`
- **Password**: `password`
- **Database**: `workflow_db`

---

## Default User Credentials

After running the seed script, you can log in with the following accounts:

| Role | Username | Password |
| :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` |
| **Manager** | `manager1` | `manager123` |
| **Client** | `client1` | `client123` |

> [!NOTE]
> The seed script automatically assigns `client1` to `manager1`.

---

## Project Structure

- `/backend`: Python FastAPI application.
- `/frontend`: React application using Vite and React Flow.
- `docker-compose.yml`: Local development and production deployment configuration.

## Development Commands

### Rebuilding a specific service
```bash
docker compose build backend
docker compose restart backend
```

### Viewing logs

---

## Node Development

When creating nodes in the **Admin -> Node Library**, you can define configurable parameters using a `NodeParameters` class.

### Example Node with Parameters

```python
class NodeParameters:
    # Defining fields here allows the frontend to auto-generate input fields
    text: str = "Default value"
    count: int = 1

def run(inputs, params):
    # Use 'nodeParameters' (lowercase) to access values set in the UI
    print(f"Text parameter: {nodeParameters.text}")
    print(f"Count parameter: {nodeParameters.count}")
    
    return {"status": "ok"}
```

- **Class `NodeParameters`**: Scanned by the frontend to build the properties panel.
- **Object `nodeParameters`**: Automatically instantiated and injected into the execution environment.
- **Types**: `str` (text input), `int`/`float` (number input), `bool` (checkbox).

---

## Extending Internal Libraries

You can expose trusted Python functions to the node sandbox through the `internal_libs` system.

### 1. Add Library Code
Create a new file or add a function in `backend/app/internal_libs/`.

```python
# backend/app/internal_libs/my_lib.py
def my_custom_function(data: str):
    return f"Processed: {data}"
```

### 2. Register in Executor
Edit `backend/app/services/executor.py` to import and register the function in `SAFE_GLOBALS['libs']`.

```python
# backend/app/services/executor.py
from ..internal_libs.my_lib import my_custom_function

SAFE_GLOBALS = {
    ...
    "libs": SimpleNamespace(
        ask_ai=ask_ai,
        my_func=my_custom_function, # Exposed as libs.my_func()
    ),
}
```

### 3. Update Dependencies (Optional)
If your library uses external packages, add them to `backend/requirements.txt` and rebuild the backend:
```bash
docker compose build backend
docker compose restart backend
```

### 4. Use in Node
```python
def run(inputs, params):
    result = libs.my_func("hello")
    return {"output": result}
```

---
 
 ## Python Code Completion (Autofill)
 
 The system provides dynamic code completion in the Python editors (Node Library and Reports). To keep the suggestions in sync with your `executor.py` and `internal_libs`, use the sync script.
 
 ### How it works
 The script parses `backend/app/services/executor.py` to extract:
 - All namespaces in `SAFE_GLOBALS` (e.g., `libs`, `openai`, `gemini`, `prompts`).
 - All allowed modules in `ALLOWED_MODULES`.
 - Core built-ins and boilerplate snippets.
 
 ### Syncing Hints
 Whenever you expose new functions or libraries to the node sandbox, run the following command to update the frontend hints:
 ```bash
 docker compose exec backend python -m app.scripts.sync_autofill_python
 ```
 This will regenerate `backend/app/resources/python_hints.json`, which is then served to the frontend.
 
 ---
 
 ## Advanced Node Settings (Branching & Custom Outputs)

You can create complex nodes with multiple output handles (branches) by using special markers and logic in the `NodeParameters` class.

### Special Parameters

- `CUSTOM_OUTPUT: bool`: **The Master Switch**. If set to `True`, the node enables branching mode. If `False` or missing, the node always has exactly one standard output handle.
- `DEFAULT_OUTPUT: bool`: If `True` (and `CUSTOM_OUTPUT` is `True`), the node will display the standard "anonymous" output handle in addition to any branches.
- `MAX_THEN: int`: Defines how many custom branch handles to render on the node.
- `THEN: int`: **Automatic Branch Selector**. If set to a value `X`, the executor will automatically follow the branch handle `then_X` after the `run()` function completes.
- `THEN[X]_[NAME]`: Defines the label for branch `X`. For example, `THEN1_FINISH = 1` will label the first branch as "FINISH".

### Branching Example (LOOP)

This example demonstrates a loop that executes a "DO" branch for each iteration and then triggers a "FINISH" branch.

```python
class NodeParameters:    
    n: int = 10
    MAX_THEN: int = 2
    
    # Enable custom branching and the default output handle
    CUSTOM_OUTPUT = True
    DEFAULT_OUTPUT = True
    
    # Custom Labels for branches 1 and 2
    THEN1_FINISH = 1
    THEN2_DO = 2
    
    NODE_TYPE = "LOOP"

def run(inputs, params):
    # workflow.execute_node(index, data) triggers a branch manually
    for i in range(0, nodeParameters.n):
        data = {"index": i}
        workflow.execute_node(nodeParameters.THEN2_DO, data)
    
    # After the loop, trigger the finish branch
    workflow.execute_node(nodeParameters.THEN1_FINISH)
    
    return inputs
```

### Automatic Branching Example (Condition)

If you don't use `workflow.execute_node()`, you can simply set the `THEN` parameter to the desired branch index to have the workflow continue automatically.

```python
class NodeParameters:    
    CUSTOM_OUTPUT = True
    MAX_THEN = 2
    THEN1_TRUE = 1
    THEN2_FALSE = 2
    THEN = 0 # Initial value

def run(inputs, params):
    if inputs.get("score", 0) > 50:
        nodeParameters.THEN = nodeParameters.THEN1_TRUE
    else:
        nodeParameters.THEN = nodeParameters.THEN2_FALSE
    return inputs
```
