# Database Schema Documentation  
AI Agent Data Storage – Core Tables Structure

## Overview
This document describes the main tables used in the system for storing users, structured data records, schemas, prompts, LLM responses, and metadata assignments.

Current stage: table structures only (no relations, indexes, triggers or business rules yet).

---

## 1. users

Basic user authentication and role information.

| Column           | Data Type            | Max Length | Nullable | Default | Description                                      |
|------------------|----------------------|------------|----------|---------|--------------------------------------------------|
| id               | uuid                 | —          | NO       | —       | Primary key, unique user identifier              |
| username         | character varying    | 100        | NO       | —       | Unique login / username                          |
| hashed_password  | character varying    | 255        | NO       | —       | Securely hashed password                         |
| role             | USER-DEFINED (enum)  | —          | NO       | —       | User role (likely: admin, user, editor, etc.)    |

---

## 2. schemas

Storage of data schemas / templates / structures that define shape of records.

| Column      | Data Type         | Nullable | Default     | Description                                                                 |
|-------------|-------------------|----------|-------------|-----------------------------------------------------------------------------|
| id          | uuid              | NO       | —           | Primary key                                                                 |
| key         | character varying | NO       | —           | Unique machine-readable schema identifier                                   |
| content     | json              | NO       | —           | JSON Schema, example object, or field structure definition                  |
| is_system   | boolean           | YES      | —           | Flag: system-protected schema (cannot be edited/deleted by regular users)  |
| created_at  | timestamptz       | YES      | now()       | Creation timestamp                                                          |
| updated_at  | timestamptz       | YES      | now()       | Last modification timestamp                                                 |
| category    | character varying | YES      | —           | Grouping/category of the schema                                             |
| meta        | json              | YES      | —           | Additional schema metadata                                                  |
| lock        | boolean           | NO       | false       | Soft lock – prevents editing                                                |

---

## 3. records

Core content storage – all user-created / AI-generated structured entities.

| Column      | Data Type         | Nullable | Default     | Description                                                                |
|-------------|-------------------|----------|-------------|----------------------------------------------------------------------------|
| id          | uuid              | NO       | —           | Primary key                                                                |
| schema_id   | uuid              | NO       | —           | Foreign key → schemas.id (which schema this record follows)                |
| data        | json              | NO       | —           | Actual payload / content of the record                                     |
| created_at  | timestamptz       | YES      | now()       | Creation timestamp                                                         |
| updated_at  | timestamptz       | YES      | now()       | Last update timestamp                                                      |
| parent_id   | uuid              | YES      | —           | Self-reference → records.id (hierarchical / tree structure)               |
| order       | integer           | YES      | 0           | Sort order among siblings under the same parent                            |
| lock        | boolean           | NO       | false       | Prevents editing of the record                                             |

---

## 4. meta_assignments

Flexible many-to-many assignments / tags / ownership / relations between records and various entities.

| Column       | Data Type         | Nullable | Default     | Description                                                                |
|--------------|-------------------|----------|-------------|----------------------------------------------------------------------------|
| id           | uuid              | NO       | —           | Primary key                                                                |
| record_id    | uuid              | NO       | —           | → records.id (record being assigned to)                                    |
| entity_type  | character varying | NO       | —           | Type of entity (user, team, project, tag, department, etc.)                |
| entity_id    | uuid              | NO       | —           | ID of the specific entity of given type                                    |
| assigned_by  | uuid              | NO       | —           | → users.id (who performed the assignment)                                  |
| owner_id     | uuid              | YES      | —           | Explicit owner (if different from creator / assigner)                      |
| created_at   | timestamptz       | YES      | now()       | Assignment timestamp                                                       |

---

## 5. prompts

Storage of LLM prompts / instruction templates linked to entities.

| Column       | Data Type         | Nullable | Default     | Description                                                                |
|--------------|-------------------|----------|-------------|----------------------------------------------------------------------------|
| id           | uuid              | NO       | —           | Primary key                                                                |
| entity_id    | uuid              | NO       | —           | Entity the prompt is attached to (record, schema, user, etc.)              |
| entity_type  | character varying | NO       | —           | Type of the linked entity                                                  |
| content      | json              | NO       | —           | Prompt structure (usually {system, user, examples, …})                     |
| category     | character varying | YES      | —           | Prompt purpose/category (extraction, classification, generation, …)       |
| datatype     | character varying | NO       | —           | Expected output format/type (structured_json, text, boolean, …)           |
| created_at   | timestamptz       | YES      | now()       | —                                                                          |
| updated_at   | timestamptz       | YES      | now()       | —                                                                          |
| reference_id | uuid              | YES      | —           | Optional reference to another object (example output, parent prompt…)     |
| meta         | jsonb             | YES      | —           | Additional technical metadata (model name, version, provider, etc.)       |

