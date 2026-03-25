# Presets System - System Overview

## Purpose
The Presets system allows users to save and load complex configurations across the platform. This ensures that:
- **SQL Queries**: Multi-block queries (CTEs), joins, and filters in the Query Builder can be persisted.
- **Parameters**: Individual dropdown parameter configurations (source, value/label fields) for Reports and Workflows can be saved and reused.

Presets are common data available across the entire platform.

## Implementation Details

### 1. Backend Architecture
- **Database Model (`backend/app/models/preset.py`)**: A `Preset` table stores configurations.
- **REST API (`backend/app/routers/presets.py`)**:
    - `POST /presets/`: Handles creation and updates (upsert based on name and entity type).
    - `GET /presets/`: Retrieves presets for a specific `entity_type` (e.g., `'query'`, `'parameter'`).
    - `DELETE /presets/{preset_id}`: Removes a preset record.

### 2. Frontend Architecture (FSD)

#### Data Layer (`entities/preset`)
- **`usePresets` Hook**: A generic hook for managing the `Preset` entity, allowing any feature to fetch, save, or delete configurations scoped by `entity_type`.

#### Features (`features/parameter-presets`)
- **`ParameterPresetSelector`**: A ghost-style ComboBox for loading parameter configurations.
- **`SaveParameterPresetButton`**: An icon button and modal for saving a specific parameter's configuration.

#### Shared UI (`shared/ui/app-parameter-list-editor`)
- A "dumb" component that handles the rendering of parameter lists.
- **Slot Injection**: Uses `renderHeaderActions` and `renderParameterActions` props to allow features (like presets) to inject logic without coupling the shared UI to features.

## Usage

### SQL Query Builder
- **Save**: Triggered by the `bookmark_add` icon in the header.
- **Load**: A `ComboBox` with the `bookmark` icon.

### Parameter Editor (Workflows & Reports)
- **Unified Logic**: Both systems use the same `AppParameterListEditor`.
- **Loading**: Select an existing preset from the dropdown icon in the header.
- **Saving**: Click the `bookmark_add` icon within a "Select (Dropdown)" parameter card to save its config for later use.

---
**Status**: Ready for production.
**Reference Chat**: 746da09d-f7b1-4b1f-b5f1-5eeb6101ee90
