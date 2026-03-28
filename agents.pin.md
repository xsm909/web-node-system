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