# Workflow Node Toolbar (Photoshop-style)

The platform features a Photoshop-inspired vertical toolbar in the Workflow Editor, allowing for intuitive node management via drag-and-drop.

## 1. Overview

The `WorkflowToolbar` component serves as the primary node creation interface. It filters node types using the `show_in_toolbar` property and provides a high-performance drag-and-drop experience.

## 2. UI & Design

- **Layout**: Vertical panel on the left side of the workspace.
- **Styling**: 
  - Glassmorphism effect (`backdrop-blur-xl`, `bg-surface-800/80`).
  - Rounded edges (`rounded-2xl`).
  - 10px padding from the sidebar.
- **Buttons**:
  - Uses `AppRoundButton` in `ghost` mode.
  - White background (`!bg-white`).
  - Brand-colored icons (`!text-brand`) forced via CSS `currentColor`.
  - Hover state: 1.1x scale transform.
- **Labels**:
  - Interactive tooltips appear on the right when hovering over a button.
  - Displays the `node_type` name in uppercase with a themed background and arrow indicator.

## 3. Functionality

### Drag-and-Drop
- Users can drag node icons directly from the toolbar onto the React Flow canvas.
- Dropping on an empty area creates the node at the relative coordinate (centered).

### Auto-Connect (Drop-to-Append)
- **Mechanism**: If a node is dropped directly onto an existing node, the system triggers "Auto-Connect".
- **Logic**:
  1. The new node is automatically positioned vertically below the target node (default gap: `60px`).
  2. A new edge is automatically created from the target node's `output` handle to the new node's `top` handle.
- **Detection**: The drop handler iterates through current nodes to check if the drop coordinate falls within any node's bounding box.

## 4. Implementation Details

- **Component**: `WorkflowToolbar` ([WorkflowToolbar.tsx](file:///Users/Shared/Work/Web/web-node-system/frontend/src/widgets/workflow-graph/ui/WorkflowToolbar.tsx))
- **Integration**: Placed within a React Flow `Panel` (position: `top-left`) inside `WorkflowGraph.tsx`.
- **Icon Loading**: 
  - Uses `AppRoundButton` with `iconDir="node_icons"`.
  - Forced SVG color replacement via scoped `<style>` block: `.workflow-toolbar .icon { fill: currentColor !important; }`.
- **Drag API**: Standard HTML5 `dataTransfer` with `application/reactflow` type.
