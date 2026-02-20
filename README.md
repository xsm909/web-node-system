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

### 5. Database Connection (Beekeeper Studio / pgAdmin)
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
