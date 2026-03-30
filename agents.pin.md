# Feature Specification: Pinned Forms (Browser-like UI Mode)

## Overview
Introduce a "Pin" feature that allows users to detach and persistently edit multiple data entities (e.g. workflow, schema, agent hint, user, etc.) in parallel, outside of the navigation stack.

This creates a browser-like experience where each pinned entity is represented as a vertical tab on the right side of the application.

---

## Scope

### Supported Entities
Any entity that can be opened in `AppFormView.tsx` can be pinned.

### Excluded
- Metadata (not editable via `AppFormView`)

---

## Core Behavior

### 1. Opening Entities

- If an entity is **not pinned**:
  - It opens normally using the navigation stack.

- If an entity is **already pinned**:
  - Focus the existing pinned tab.
  - Do NOT open a new instance.

---

### 2. Pin Activation

- A **Pin button** is added to `AppHeader.tsx` (icon: `keep`).
- **Constraint**: Only **saved and non-dirty** entities can be pinned. If the form has unsaved changes, the Pin button is disabled with a tooltip ("Cannot pin unsaved data").
- Clicking the Pin button:
  - Detaches the entity from the standard navigation stack.
  - Creates a persistent pinned tab in the tray.
  - If already pinned, the Pin button is **hidden** in favor of the tab's dedicated Close (X) button.

---

### 3. Pinned Mode UI (Tab Transformation)

- When an entity is pinned:
  - The standard **Back** button in `AppHeader.tsx` transforms into a **Close (X)** icon.
  - The tooltip and aria-label update to "Close tab".
  - The **Esc** key is rebound to the "Close" action instead of "Go back".

---

### 3. Pinned Mode Behavior

- Pinned forms:
  - Are independent from the navigation stack.
  - Remain open until explicitly closed.
  - Can be edited and saved independently.
  - Are not affected by navigation changes.

---

### 4. Persistence

- Pinned tabs must persist across sessions.
- Use `Zustand` with localStorage (or equivalent persistence layer).

---

### 5. Right-side Tray UI

- A vertical tray is displayed on the **right side** of the application.
- Tabs are displayed as **vertical browser-like tabs (rotated 90°)**.

#### Tab Features:
- Title (entity name)
- Close button (X)
- Active state (highlighted)
- Dirty state indicator (if applicable)

---

### 6. Tab Management

- Only **saved entities** can be pinned.
- No explicit limit on number of tabs.

#### Actions:
- **Focus tab**: Clicking a tab in the tray focuses that entity.
- **Close tab**: Clicking the "X" on the tab (or in the header) removed it.
- **Neighbor Selection**: Closing the active tab automatically shifts focus to the neighboring tab (the one to its left, or the next available tab if leftmost).
- **Switch between tabs**: Users can toggle between multiple parallel workspaces.

---

### 7. Form Lifecycle

Each pinned tab maintains its own independent:

- Form state
- Loading state
- Saving state

---

### 8. Save Behavior

- Forms can be edited and saved independently.
- Closing behavior must account for unsaved changes:
  - (Implementation-defined: autosave or confirmation dialog)

---

### 9. Theme / Color Scheme

The application supports two data contexts:
- Global (default)
- Project-based

#### Rules:
- Each project has a predefined color scheme.
- Each pinned tab inherits its color scheme based on its entity context:
  - Project entity → project color theme
  - Global entity → default theme

- Switching between tabs updates the active color theme accordingly.

---

### 10. Project Context Handling

- Pinned entities remain accessible even if the user navigates away from the project.
- Project-based color themes must still apply to pinned entities.
- **Sidebar Restoration**: If the final pinned tab of a specific entity type is closed, the application automatically switches the sidebar to that entity's category list (e.g., closing the last pinned Workflow tab restores the 'Workflows' sidebar view).

---

## State Management

Use `Zustand` for managing pinned tabs.

### Suggested Model

```ts
type PinnedTab = {
  id: string
  entityType: string
  entityId: string
  title: string
  projectId?: string
  isDirty?: boolean
}
```

---

## Technical Implementation: Context Shadowing

