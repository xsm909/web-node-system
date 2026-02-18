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
```bash
docker compose logs -f backend
```
