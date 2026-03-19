# SQL Query Builder Technical Specification (CTE & Multi-Query)

This document describes the implementation of the advanced SQL Query Builder supporting Common Table Expressions (CTEs), multiple joins, and table aliasing.

## 1. Data Model

The state is managed as a `MultiQueryState`, which separates the main query from sub-queries (CTEs).

```typescript
interface MultiQueryState {
    mainQuery: QueryState;
    ctes: QueryCTE[];
}

interface QueryCTE {
    id: string;
    alias: string; // The table name used to reference this CTE
    state: QueryState;
}

interface QueryState {
    tables: QueryTable[]; // Array of table instances with unique aliases
    selectedFields: SelectedField[];
    joins: JoinCondition[];
    where: WhereCondition[];
}
```

## 2. Table Aliasing Strategy

To support multiple joins of the same table (including self-joins):
- Every table added to a query block is assigned a unique `alias`.
- If `users` is added twice, aliases will be `users` and `users_2`.
- All fields, joins, and conditions reference the `tableAlias` instead of the raw `tableName`.

## 3. CTE (Virtual Tables) Integration

### 3.1 Definition
- Users can create multiple named "Query Blocks" (CTEs).
- Each block has its own independent `QueryState`.

### 3.2 Usage as Virtual Table
- Any CTE can be added to the `Main Query` (or other blocks) as a "Virtual Table".
- When a CTE is added:
    - `tableName` is set to the CTE's `alias`.
    - `isCte` flag is true.
- Column discovery for virtual tables:
    - Instead of fetching from the database, columns are derived from the CTE's `selectedFields`.
    - Column names are taken from `field.alias` or `field.columnName`.

## 4. SQL Generation Logic

The generator uses a two-pass approach:

1. **Step 1: CTE Clause (`WITH`)**
    - Iterates through `fullState.ctes`.
    - Generates SQL for each CTE block.
    - Wraps them in `WITH alias AS (...)`.

2. **Step 2: Main Query**
    - Generates the standard `SELECT ... FROM ... JOIN ... WHERE` SQL for the `mainQuery` block.
    - References CTE aliases just like regular tables.

## 6. F1 Integration (Python Editor)

Users can invoke the Query Builder directly from the Python code editor:
- **Shortcut**: `F1`
- **Detection**: Automatically identifies SQL strings wrapped in triple quotes (`"""`, `'''`) or single/double quotes, including variable assignments (e.g., `query = """SELECT..."""`).
- **Insertion**: When "Ready" is clicked, the generated SQL replaces the selected string, maintaining current indentation levels.

## 7. Heuristic SQL Parser

The system includes a custom heuristic parser ([sqlParser.ts](file:///Users/Shared/Work/Web/web-node-system/frontend/src/features/query-builder/lib/sqlParser.ts)) to convert SQL strings back into the builder's state:
- **CTE Support**: Parenthesis-aware parsing derived from scanning the SQL string, supporting nested `SELECT` statements, subqueries, and multiple CTE definitions.
- **Strict Syntax Checking**: Detects stray text between clauses and malformed structures, reporting them as PostgreSQL-style syntax errors.
- **Unsupported Commands**: Explicitly rejects `EXPLAIN`, `UPDATE`, `DELETE`, etc., to prevent data corruption or visualization issues.

## 8. Hierarchical UI & Selection

The selection interface has been overhauled for better visibility and organization:

### 8.1 Two-Column Layout
- **Left Column (Selected Tables)**: Lists all tables participating in the query block. Tables are expandable/collapsible. Expanding a table reveals its specific columns for toggle-based selection.
- **Right Column (Selected Fields)**: Displays a hierarchical view of the fields currently in the `SELECT` clause, grouped by their parent table/CTE alias.

### 8.2 Field Expression Modal
For advanced column configuration, users can open the **Field Expression Modal** (via the "Edit" icon). This modal uses the **AppCompactModalForm** pattern:
- **Draggable UI**: The modal can be moved around the screen by dragging its header.
- **TanStack Form Integration**: State management is handled via `@tanstack/react-form` for more robust persistence.
- **Compact Layout**: Expression and Alias are placed in a single row to maximize vertical space.
- **Keyboard Support**: `Enter` to apply changes, `Esc` to cancel.
- **Persistence**: Changes are stored in the `SelectedField` object and reflected in the hierarchical tree and SQL preview.

### 8.3 Table Joins UI
The Table Joins interface identifies and manages relationships between tables within a query block:
- **Compact List Rendering**: Joins are displayed as single-line, color-coded SQL strings (e.g., `INNER JOIN records AS records_2 ON records.id = records_2.parent_id`).
- **Visual Highlighting**:
    - **Join Type**: Highlighted in `brand/70` for quick identification.
    - **Table Aliases & Columns**: Using `brand` color to distinguish between data sources and identifiers.
    - **Delimiters & Equality**: Subtle `text-muted` or `brand/50` for `.` and `=` to maintain high contrast.
- **Improved Editing Logic**:
    - Clicking any join opens the **AppCompactModalForm**.
    - **Target vs. Existing**: The modal eliminates redundancy by making the "Target Table (Joining)" selection explicit on the **LEFT** side of the ON clause, while the **RIGHT** side is dedicated to the "Existing Table" from the current query context.
- **Interactive Actions**: Delete action is accessible via a hover-trigger on individual join items.

## 9. UI Patterns

The Query Builder implements several advanced UI patterns to optimize the workspace:
- **AppCompactModalForm**: A non-standard, draggable, and compact modal layout for sub-extensions, used for both **Field Expressions** and **Table Joins**.
- **Hierarchical Trees**: Used for both selection and viewing current query components.
- **Compact SQL Strings**: A high-density, readable list pattern for complex configurations (Joins) that replaces heavy card-based layouts.

## 10. Error Reporting

Errors encountered during parsing are reported through the **Editor Console**:
- **Format**: `[SQL PARSE ERROR] syntax error at or near "<token>"`
- **Behavior**: The console is automatically cleared and focused upon error. The Query Builder modal will not open if the initial parsing fails, ensuring the user sees the error context immediately.

## 11. SQL Function Picker

The **Field Expression Modal** includes an integrated SQL Function Picker (`ComboBox`) to streamline complex expression building:

- **Categorized Library**: Functions are strictly grouped into three prioritized categories:
    - **`JSON`**: All JSON and JSONB processing functions (prioritized first).
    - **`MATH`**: A curated whitelist of common utilities and aggregations (`sum`, `count`, `upper`, `lower`, `now`, `date_trunc`, `coalesce`).
    - **`PUBLIC`**: All user-defined or additional functions found in the `public` schema.
- **Overload Handling**: Uses `DISTINCT ON` in the backend to prevent duplicate function names from cluttering the UI while preserving argument metadata.
- **Smart Insertion**:
    - For single-argument functions, it wraps the current expression: `UPPER(users.username)`.
    - For multi-argument functions, it provides placeholders: `date_bucket_floor(ts, <mode text>)`.
- **UI Layout**: Optimized sub-panel positioning with a **Cascading Layout** (50px horizontal and 30px vertical offset) to ensure visibility and prevent overlap with the main menu.

---
*Last Updated: 2026-03-20*
