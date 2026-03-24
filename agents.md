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
### 3.1 ID
Never using regular id in table of data base using UID (UUID)

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

**Node Properties**

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

### 4.4 Reporting System

- **Administrator (/admin)**
  - Full CRUD access to create and manage reports and report styles (CSS).
  - Define custom SQL queries with parameterized inputs.
  - Define Jinja2 templates to heavily customize the HTML output.
  - Configure dynamic data sources for parameters (e.g., fetching dropdown options directly from database tables using `@table-name->value,label` syntax).
- **Manager (/manager)**
  - Read-only access to available reports (Global or assigned).
  - Can select parameters and generate reports.
  - Strictly restricted from viewing or editing underlying SQL queries, templates, or styles.
- **Reporting Engine**
  - Server-side execution of SQL queries mapping to Jinja2 context variables.
  - Pre-compilation of user parameters and custom CSS injections.
  - Audit logging of generated reports (`ReportRun`).

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


## 8 style of website
design like  - https://protocol.tailwindui.com/pagination

### 8.1 using tailwindcss

## 9 icons

### 9.1 using icons from https://fonts.google.com/icons and download them as svg to assets/icons folder

### 9.2 icons rule
separate name in fillename using underscore and use lowercase

### 9.3 icons for database records (objects)
Credentials - verified.svg
Report - article.svg
Workflow - automation.png
Schema - schema.svg
Agent hints - lightbulb_circle.svg
Node type - function.svg
metadata - metadata.svg
projects - project.svg

#### 9.3.1 UI icons rules
parameters - parameters.svg
for system marker - system.svg
export/download - download.svg
play/run/generate - play.svg
save - save.svg
add elements - add_circle.svg
collapse all  - collapse_all.svg
expand all - expand_all.svg

## 10. Types of Nodes

The system supports 4 static node types and 1 dynamic behavior based on graph context:

1. **Start Node**: The mandatory entry point of the workflow.
   - *Inputs*: None
   - *Outputs*: 1 (Bottom)
2. **Regular Node**: Standard execution step.
   - *Inputs*: 1 (Top)
   - *Outputs*: 1 (Bottom)
3. **Conditional Node**: Branching logic node.
   - *Inputs*: 1 (Top)
   - *Outputs*: 2 or more (Bottom)
4. **Special Node**: Agent/Complex node that accepts dependencies.
   - *Inputs*: 1 (Top) + N named inputs (Right edge) defined via `InputParameters`.
   - *Outputs*: 1 (Bottom)
5. **Dynamic Provider Node (Right-Connected)**: When a Regular node is connected to the right-side input of a Special node, it dynamically adapts its UI:
   - *Inputs*: Hidden (it acts purely as a data provider).
   - *Outputs*: Moved to the Left edge to naturally wire into the Special node's right edge.
## 11. UI Standards for Tables and Forms

- **Library Usage**: Use TanStack libraries (e.g., `@tanstack/react-table`) for all data tables and forms to ensure consistency and performance.
- **Unified Header System (`AppHeader`)**:
    - Every management page must integrate the `AppHeader` component at the top.
    - **Sidebar Integration**: Must pass `onToggleSidebar` and `isSidebarOpen` to ensure consistent navigation behavior across desktop and mobile.
    - **Centralized Search**: Search functionality must be managed via `AppHeader`'s `searchQuery` and `onSearchChange` props. Filtering logic should reside in the parent widget.
    - **Primary Actions**: Action buttons (e.g., "Add User", "New Hint") must be placed in the `rightContent` slot of the `AppHeader`.
- **Standardized Tables (`AppTable`)**:
    - All data lists must use the `AppTable` component to maintain visual and functional parity.
    - **Full-Height Layout**: Tables and their containers must be configured to occupy the full available screen height (`h-full` or `flex-1` within a flex container) to prevent layout jumping and ensure independent scrolling.
    - **Category Grouping**: Tables with categorizable data must implement collapsible grouping using the `categoryExtractor` pattern.
    - **Interactive Rows**: Use the `onRowClick` pattern for primary interactions like opening edit modals or detail views.
- **Reference**: Use **Schema Registry** (`AdminSchemaManagement`) and **User Management** (`AdminUserManagement`) as the visual and functional reference for table layouts, header integration, and full-height implementation.

### 11.1 Centralized UI Constants (`UI_CONSTANTS`)

To maintain visual cohesion, all form controls, buttons, and layouts must reference the centralized `UI_CONSTANTS` defined in `shared/ui/constants.ts`.

- **Standard Height**: Use `UI_CONSTANTS.FORM_CONTROL_HEIGHT` (default: `h-[32px]`) for all inputs, selects, and action buttons.
- **Internal Padding**: Use `UI_CONSTANTS.FORM_CONTROL_PX` and `UI_CONSTANTS.FORM_CONTROL_PY` for consistent internal spacing.
- **Calculations**: Use `UI_CONSTANTS.FORM_CONTROL_HEIGHT_PX` for absolute positioning or minimum width calculations (e.g., ensuring an action button is square).

