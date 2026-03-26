# Workflow Node Toolbar (Photoshop-style)

The platform features a Photoshop-inspired vertical toolbar in the Workflow Editor, providing a premium glassmorphism interface for node management via drag-and-drop.

## 1. Overview

The `WorkflowToolbar` component serves as the primary node creation interface. It filters node types using the `show_in_toolbar` property and provides a high-performance, unclipped drag-and-drop experience.

## 2. UI & Design

- **Layout**: Vertical panel (`flex-col`) on the left side, anchored with a 10px spacing (`ml-4`).
- **Styling**: 
  - **Glassmorphism**: High-intensity blur (`backdrop-blur-xl`) with a translucent background (`bg-surface-800/80`) and a subtle white border.
  - **Outer Frame**: Strong shadow (`shadow-2xl`) and `rounded-2xl` corners.
- **Buttons**:
  - Uses `AppRoundButton` in `ghost` mode with a solid white background (`!bg-white`).
  - Brand-colored icons (`!text-brand`) forced via scoped CSS: `.workflow-toolbar .icon { fill: currentColor !important; }`.
  - **Stability**: Icons are individually wrapped in a fixed `w-10 h-10` container to prevent layout shifts during hover or drag.
  - **Interactivity**: Micro-animations on hover (`scale-110`) and click (`scale-95`).
- **Hints (Tooltips)**:
  - **Design**: Frosted glass look with `blur(16px)`, `rgba(255, 255, 255, 0.9)` background, and a visible `border-white/40`.
  - **Corners**: Large `rounded-2xl` for a premium, organic feel.
  - **Positioning**: Fixed at `12px` to the right of the icon edge.

## 3. Functionality

### Drag-and-Drop (Unclipped Snapshot)
- **Problem**: Default browser drag snapshots often clip `absolute` elements (hints) or shadows that extend beyond the item's width.
- **Solution**: 
  - Each item uses a massive horizontal drag buffer (`pr-[240px]`) and vertical buffer via negative margins.
  - **Result**: The drag "ghost" captures the icon, the hint, and all surrounding shadows perfectly without any straight-edge clipping.
  
### Drag Visibility Logic
- **Requirement**: Hint must be visible in the drag ghost but hidden from the toolbar during the drag operation to clear workspace clutter.
- **Implementation**: 
  - `onDragStart` uses a micro-delay (`setTimeout(..., 0)`) to update the `draggingNodeId` state. 
  - This ensures the browser takes the snapshot of the *visible* hint first, then immediately hides it from the toolbar UI one tick later.

### Auto-Connect (Drop-to-Append)
- Dropping a toolbar node onto an existing graph node automatically positions it below and connects it via a new edge.
- Default connect gap: `60px`.

## 4. Implementation Details

- **Main Component**: `WorkflowToolbar` ([WorkflowToolbar.tsx](file:///Users/Shared/Work/Web/web-node-system/frontend/src/widgets/workflow-graph/ui/WorkflowToolbar.tsx))
- **Integration**: Placed within a React Flow `Panel` (position: `top-left`) inside `WorkflowGraph.tsx`.
- **Drag API**: Standard HTML5 `dataTransfer` with `application/reactflow` type.
