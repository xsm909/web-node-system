# Technical Specification  
Web Platform with Workflow Engine (Node-Graph Based)

## 1. Project Goal

Develop a fully self-contained web platform (backend + frontend) that enables managers to create, configure, and execute business processes as directed node graphs (workflows) for assigned end-users.

Key characteristics:
- Fully offline-capable after initial setup (no internet required during operation)
- Strict role-based access control (RBAC)
- Workflows and execution results stored in a relational database
- Dockerized deployment for easy local and production setup
- Local testing support with immediate workflow execution

## 2. User Roles

| Role              | Access Paths                  | Main Permissions                                                                                      |
|-------------------|-------------------------------|-------------------------------------------------------------------------------------------------------|
| **Administrator** | /admin                        | - Define and manage global node library<br>- Assign users to managers<br>- Full user & role management<br>- View all data |
| **Manager**       | /manager                      | - View only users assigned by admin<br>- Create/edit/save workflows for assigned users<br>- Execute workflows ("Play")<br>- View execution status & results for own users |
| **End-user (Client)** | /client                   | - View results of workflows assigned to them<br>- Read-only access (no editing)                      |

## 3. Architecture & Technology Stack

- **Backend**: Python 3.10+ (recommended: FastAPI) + REST API (GraphQL optional)  
- **Frontend**: SPA — React (recommended), Vue or Angular acceptable  
- **Database**: MySQL 8+ (PostgreSQL allowed as alternative)  
- **Workflow storage**: Relational tables + JSON for graph structure  
- **Containerization**: Docker + docker-compose (single `docker compose up` to start everything)  
- **Offline requirement**: All components run locally; Python node execution happens server-side without external calls  
- **Frontend routes** (post-authentication):  
  - `/admin`   — admin dashboard  
  - `/manager` — manager workspace  
  - `/client`  — end-user results portal  
- **Code style**: All comments, variable names, documentation — English only  
- **Architecture**: Feature-Sliced Design (FSD) recommended for frontend  
- **Development OS**: Tested on macOS (use Cmd instead of Ctrl for shortcuts)

## 4. Functional Requirements

### 4.1 Backend

- Authentication: JWT or secure sessions + role-based authorization  
- CRUD APIs for:  
  - Users  
  - Manager ↔ User assignments  
  - Node templates (building blocks)  
  - Workflows (linked to users)  
- Workflow execution engine:  
  - Trigger execution (sync or async/fire-and-forget)  
  - Real-time node status updates (pending → running → success/failed)  
  - Store intermediate/final results and logs  
- Node execution:  
  - Execute arbitrary Python code in sandbox  
  - Recommended: RestrictedPython + timeouts/resource limits  
  - Allow only safe built-ins and pre-approved libraries  
  - Support sync and async nodes  
- Access restrictions (enforced on every request):  
  - Manager → only assigned users  
  - End-user → only own results  
  - Admin → unrestricted

### 4.2 Frontend

**Administrator (/admin)**  
- CRUD for global node types (code, inputs/outputs, parameters)  
- Assign users to managers (UI for linking)  
- User/role management

**Manager (/manager)**  
- List of assigned end-users  
- Drag-and-drop node-graph editor:  
  - Add/remove nodes  
  - Connect ports (inputs → outputs)  
  - Configure node parameters  
  - Validate graph (no cycles, required connections, etc.)  
- Save workflow to database  
- “Play” button — trigger execution (test or production)  
- Live view: node statuses, logs, final results

**End-user (/client)**  
- List of executed workflows assigned to current user  
- View results (data, files, text output, status history)  
- Clean, read-only UI

### 4.3 Workflow & Node Model

**Node**

- Unique name + version (for future updates/compatibility)  
- Typed inputs and outputs (supported: primitives, arrays, objects, JSON, file paths/URLs, binary data)  
- Core content: **Python code** (stored as string or reference to file)  
- Execution mode: **sync** or **async**  
- Configurable parameters (UI form fields: text, number, boolean, select, multi-select, file upload, etc.)  
- **Execution environment**:

  - Runs in a separate process / isolated subprocess / dedicated container (recommended: separate container per execution for maximum isolation)  
  - **Full internet access** — allowed and intended:
    - HTTP/HTTPS requests (requests, httpx, aiohttp, urllib)
    - API calls to any external services (OpenAI, Telegram, Google, CRM, weather, etc.)
    - Downloading/uploading files from/to the web
    - Web scraping (beautifulsoup, scrapy, playwright/selenium — if installed)
  - **Full access to Python libraries** installed in the runtime environment:
    - All standard library modules
    - All packages pre-installed in the backend Docker image
    - Any additional packages the administrator/developer adds via:
      - requirements.txt
      - Dockerfile (pip install ...)
      - Custom layers or volume mounts
    - No restrictions on imports by default (blacklist/whitelist can be added later as optional security feature)
  - File system access:
    - Read/write allowed inside the container (temporary directory per execution recommended)
    - Useful for caching, intermediate files, large datasets, generated reports, etc.
  - Execution limits (configurable globally or per node):
    - Timeout (default: 300 seconds, adjustable)
    - Memory limit
    - CPU limit (optional)
  - Logging:
    - stdout + stderr captured
    - Stored per node execution
    - Visible in manager UI (real-time + final)

**Recommended / optional security controls** (can be implemented as phase 2 features):

- Node trust levels:
  - “trusted” — full access (internet + all libs + fs) — only for admin / selected managers
  - “restricted” — no internet, limited imports, no fs write
- Global module whitelist/blacklist (configurable by admin)
- Per-execution ephemeral container (throw-away after run)
- Resource quotas enforced via cgroups / docker run flags

**Typical use-cases enabled by this design**:

- Calling external APIs (payment gateways, AI models, social networks, stock data…)
- Web scraping and data extraction
- Data processing with heavy libraries (pandas, numpy, polars, scikit-learn…)
- Machine learning inference (torch, transformers, if installed)
- Generating & sending documents (PDF, Excel, Word…)
- Email / messenger notifications
- File download → process → upload pipelines
- Integration with almost any web service

This approach makes nodes extremely powerful and flexible, turning the platform into a general-purpose low-code automation / integration tool — while shifting security responsibility to the platform administrator and trusted managers.

## 5. Security Requirements

- Strict RBAC enforcement  
- Sandboxed Python execution:  
  - No file system/network access unless explicitly allowed  
  - CPU/memory/time limits per node  
  - Restricted imports (whitelist approach)  
- Data isolation: users see only own results  
- Secure auth even in local mode (HTTPS recommended for dev)

## 6. Local Development & Testing

- One-command startup: `docker compose up`  
- All services (db, api, frontend) containerized  
- Manager can test workflows instantly via “Play” button  
- macOS keyboard compatibility (Cmd+A, Cmd+C, etc.)

## 7. Non-functional Requirements

- Complete offline operation (after docker pull / initial setup)  
- Modular backend: easy to add new node types  
- Intuitive graph editor (smooth UX, undo/redo recommended)  
- Acceptable performance: graphs up to 50 nodes  
- All UI text, tooltips, errors — English language  
- Logging: structured logs for debugging and audit

Prepared: ready for implementation  
Language: English only (UI, code, docs)