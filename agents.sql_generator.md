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

## 5. UI Components

- **Sidebar**: Toggle between "Main Query" and "Query Blocks". 
- **ColumnSelect**: Smart component that checks if a table alias points to a database table or a CTE to provide the correct column list.
- **TableSelectionView**: Displays "AS alias" when it differs from the table name. Handles field selection from both physical and virtual tables.

---
*Last Updated: 2026-03-18*