---

## 6. response

Log / storage of LLM-generated responses and their metadata.

| Column        | Data Type         | Max Length | Nullable | Default            | Description                                                                |
|---------------|-------------------|------------|----------|--------------------|----------------------------------------------------------------------------|
| id            | uuid              | —          | NO       | gen_random_uuid()  | Primary key                                                                |
| entity_id     | uuid              | —          | NO       | —                  | Entity this response belongs to                                            |
| entity_type   | regclass          | —          | NO       | —                  | Table name of the entity (records, prompts, schemas, …)                    |
| reference_id  | uuid              | —          | YES      | —                  | Additional related entity ID (e.g. prompt that generated this)            |
| reference_type| regclass          | —          | YES      | —                  | Table of the reference entity                                              |
| created_at    | timestamptz       | —          | YES      | CURRENT_TIMESTAMP  | When the response was generated                                            |
| category      | character varying | —          | YES      | —                  | Type/stage of response (raw, extracted, summarized, validated…)           |
| context       | jsonb             | —          | YES      | —                  | Input context used to generate this response                               |
| context_type  | character varying | 25         | YES      | —                  | Nature of context (full_record, parent_chain, schema_only…)                |
| meta          | jsonb             | —          | YES      | —                  | Technical metadata (model, temperature, tokens used, version, cost…)      |

---

**End of current schema description – stage 1**

# Database Schema – Relationships

## Core Idea

- The `records` table is the central entity.  
  It stores all metadata objects, structured documents, and AI processing results.  
- Metadata records can be **nested** (hierarchical / tree structure) using the `parent_id` field.  
- Records are connected to users / clients through the flexible `meta_assignments` table.  
- Prompts and LLM responses are linked to records (and sometimes other entities) using polymorphic references (`entity_id` + `entity_type`).

## 1. Record Hierarchy (Nested Metadata / Tree Structure)

records.parent_id → records.id

- If parent_id is NULL → this is a root-level (top-level) record.  
- If parent_id points to another record → this is a child record.  
- The `order` field defines the sorting position among all children of the same parent.

Common use cases:  
- nested documents / folders  
- conversation threads / message chains  
- hierarchical tags / categories  
- tree of AI processing results

## 2. Linking Records to Users / Clients

Connection is handled through `meta_assignments` (flexible many-to-many + ownership).

### Variant A – Explicit owner
meta_assignments.owner_id → users.id  
(This field directly points to the owner of the record when set.)

### Variant B – Polymorphic assignment (most flexible and commonly used)

meta_assignments.record_id → records.id  
meta_assignments.entity_type → type of entity ('user', 'client', 'team', 'project', 'tag', etc.)  
meta_assignments.entity_id → ID of that entity  
meta_assignments.assigned_by → users.id (who created the assignment)

Most frequent pattern for client–record relationship:  
meta_assignments.entity_type = 'client'  
meta_assignments.entity_id → users.id  

This means:  
"This record belongs to this client / is visible to this client / was created for this client."

## 3. Prompts → Records

Polymorphic one-to-many relationship.

prompts.entity_id → records.id  
when prompts.entity_type = 'records'

This means:  
The prompt is attached to this specific record (e.g. the prompt used to generate it, or the default prompt for this type of metadata).

Also possible for other types:  
entity_type = 'schemas', 'users', etc.

## 4. Responses → Records

Polymorphic one-to-many relationship.

response.entity_id → records.id  
when response.entity_type = 'record'

This means:  
This LLM response (extraction result, classification, generated text, etc.) belongs to this record.

Optional additional link:  
response.reference_id → prompts.id  
(when reference_type points to the prompts table)

This allows tracing which prompt produced this particular response.

## Summary of Key Relationships

1. Metadata nesting  
   records.parent_id → records.id

2. Record ownership / visibility for client  
   meta_assignments.record_id → records.id  
   meta_assignments.entity_type = 'client'  
   meta_assignments.entity_id → users.id

3. Prompt attached to record  
   prompts.entity_type = 'records'  
   prompts.entity_id → records.id

4. LLM response attached to record  
   response.entity_type = 'record'  
   response.entity_id → records.id

5. Optional prompt → response connection  
   response.reference_id → prompts.id

End of relationships description

**End of current schema description – stage 2**