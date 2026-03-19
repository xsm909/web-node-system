# SQL Query Builder Technical Specification (CTE & Multi-Query)

This document describes the implementation of the advanced SQL Query Builder supporting Common Table Expressions (CTEs), multiple joins, table aliasing, and recursive hierarchical queries.

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
    isRecursive?: boolean;
    recursiveConfig?: RecursiveConfig;
    state: QueryState;
}

interface RecursiveConfig {
    anchorTable: string;
    primaryKey: string;
    parentKey: string;
    depthColumn?: string;
}

interface QueryState {
    tables: QueryTable[]; // Array of table instances with unique aliases
    selectedFields: SelectedField[];
    joins: JoinCondition[];
    where: WhereCondition[];
}

interface WhereCondition {
    // ...
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
    // ...
}
```

## 2. Table Aliasing & Quoting Strategy

To support multiple joins, self-joins, and reserved SQL keywords:
- Every table/CTE is assigned a unique `alias`.
- All SQL identifiers (table names, aliases, columns) are wrapped in **double quotes** (`"identifier"`) for strict compatibility with PostgreSQL.
- The generator uses a `q()` utility to ensure consistent quoting and prevent syntax errors with keywords like `"order"`.

## 3. CTE (Virtual Tables) Integration

### 3.1 Definition
- Users can create multiple named "Query Blocks" (CTEs).
- Blocks can be **Regular** or **Recursive**.

### 3.2 Recursive CTEs
- Defined via a dedicated **Recursion Modal** in the UI.
- Supports the `UNION ALL` pattern for hierarchical data (e.g., parent-child trees).
- Includes an optional **Depth Level** field to track recursion depth.
- The generator automatically prefixes columns in the recursive part (e.g., `r.column`) to prevent column count mismatches.

### 3.3 Usage as Virtual Table
- Any CTE can be added to the `Main Query` (or other blocks) as a "Virtual Table".
- Column discovery:
    - Columns are derived from the CTE's `selectedFields`.
    - If recursive, the `depthColumn` is also exposed as a column.

## 4. SQL Generation Logic

The generator uses a multi-pass approach:

1. **Phase 1: Recursive CTEs**
    - Generates the `WITH RECURSIVE` boilerplate.
    - Constructs the **Anchor member** (Base selection + `depth = 0`).
    - Constructs the **Recursive member** (Join with CTE alias + `depth + 1`).
2. **Phase 2: Regular CTEs**
    - Wraps standard query states in `alias AS (...)`.
3. **Phase 3: Main Query**
    - Generates the standard `SELECT ... FROM ...` referencing CTEs as ordinary tables.

### 4.4 Flexible Join Direction (LEFT/RIGHT)

The generator is order-agnostic for joins. If the user reorders tables in the list:
1.  **Inverse Detection**: If the current table is the "left" side of a join connecting it to an already processed table, the generator detects this reversal.
2.  **Type Flipping**: `LEFT` joins are automatically flipped to `RIGHT` (and vice versa) to preserve the logical relationship.
3.  **ON Clause Adjustment**: Columns and aliases in the `ON` clause are swapped to ensure the join table is on the right side of the `=` operator.
4.  **No Cross-Joins**: This logic prevents accidental `CROSS JOIN` errors when table order is changed in the UI, as the relationship is searched in both directions.

## 7. Heuristic SQL Parser

The system includes an enhanced custom parser ([sqlParser.ts](file:///Users/Shared/Work/Web/web-node-system/frontend/src/features/query-builder/lib/sqlParser.ts)):
- **Recursion Recovery**: Detects `UNION ALL` patterns within `WITH` clauses to reconstruct `RecursiveConfig` objects.
- **Quote Resilience**: Regex patterns handle optional double quotes around all identifiers, allowing the builder to reopen complex queries.
- **IS NULL Detection**: Correctlty parses `WHERE ... IS NULL` conditions, which are critical for the anchor members of recursive CTEs.

## 12. UI Patterns for Recursion

- **Recursive Query Modal**: A guided form to configure `anchorTable`, `primaryKey`, and `parentKey`.
- **Recursion Settings Icon**: Existing query blocks in the sidebar display a settings icon for easy re-configuration of recursion parameters.
- **Condition Guards**: New recursive blocks automatically add an `IS NULL` condition to the parent reference to guide the user.

---
*Last Updated: 2026-03-22*
