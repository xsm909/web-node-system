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