Avoid hardcoded pixel values for control heights in new components.

## 12. Standardized Form Layouts (AppFormView)

- **Navigation Stack Principle**: All entity editing forms accessed from the administrator sidebar must act as a distinct layer in a "navigation stack", replacing the list view rather than rendering as a floating card or popup.
- **Unified Header**: The form must use `AppHeader`. The `leftContent` should display a "Back" button indicating the path, e.g., `<List Name> / <Item Name>`. The header may contain supplementary actions in the `rightContent` if necessary for the form context.
- **Flat Layout**: The form body should be full-height and span the content area without breaking into disparate visual cards.
- **Tabbed Interface**: Where applicable, forms with multiple sections must use a standardized tab interface matching the platform aesthetic.
- **Dirty State Tracking**: Forms must track unsaved changes (`isDirty`). If a user attempts to navigate back while the form is dirty, a 3-way confirmation modal must appear allowing the user to "Save Changes", "Discard", or "Stay and Edit".
- **Sticky Footer Action Bar**: Include a sticky bottom footer bar containing consistent "Cancel" and primary "Save Changes" execution buttons.
- **Shared Implementation**: Forms must implement this standard by referencing the shared `AppFormView` component.

### 12.1 Layout Width Standards

To maintain visual rhythm and usability, follow these width rules within `AppFormView`:
- **Full Width (100%)**: Used for any tab or section containing a **code editor** (CodeMirror), **rich text/markdown editor**, or **graph/preview** area. These elements require maximum horizontal space for productivity. **All preview modes must always use 100% width.**
- **Narrow Width (`max-w-5xl`)**: Used for standard **property forms**, configuration rows, or simple attribute lists. This prevents input fields from stretching excessively on large screens, improving readability.

## 13. External Model Usage Policy (Gemini & OpenAI)

When developing agents in this project, external model usage must
strictly follow the patterns described below. The purpose of this
section is to standardize how agents access LLM capabilities and
web-grounded information.

Only the functionality demonstrated in the reference examples is
allowed.

### 13.1 Allowed Providers

Agents may interact only with:

-   Google Gemini via `google.genai`
-   OpenAI models via the `openai` client

No other SDKs, wrappers, or unofficial libraries should be used.

------------------------------------------------------------------------

## 13.2 Google Gemini Usage

Gemini must be used through the official `google.genai` client.

Example reference pattern:

``` python
from google import genai
from google.genai import types

client = genai.Client()

grounding_tool = types.Tool(
    google_search=types.GoogleSearch()
)

config = types.GenerateContentConfig(
    tools=[grounding_tool]
)

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Who won the euro 2024?",
    config=config,
)

print(response.text)
```

### 13.2.1 Mandatory Grounding

When agents require external knowledge or up‑to‑date information,
**Google Search Grounding must be used**.

This is critical for:

-   factual questions
-   current events
-   statistics
-   verification of claims
-   information that may change over time

Grounding is enabled through:

``` python
types.Tool(google_search=types.GoogleSearch())
```

This tool must be included inside `GenerateContentConfig`.

### 13.2.2 When Grounding Must Be Used

Agents should enable Google Search grounding whenever:

-   the task requires real-world knowledge
-   the answer depends on recent events
-   the user asks factual questions
-   the model must reduce hallucinations

Grounding allows Gemini to connect its response to live search results
and produce more reliable outputs.

------------------------------------------------------------------------

## 13.3 OpenAI Usage

OpenAI must be used via the official `OpenAI` client.

Reference pattern:

``` python
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    tools=[{"type": "web_search"}],
    input="What was a positive news story from today?"
)

print(response.output_text)
```

### 13.3.1 Web Search Tool

When using OpenAI models, agents may use the built-in web search
capability through:

    tools=[{"type": "web_search"}]

This enables the model to retrieve current information when required.

### 13.3.2 Model Usage

Agents should call models only through:

    client.responses.create()

The response text must be read from:

    response.output_text

------------------------------------------------------------------------

## 13.4 Design Principles

All agents must follow these principles when interacting with LLM
providers:

1.  **Use official SDKs only**
2.  **Prefer grounded answers when factual accuracy matters**
3.  **Use search tools for real‑time information**
4.  **Avoid building custom scraping or retrieval systems when the
    provider tool exists**
5.  **Keep the integration minimal and predictable**

------------------------------------------------------------------------

## 13.5 Summary

For this project:

-   Gemini must use **Google Search Grounding**
-   OpenAI must use **web_search**
-   Only the demonstrated API patterns are permitted

