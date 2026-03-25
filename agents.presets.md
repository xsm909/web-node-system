# SQL Query Presets - System Overview

## Purpose
The Presets system allows users to save and load complex configurations within the SQL Query Builder. This ensures that multi-block queries (CTEs), complicated joins, and filter conditions can be persisted and reused across sessions. Presets are common data available across the entire platform.

## Implementation Details

### 1. Backend Architecture
- **Database Model (`backend/app/models/preset.py`)**: 
    - A `Preset` table was created to store preset configurations.
- **REST API (`backend/app/routers/presets.py`)**:
    - `POST /presets/`: Handles both creation of new presets and updates to existing ones (upsert based on name and entity type).
    - `GET /presets/`: Retrieves a list of presets for the specified `entity_type`.
    - `DELETE /presets/{preset_id}`: Removes a preset record.
- **Integration (`backend/app/main.py`)**:
    - Registered the `presets` router.

### 2. Frontend Integration
- **`usePresets` Hook (`frontend/src/features/query-builder/lib/usePresets.ts`)**:
    - Encapsulates state management for presets (listing, saving, and deletion).
- **UI Interaction (`frontend/src/features/query-builder/ui/QueryBuilderModal.tsx`)**:
    - **Save Preset**: Triggered by the `bookmark_add` icon in the modal header. Opens a dialog to name the configuration.
    - **Load Preset**: A `ComboBox` with the `bookmark` icon allows selecting and loading existing configurations.
    - **Full State Preservation**: The entire `MultiQueryState` is serialized as JSON in the `preset_data` field, preserving all query blocks, tables, and conditions.

- `AppCompactModalForm`: Used for creating a consistent modal interface for saving presets.
- `ComboBox`: Used for the load preset selection dropdown with search and clear integration.
- `apiClient`: Used to ensure all requests are signed with the active `X-Project-Id`.

## Future Expansion
The system is designed to be extensible. By utilizing the `entity_type` field, similar preset functionality can be added to other parts of the platform (e.g., report parameters, workflow nodes) with minimal changes.

---
**Status**: Ready for production.
**Reference Chat**: 28ebaead-6b96-40c8-9530-91648e2fbaa0
