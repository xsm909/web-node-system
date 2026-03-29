# Project System Implementation Log

## Phase 1: Administrator Frontend & Backend API

### Summary
Implemented the core Project system, allowing administrators to manage projects associated with users. Projects are strictly scoped to their owners.

### Backend Details
- **SQLAlchemy Model**: `Project` ([project.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/models/project.py))
    - `id`: UUID (Primary Key)
    - `key`: String (Unique identifier, e.g., 'PROJECT-1')
    - `name`: String
    - `description`: Text (Optional)
    - `owner_id`: UUID (Foreign Key to `users.id`)
    - `theme_color`: String (HEX color)
    - `category`: String (Default: 'general')
- **Pydantic Schemas**: `ProjectCreate`, `ProjectUpdate`, `ProjectOut` (includes `is_locked`).
- **Endpoints**: `GET /projects/`, `POST /projects/`, `PUT /projects/{id}`, `DELETE /projects/{id}`.
- **Authorization**: Scoped by `owner_id` (Managers see only their assigned users' projects).

### Frontend Details
- **Entities**: TypeScript types and React Query hooks (`useProjects`, `useCreateProject`, etc.).
- **Widget**: `AdminProjectManagement` widget.
    - Full-width table with TanStack Table.
    - Sticky `AppHeader` with search and "New Project" action.
    - `AppFormView` for creating/editing with standard width (`max-w-5xl`).
    - Integrated `AppLockToggle` for data locking.
- **Integration**:
    - "Projects" tab added to `AdminUserManagement` (before Metadata).
    - `UserEditor` renders `AdminProjectManagement` when the projects tab is active.
- **UI/UX Standards**:
    - **Icon**: `project.svg`.
    - **Layout**: Full-width list, narrow-width forms.
    - **Grouping**: Collapsible category grouping.

### Verification Results
- Database migrations successfully applied in Docker environment.
- Full CRUD cycle verified in Admin UI.
- Data locking correctly prevents editing/deletion of locked projects.

## Phase 2: Project Mode Implementation

### Summary
Introduced "Project Mode," a system-wide state where the application context is tied to a specific project. This mode affects the visual theme, sidebar navigation, and provides context to backend operations.

### Frontend Details
- **State Management**: `useProjectStore` (Zustand) manages `activeProject` and `isProjectMode`.
- **Activation Flow**: 
    - User Management -> Projects Tab.
    - A **"Play/Activate"** icon button is available directly in each row of the projects table (appears on hover or stays active if the project is selected).
    - This allows high-speed switching between projects without entering the edit form.
- **Dynamic Theming**: 
    - Activating a project injects its `theme_color` into the `--brand` and `--brand-hover` CSS variables globally.
    - Exiting restores the default Emerald green (`#10b981`).
- **Sidebar Integration**: 
    - An "Active Project" block appears above the "Sign Out" button.
    - Displays the project name and an **"Exit Project"** button.
- **API Interceptor**:
    - Automatically attaches `X-Project-Id` and `X-Project-Owner` headers to all outgoing requests when Project Mode is active.

### Backend Details
- **Context Library**: `projects_lib.py` ([projects_lib.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/internal_libs/projects_lib.py))
    - `is_project_mode() -> bool`
    - `get_project_id() -> Optional[uuid.UUID]`
    - `get_project_owner() -> Optional[uuid.UUID]`
- **Middleware**: `add_project_context` middleware in `main.py` extracts project headers and populates `contextvars` in `context_lib.py`.

### Verification Results
- **Theme Sync**: Verified dynamic color updates on `:root`.
- **Persistence**: Project mode state persists across page refreshes via `localStorage`.
- **Sidebar UX**: Verified visibility of active project block and exit functionality.
- **Backend Sync**: Verified that `projects_lib.py` correctly reports project state based on request headers.

## Phase 3: Project-Aware Libraries

### Summary
Updated core internal libraries (`prompt_lib` and `response_lib`) to automatically handle project-specific data. This ensures that when a project is active, all prompt and response operations are strictly scoped to that project without requiring explicit `project_id` arguments from callers.

### Backend Details
- **Prompt Library** ([prompt_lib.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/internal_libs/prompt_lib.py)):
    - `add_prompt`: Automatically includes `project_id` from the current project context.
    - `get_prompts_by_category_with_reference_id`: Filters by `project_id` if in project mode.
    - `get_prompts_by_category_with_id`: Filters by `project_id` if in project mode.
    - `delete_prompts_by_period_and_entity`: Filters by `project_id` if in project mode.
    - `delete_prompts_by_period_and_reference_id`: Filters by `project_id` if in project mode.
- **Response Library** ([response_lib.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/internal_libs/response_lib.py)):
    - `add_response`: Automatically includes `project_id` from the current project context.
    - `clear_recent_records_by_entity_and_category`: Filters by `project_id` if in project mode.
    - `get_responses_by_period_and_category`: Filters by `project_id` if in project mode.

### Verification Results
- **Auto-Scoping**: Verified that new prompts/responses are created with the correct `project_id`.
- **Query Filtering**: Verified that retrieval operations only return data for the active project.
- **Retro-Compatibility**: Verified that operations still work correctly for "global" data (where `project_id` is null) when no project is active.

## Phase 4: Project Isolation for Core Entities

### Summary
Implemented strict data isolation and project context persistence for Schemas, Workflows, and Reports. This ensures that users see only the data relevant to their current project context (or system/common data) and that new items maintain their project association even if the project context is exited during the creation process.

### Backend Details
- **Schema Router** ([schemas.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/routers/schemas.py)):
    - `get_schemas`: Filters by `project_id` or `is_system=True` in project mode; only `project_id=None` outside project mode.
    - `create_schema`: Persists `project_id` from the creation payload or current context.
- **Workflow Router** ([workflow.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/routers/workflow.py)):
    - `list_common_workflows` & `get_user_workflows`: Strictly filter by `project_id` based on project mode.
    - `create_workflow`: Persists `project_id` from the payload or current context.
- **Report Router** ([report.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/routers/report.py)):
    - `list_reports`: Filters by `project_id` in project mode; only `project_id=None` outside project mode.
    - `create_report`: Persists `project_id` from the payload or current context.

### Frontend Details
- **Automatic List Refreshing**:
    - Updated `useSchemas` query key to include project context.
    - Integrated `useProjectStore` into `ReportManagement` and `AdminCommonWorkflowManagement` to ensure lists refresh automatically when entering or exiting a project.
- **Creation Persistence**:
    - Implemented `creationProjectId` state in management widgets.
    - This state captures the active `project_id` when creation starts and passes it to the final save/create hit, preserving the association even if the user navigates away or exits the project during editing (particularly relevant for multi-tab editors like `ReportEditor`).

### Verification Results
- **Data Isolation**: Verified that project-specific workflows and reports are hidden when no project is active, and vice versa.
- **UI Consistency**: Confirmed that all lists refresh instantly upon project activation/deactivation.
- **Persistence**: Validated that items created within a project context are correctly saved with the `project_id` even if the project is exited before clicking "Save".

## Phase 5: Agent Hints Project Isolation

### Summary
Implemented project-based filtering and isolation for Agent Hints. This includes a clear UI distinction between different hint sources (System, Project, Global) and automatic project association during creation.

### Backend Details
- **Model & Schema** ([agent_hint.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/models/agent_hint.py), [agent_hint.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/schemas/agent_hint.py)):
    - Added `project_id` to Agent Hint model and schemas.
- **Router** ([agent_hints.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/routers/agent_hints.py)):
    - `list_agent_hints`:
        - **Project Mode ON**: Returns `(system_hints == True) | (project_id == active_project_id)`.
        - **Project Mode OFF**: Returns `(system_hints == True) | (project_id == None)`.
    - `create_agent_hint`: Automatically assigns `project_id` from the current project context if the hint is not a system hint.

### Frontend Details
- **Infrastructure**:
    - Updated `useAgentHints` React Query hook to include `isProjectMode` and `activeProject.id` in its `queryKey`. This ensures the list is instantly refreshed when entering or exiting a project.
    - Updated `useMetadataList` with the same project-reactive query key to prevent stale data.
- **Widget** ([AgentHintManagement.tsx](file:///Users/Shared/Work/Web/web-node-system/frontend/src/widgets/admin-agent-hint-management/ui/AgentHintManagement.tsx)):
    - Added a **Source** column to the table with custom icons and labels:
        - `verified.svg` (System) — Internal hints.
        - `project.svg` (Project) — Hints specific to the active project.
        - `public.svg` (Global) — General hints.
    - Updated row icons to distinguish between System (`verified.svg`) and User hints (`lightbulb_circle.svg`).

### Verification Results
- **Dynamic List Refetching**: Verified that exiting a project triggers an immediate refetch of agent hints.
- **Automatic Scoping**: Verified that new hints created in project mode are correctly associated with the active project.
- [x] UI Source Visibility: Confirmed that the "Source" column clearly identifies the origin of each hint.
- [x] Verified that agent hints list and metadata list refresh automatically when exiting or entering projects.

## Phase 6: Robustness & Bug Fixes

### Summary
Addressed critical backend issues related to object creation and Pydantic validation to ensure reliable saving of Schemas, Reports, and Workflows.

### Backend Details
- **Redundant Parameter Fix**:
    - Resolved `TypeError: got multiple values for keyword argument 'project_id'` in `schemas.py` and `report.py` routers.
    - Updated `create_schema` and `create_report` to exclude `project_id` from the Pydantic `model_dump()` before passing it to the model constructor.
- **Timestamp Validation Fix**:
    - Resolved `ValidationError` for `updated_at` field in `ReportOut` and `SchemaResponse`.
    - Updated `Report` and `Workflow` models to include `server_default=func.now()` for `updated_at`.
    - Made `updated_at` optional in Pydantic output schemas to handle the case where the database hasn't returned the timestamp immediately after creation.

### Verification Results
- **Creation Cycle**: Verified that new schemas and reports are saved successfully in both project and general modes.
- **Validation**: Confirmed that output schemas correctly handle `None` values for `updated_at` during the refresh phase of the creation process.

## Phase 7: System Parameters

### Summary
Introduced a centralized system for "System Parameters" — reserved variables that are automatically resolved from the application context (e.g., active project). These parameters are prefixed with `system_` and are available in SQL queries and Python code editors.

### Backend Details
- **Core Library** ([system_parameters.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/core/system_parameters.py)):
    - `SYSTEM_PARAMETER_RESOLVERS`: Registry of parameter names and their resolver functions.
    - `system_project_id`: Automatically resolves to the current active `project_id`.
    - `inject_system_params`: Merges system parameters into user-provided parameter dictionaries, allowing system values to be used as defaults or overrides.
- **Workflow Execution**: Integrated into `run_workflow` to ensure all node executions have access to project context.

### Frontend Details
- **Constants** ([constants.ts](file:///Users/Shared/Work/Web/web-node-system/frontend/src/entities/report/model/constants.ts)):
    - `SYSTEM_PARAMETERS`: Centralized registry of system parameters for UI usage.
- **Query Builder**: Updated the SQL parameter dropdown to include system parameters, making them easily discoverable for report and node development.
- **Code Editor**: Included system parameters in the autocompletion registry for Python and SQL editors.

### Verification Results
- **Auto-Resolution**: Verified that `:system_project_id` in SQL queries correctly resolves to the active project UUID.
- **Discovery**: Confirmed system parameters appear in the parameter selection UI across the platform.

## Phase 8: Strict Context Isolation & Filtering

### Summary
Addressed architectural vulnerabilities where pinned tabs could "leak" project context to global items (data poisoning) and where global items would "leak" into project-specific lists (global leak). Formalized the **Context Shadowing** pattern and tightened backend filtering.

### Frontend Details
- **Explicit Scoping**: 
    - Moved from an implicit reliance on the global `activeProject` to explicit `projectId` prop propagation.
    - Updated `SchemaManagement`, `AgentHintManagement`, and `WorkflowManagement` to accept `projectId`.
- **API Interceptor Bypass (`X-Project-Skip`)**:
    - Implemented a mechanism where pinned tabs in "Global" mode explicitly request global data using the `X-Project-Skip: true` header.
    - This ensures that a global pinned tab remains global even if the user activates a project in the sidebar.
- **Header Badge Sync**: 
    - `AppHeader` now uses the local `projectId` prop to display the correct project badge/title, ensuring the header accurately reflects the tab's context rather than the application's global state.

### Backend Details
- **Schema Filtering** ([schemas.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/routers/schemas.py)):
    - Tightened `get_schemas` to exclude regular global schemas in Project Mode.
    - Only project-specific and `is_system=True` schemas are visible.
- **Metadata Filtering** ([metadata.py](file:///Users/Shared/Work/Web/web-node-system/backend/app/routers/metadata.py)):
    - Implemented a join with the Schema model for all metadata listing operations.
    - In Project Mode, only returns records belonging to the project or records associated with **System** schemas.

### Verification Results
- **Context Stability**: Verified that switching projects in the sidebar does NOT affect the data displayed in open pinned tabs. 
- **Creation Isolation**: Confirmed that creating a new schema in a global pinned tab results in a global schema, even while in a project.
- **Filtering Strictness**: Confirmed that regular global schemas and metadata entries are hidden when a project is active, providing a focused project workspace.