This ensures consistent behavior across all agents and improves
reliability when answering real‑world questions.

## 14. Keyboard Shortcuts

The platform supports specialized keyboard shortcuts to streamline development and management workflows, managed via a centralized **Global Hotkey Manager** (`HotkeysProvider`).

### 14.1 Global Editor Shortcuts
-   **Centralized Management**: All hotkeys are registered using the `useHotkeys` hook. This creates a stack of "scopes". Modals and menus push "exclusive" scopes that suspend background shortcuts.
-   **Hotkey Debug Overlay**: A visual indicator in the bottom-right corner displays active shortcuts. Disabled hotkeys (contextually inactive) are automatically hidden.
-   **F1**: Open **SQL Query Builder** when in a Python code editor (Active only when the **Code** tab is selected).
-   **Esc**: Navigate **Back** (to the parent list) from any editor or detail view.
-   **F4**: Switch to the **Python Code** tab (Node Engine/Report Code) from any other tab.
-   **Ctrl+S / Cmd+S**: Trigger **Save** action for the current form or editor.

### 14.2 Code Editor Shortcuts
-   **F5**: Trigger **Compile** action for the current report script or node (Active only when the **Python Code** tab is selected).
-   **F9**: Trigger **Generate** action to preview the report.

### 14.3 Modal & Context-Aware Behavior
-   **Exclusive Scopes**: Modals use `exclusive: true` scopes to block propagation of global shortcuts (e.g., `Cmd+S`, `F9`) from underlying layers.
-   **Hotkey Priority**: The topmost scope in the stack always has priority. A match in a child scope terminates processing for that event.
-   **Exception Support**: Exclusive scopes can allow specific keys to pass through via the `exclusiveExceptions` property.
-   **Nested Modals & Wrappers**: If a component wraps another component that has an exclusive scope (e.g. `AppFormView` or `AppCompactModalForm`), the inner content MUST pass its required hotkeys up to the wrapper via an `allowedShortcuts` array so they bypass the wrapper's exclusive block. 

### 14.4 Dynamic Hotkey Registration
-   **Reactive Properties**: The `useHotkeys` hook dynamically proxies hotkey properties (like `enabled`). Changing the `enabled` state of a hotkey (e.g. based on `activeTab`) automatically synchronizes with `HotkeysContext` without disrupting the stack order.
-   **Visual Synchronization**: The `HotkeysDebug` overlay inherently respects the `exclusive` boundaries. If an exclusive scope is active, the debugger automatically hides any hotkeys that belong to lower (blocked) scopes, ensuring the visual indicator perfectly matches execution state.

## 15. Data Locking System

The platform implements a global data locking mechanism to prevent accidental deletion or modification of critical business entities.

### 15.1 Backend Implementation
- **Storage**: A centralized `lock_data` table stores active locks. Each record consists of:
    - `entity_id` (UUID): The unique identifier of the locked record.
    - `entity_type` (String): The category of the entity (e.g., `report`, `agent_hints`, `node_type`, `credentials`).
- **Enforcement**:
    - **Read Operations**: List and Detail endpoints must correlate with the `lock_data` table to return an `is_locked` boolean flag.
    - **Write Operations**: All `UPDATE`, `PATCH`, and `DELETE` endpoints must invoke the `raise_if_locked(db, entity_id, entity_type)` utility. If a lock exists, the request must be rejected with a `403 Forbidden` error.

### 15.2 Frontend Representation
- **List Views**: Locked entities must display a discrete amber lock icon in the primary identification column (Key or Name).
- **Read-Only Mode**:
    - When an entity is locked, its edit form must transition to a strict **Read-Only** state.
    - All input fields, select menus, and code editors must be disabled.
    - The "Save" and "Delete" buttons must be hidden or disabled.
- **Lock Management**:
    - Administrators can toggle the lock status via the `AppLockToggle` component located in the `AppHeader` of the entity's editing view.
    - The toggle state must be synchronized with the backend in real-time.

## 16. System Parameters

The platform supports **System Parameters**—reserved, context-aware variables that are automatically resolved by the backend. These parameters are primarily used in SQL queries (reports) and Python node executions.

### 16.1 Naming Convention
All system parameters must be prefixed with `system_` (e.g., `system_project_id`). This prefix distinguishes them from user-defined parameters.

### 16.2 Available System Parameters
- **`system_project_id`**: Automatically resolves to the UUID of the currently active project. If no project is active, it may resolve to `null` or a default value depending on the execution context.

### 16.3 Usage in Editors
- **SQL Query Builder**: System parameters appear in the parameters dropdown for easy insertion into queries.
- **Python Editor**: Available in the parameter registry and autocompletion.
- **Auto-Resolution**: When executing a workflow or report, the system automatically injects these values. User-provided values with the same name will be ignored if the system can resolve them from the current session context.
