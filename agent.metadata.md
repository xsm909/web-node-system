# JSON Schema Management System - Project Vision

## Concept
A robust system for managing JSON Schemas and validating JSON data against them. This includes a schema registry with dependency support, versioning, a user-friendly editor, and a separate data store for JSON payloads.

## Core Features
1. **Schema Storage & Registry**
   - Store schemas in a database.
   - Support for cross-schema references via `$ref`.
   - Dependency management (inheritance/reusability).
2. **Versioning**
   - Deferred for now (simple incremental approach).
3. **Schema Editor**
   - A dedicated UI for creating and modifying schemas.
4. **Validated Data Store**
   - Store JSON data blobs linked to any database entity.
   - Automatic validation against the chosen schema.
5. **CRUD Operations**
   - Full lifecycle management for both schemas and data.

## Technology Stack
- **Frontend**: FSD (Feature-Sliced Design) + TanStack (Query, Router, Table, Form).
- **Styling**: Vanilla CSS (Modern aesthetic).
- **Backend**: **Python (FastAPI)** + **PostgreSQL**.

## Core Decisions
- **Database**: PostgreSQL (using `jsonb`).
- **Roles**:
  - **Admin**: Full control over Schemas (CRUD). Manages system schemas and assignments.
  - **User**: CRUD on JSON Data (records) for assigned entities/schemas.
- **$ref Support**: Internal and External (Schema.org, etc.). Manual Lazy Refresh for external.
- **Editor**: Combined (Visual builder + Monaco Editor).
- **Validation**: Dual-layer (Frontend + Backend).

## Proposed Storage Schema

### 1. `schemas` Table
Stores the actual JSON Schemas.
- `id`: UUID (PK)
- `key`: String (Unique, e.g., 'client-profile')
- `content`: JSONB (The schema)
- `is_system`: Boolean (If true, only Admin can edit)
- `created_at`, `updated_at`: Timestamps

### 2. `records` Table
Stores the validated JSON data.
- `id`: UUID (PK)
- `schema_id`: UUID (FK to `schemas`)
- `data`: JSONB (The validated payload)
- `created_at`, `updated_at`: Timestamps

### 3. `meta_assignments` Table (Polymorphic Binding)
Links metadata records to any entity in the system.
- `id`: UUID (PK)
- `record_id`: UUID (FK to `records`)
- `entity_type`: String (e.g., 'client', 'project', 'user')
- `entity_id`: UUID (ID of the target entity)
- `assigned_by`: UUID (Admin who created the link)
- `owner_id`: UUID (User who owns/edits this specific metadata)

### 4. `external_schemas_cache` Table
- `url`: String (Unique)
- `content`: JSONB
- `last_fetched`: Timestamp
- `etag`: String

## Client Metadata Transition
- **Legacy**: `client_metadata` table exists and is considered obsolete.
- **New Approach**: 
  1. Admin creates a schema (e.g., `key: 'client-v1'`).
  2. Admin marks this schema as the "Default Client Schema".
  3. All metadata for clients will now use this schema through the `meta_assignments` system.
  4. Migration script will eventually move data from `client_metadata` to `records`/`meta_assignments`.

## Permissions & Lifecycle
1. **Permission Logic:** Initially simple. Admin assigns metadata to a client entity. A manager assigned to or managing that client can edit the data.
2. **Deletion:** No soft deletes. When an entity (e.g., a client) is deleted, we'll eventually run a background job to garbage-collect "orphaned" records in `meta_assignments` and `records`.
