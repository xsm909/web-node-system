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
- **CTE Support**: Recursively parses `WITH` clauses and maps them to separate Query Blocks.
- **Strict Syntax Checking**: Detects stray text between clauses and malformed structures, reporting them as PostgreSQL-style syntax errors.
- **Unsupported Commands**: Explicitly rejects `EXPLAIN`, `UPDATE`, `DELETE`, etc., to prevent data corruption or visualization issues.

## 8. Selection & Expressions

The field selection UI ([QueryBuilderModal.tsx](file:///Users/Shared/Work/Web/web-node-system/frontend/src/features/query-builder/ui/QueryBuilderModal.tsx)) has been enhanced for productivity:
- **Compact View**: Columns are displayed in a space-efficient vertical list.
- **Select All (*)**: Quick toggle for selecting all columns of a table.
- **Custom Expressions**: Support for wrapping fields in SQL functions (e.g., `UPPER(u.name)`) or defining raw SQL expressions.
- **Aliasing**: Every selected field can have a custom `AS` alias defined directly in the UI.

## 9. Error Reporting

Errors encountered during parsing are reported through the **Editor Console**:
- **Format**: `[SQL PARSE ERROR] syntax error at or near "<token>"`
- **Behavior**: The console is automatically cleared and focused upon error. The Query Builder modal will not open if the initial parsing fails, ensuring the user sees the error context immediately.

---
*Last Updated: 2026-03-19*
