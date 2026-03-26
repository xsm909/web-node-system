# Workflow Node Toolbar Visibility

The platform supports a visibility system for Node Types within the Workflow Editor's toolbar (Add Node menu).

## 1. Overview

The `show_in_toolbar` property allows administrators to control which node types are visible to managers when they are building workflows. This is useful for:
- Hiding internal utility nodes.
- Restricting access to advanced or experimental nodes.
- Simplifying the node library for end-users.

## 2. Configuration (Admin)

Administrators can toggle visibility in the **Node Library** management view (`/admin/node-types`):

- **In the List View**: A visibility icon (eye) allows for quick toggling of the `show_in_toolbar` status.
- **In the Node Editor**: A toggle switch is available in the **Configuration** tab.

**Default Status**: `false` (Hidden).

## 3. Implementation Details

### Database Schema
The `node_types` table includes a boolean column:
- `show_in_toolbar` (BOOLEAN, DEFAULT FALSE)

### Frontend Filtering
The following components respect the `show_in_toolbar` flag:
- **Add Node Menu**: Only displays nodes where `show_in_toolbar` is `true`.
- **Node Library (Side Panel)**: Only displays nodes where `show_in_toolbar` is `true`.

## 4. Technical Stack

- **Backend**: FastAPI with SQLAlchemy model `NodeType`.
- **Frontend**: React with TanStack Table for management and custom `SelectionList` for the toolbar.
- **Iconography**:
  - `visibility.svg`: Node is visible in the toolbar.
  - `visibility_off.svg`: Node is hidden from the toolbar.
