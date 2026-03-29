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

- A **Pin button** is added to `AppHeader.tsx` (icon: `agents.md 9.3 keep`).
- Clicking the Pin button:
  - Removes the current form from the navigation stack.
  - Creates a pinned tab.
  - Activates pinned mode for that entity.

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
- Focus tab
- Close tab
- Switch between tabs

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