# Hotkey System Reference

This document describes the architecture, implementation, and best practices for the hotkey management system in the Web Node System.

## 1. Architecture Overview

The system is built on a **Hierarchical Stack-based Scope** model. Hotkeys are not global listeners; they are registered within "Scopes" that have specific priority levels.

### Core Files
- **`shared/lib/hotkeys/HotkeysContext.tsx`**: The heart of the system. Contains the `HotkeysProvider` which manages the stack of scopes, handles the global `keydown` event, and provides the `isTyping` detection logic.
- **`shared/lib/hotkeys/useHotkeys.ts`**: The primary hook for components to register their hotkeys. It handles registration on mount and automatic cleanup on unmount.
- **`widgets/hotkeys-debug/HotkeysDebug.tsx`**: A developer/user utility that renders the active hotkeys in the bottom-right corner of the screen.

## 2. Priority Levels (`HOTKEY_LEVEL`)

To prevent background components (like a Page container) from shadowing foreground components (like a Modal or a Widget), we use a priority system.

| Level | Value | Usage |
| :--- | :--- | :--- |
| `GLOBAL` | 0 | Universal shortcuts (e.g. system-wide toggles). |
| `PAGE` | 10 | Standard page-level navigation (e.g. `AppFormView`). |
| `FRAGMENT` | 15 | **Functional Widgets** (e.g. `WorkflowGraph`, `NodeEditor`, `ReportEditor`). |
| `MODAL` | 20 | Modals and Popups. Blocks everything below unless specified. |
| `OVERLAY` | 30 | Top-level overlays like context menus or dropdowns. |

> [!IMPORTANT]
> Always use `HOTKEY_LEVEL.FRAGMENT` for editors or graphs that reside inside an `AppFormView`. This ensures that common keys like `Backspace` or `Delete` are handled by the widget before the container's exclusive scope blocks them.

## 3. Typing Protection

The system automatically detects if the user is typing in an input, textarea, or content-editable element.

- **`isTyping`**: Boolean flag set when an input element is focused.
- **Protected Keys**: `Backspace`, `Delete`, `Enter`, `Space`, and Arrow keys are **blocked** from triggering hotkeys if `isTyping` is true. This prevents accidental node deletion while editing a parameter.

## 4. Exclusive Scopes

A scope can be marked as `exclusive: true`.

- **Effect**: When an exclusive scope is active, the system stops looking for matches in lower-priority scopes.
- **Bypass**: Use `allowedShortcuts: string[]` to allow specific keys (like `F5` or `Cmd+S`) to pass through an exclusive modal to the background layers.

## 5. Usage Example

### Basic Registration
```tsx
import { useHotkeys } from '@/shared/lib/hotkeys/useHotkeys';
import { HOTKEY_LEVEL } from '@/shared/lib/hotkeys/HotkeysContext';

useHotkeys([
  { 
    key: 'f5', 
    description: 'Run Component', 
    handler: () => handleRun() 
  },
  { 
    key: 'backspace', 
    description: 'Delete Item', 
    handler: () => handleDelete(),
    enabled: hasSelection // Conditional based on state
  }
], { 
  scopeName: 'MyWidget', 
  level: HOTKEY_LEVEL.FRAGMENT 
});
```

### Context-Aware Visibility
Shortcuts should only be "enabled" when they are actionable. This keeps the UI Guide clean.
```tsx
const hasSelection = nodes.some(n => n.selected);

useHotkeys([
  { key: 'cmd+c', description: 'Copy', handler: onCopy, enabled: hasSelection }
], { scopeName: 'Graph', level: HOTKEY_LEVEL.FRAGMENT });
```

## 6. Best Practices

1. **Naming Scopes**: Use descriptive names like `Workflow Editor` or `User Form`. These names appear in the Debug Overlay.
2. **Key Conflicts**: Prefer `F1-F12` for primary actions to avoid conflicts with standard browser shortcuts or typing.
3. **Cleanup**: `useHotkeys` handles cleanup automatically. Avoid manual event listeners for hotkeys.
4. **Levels**: If a hotkey isn't working in a "Pinned Tab" or "Modal", check if it needs a higher `HOTKEY_LEVEL`.