To ensure pinned tabs function as independent, transient workspaces, the application implements a **Context Shadowing** system.

### 1. Dual-State Project Store (`features/projects/model/store.ts`)
The project store maintains two distinct states:
- **`baseProject`**: The persistent project selection controlled by the sidebar and URL. Used as the default context when no pinned tab is focused.
- **`activeProject`**: The effective context currently being used by the application (UI themes, API headers, system parameters).

### 2. Transient Overrides (`PinnedFormRouter.tsx`)
When a user interacts with a pinned tab:
- **Focusing a Tab**: `PinnedFormRouter` calls `setPinnedContext(tab.projectId)`. This updates `activeProject` to match the tab's context, instantly switching UI themes and API scopes.
- **Unfocusing**: Clicking outside pinned tabs or closing them clears the override, restoring the `activeProject` to the current `baseProject`.

### 3. Explicit Scoping (Prop Propagation)
All management widgets (Schemas, Hints, Workflows) accept an optional `projectId` prop.
- When rendered inside a pinned tab, the widget is passed the tab's specific `projectId`.
- This prop is prioritized over the global `activeProject` for all internal data-fetching and creation hooks.

### 4. Global Data Fetching (`X-Project-Skip`)
When a pinned tab is in "Global" mode (`projectId: null`), it must be able to fetch global data even if the sidebar is in project mode.
- Widgets detect the explicit `null` projectId and inject the `X-Project-Skip: true` header into API requests.
- This forces the backend to ignore any project context set by the sidebar's `X-Project-Id` middleware, ensuring the pinned tab remains a pure global workspace.

---

## 11. Editor Isolation (Anti-Contamination)

To prevent "Maximum update depth exceeded" errors and cross-tab data leakage, the platform implements **Provider-Level Isolation**.

### 1. Independent ReactFlow Stores
- Each `WorkflowEditorProvider` is wrapped in its own `<ReactFlowProvider>`.
- This ensures that internal ReactFlow states (nodes, edges, viewport) remain strictly local to the specific pinned tab.

### 2. Viewport Tracking (`WorkflowGraph.tsx`)
- Tracking of initialization and viewport centering is handled via instance-specific `useRef` (e.g., `isInitializedRef`).
- Global variables are avoided to prevent interference between parallel workflow instances.

---

### 1. Navigation Guard Isolation
Pinned tabs are functionally isolated from the global navigation stack to allow unrestricted multitasking.
- **Global Freedom**: Unsaved changes in a pinned tab **do not block** global navigation (e.g., clicking sidebar categories or switching projects). The user is free to move around the app while pinned data remains in its transient dirty state.
- **Local Enforcement**: The "Unsaved Changes" guard (Save/Discard/Stay) is **only triggered** when the user explicitly attempts to **Close** the pinned tab (via the 'X' button or `Esc`).

### 2. 3-Way Confirmation (`AppCompactModalForm`)
- Options: **Save Changes**, **Discard**, or **Stay and Edit**.
- **Unified Save Flow**: Choosing "Save Changes" executes the entity-specific `onSave` logic and removes the tab from the tray only after a successful write. Selecting "Discard" removes the tab immediately and restores the focus to a neighbor or the sidebar list.

---

## 13. Data Synchronization (TanStack Query)

The platform uses **TanStack Query** as the single source of truth to ensure real-time consistency between pinned tabs and the main list views.

### 1. Global Cache Invalidation
- All mutations (Save, Rename, Duplicate, Delete) trigger `queryClient.invalidateQueries({ queryKey: ['workflows'] })`.
- This ensures that saving a workflow in a pinned tab immediately pushes the update to the background `WorkflowList` without requiring a page refresh.

### 2. Force-Fresh Loading
- To prevent "flicker" of old data when switching tabs or opening renamed items, the `WorkflowEditorProvider` performs a forced fetch by ID.
- The `loadWorkflow` function bypasses current memory state and retrieves the absolute latest state from the database.

### 3. Loading Feedback
- Management lists implement an `isLoading` state (pulse animation) triggered by background refetches, providing visual confirmation of synchronization.