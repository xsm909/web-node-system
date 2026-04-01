# Presets System - System Overview

## Purpose
The Presets system allows users to save and load complex configurations across the platform. This ensures that:
- **Workflows**: User can save and load full node graphs (selections, connections, groups).
- **SQL Queries**: Multi-block queries (CTEs), joins, and filters in the Query Builder can be persisted.
- **Parameters**: Individual dropdown parameter configurations (source, value/label fields) for Reports and Workflows can be saved and reused.

Presets are common data available across the entire platform.

## Implementation Details

### 1. Backend Architecture
- **Database Model (`backend/app/models/preset.py`)**: A `Preset` table stores configurations.
- **REST API (`backend/app/routers/presets.py`)**:
    - `POST /presets/`: Handles creation and updates (upsert based on name and entity type).
    - `GET /presets/`: Retrieves presets for a specific `entity_type` (e.g., `'workflow'`, `'query'`, `'parameter'`).
    - `DELETE /presets/{preset_id}`: Removes a preset record.
    - `PATCH /presets/{preset_id}`: Renames an existing preset.

### 2. Frontend Architecture (FSD)

#### Data Layer (`entities/preset`)
- **`usePresets` Hook**: A generic hook for managing the `Preset` entity, allowing any feature to fetch, save, or delete configurations scoped by `entity_type`.
- **`PresetsProvider`**: A global context that caches fetched presets by type to avoid redundant API calls and ensure UI synchronization (e.g., refreshing the sidebar and toolbars).

#### Unified Feature (`features/preset-management`) [NEW]
The system is consolidated into a single management feature that replaces legacy `workflow-presets` and `parameter-presets`:
- **`PresetSelector`**: A unified component for selecting presets.
    - **Header Mode**: Uses `ComboBox` for toolbars (SQL, Parameters).
    - **Floating Mode**: Uses a portalled `SelectionList` for hotkey-triggered menus (Workflow F7).
    - **Management UI**: Built-in support for **Rename** and **Delete** actions directly from the selector.
- **`PresetSaveModal`**: A standardized modal for creating any kind of preset with a consistent look and feel.

#### Shared UI (`shared/ui/selection-list`)
- **Global Stacking**: All portalled dropdowns use `z-[10000]` to ensure they appear correctly over modals (`z-6000`).
- **Interactive Backdrops**: Portalled lists include a blurred backdrop for click-outside detection.

## Usage

### Workflow Editor
- **Save**: `Cmd+S` or "Save Preset" button in the toolbar.
- **Load (F7)**: Press **F7** on the canvas to open the floating `PresetSelector` at the cursor position.
- **Toolbar**: A round `bookmark` button in the actions bar provides quick access to the standard selector.

### SQL Query Builder (Constructor)
- **Save**: Triggered by the `bookmark_add` icon in the modal header.
- **Load**: A `ComboBox` with the `bookmark` icon in the modal header (Entity Type: `"query"`).

### Parameter Editor (Workflows & Reports)
- **Unified Logic**: Both systems use the same `AppParameterListEditor`.
- **Loading**: Select an existing preset from the dropdown icon in the header (Entity Type: `"parameter"`).
- **Saving**: Click the `bookmark_add` icon within a "Select (Dropdown)" parameter card.

---
**Status**: Unified & Standardized (FSD Compliant).
**Reference Chat**: 8534f9e7-4b2d-4b73-a9ab-4ad878fa1b02
