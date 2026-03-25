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

- **Recursive Query Modal**: A guided form to configure `anchorTable`, `primaryKey`, and `parentKey`. Uses the `table_recursive` icon.
- **Recursion Settings Icon**: Existing query blocks in the sidebar display a settings icon for easy re-configuration of recursion parameters.
- **Table Icons (Standards)**: 
    - **Main Query Tab**: `sql`
    - **Regular Query Block (CTE) Tab**: `table_virtual`
    - **Recursive Query Block (CTE) Tab**: `table_recursive`
    - **Context Menu (Add Regular)**: `table_virtual`
    - **Context Menu (Add Recursive)**: `table_recursive`
    - **Selection Lists Headers (SELECTED TABLES/FIELDS)**: `table_chart`
    - **Selected Tables (Items)**: `table_chart`, `table_virtual`, or `table_recursive`
    - **Selected Fields (Items)**: `table_rows`
- **UI Interaction**: Standard lists (SELECTED TABLES/FIELDS) do not display separate drag indicators or checkmarks; interaction is handled via direct row manipulation and background highlighting.
- **Condition Guards**: New recursive blocks automatically add an `IS NULL` condition to the parent reference to guide the user.

## 5. Execution & Verification

### 5.1 On-the-Fly Execution (F5 / F9)
- Users can instantly verify their SQL by pressing `F5` or `F9` within the Query Builder.
- This triggers a `POST` request to the backend `/database-metadata/execute` endpoint.
- **Safety**: The execution is restricted to `SELECT` and `WITH` queries, and a `LIMIT 1000` is automatically appended.

### 5.2 Context-Aware Execution
- The system determines the "Effective SQL" based on the currently active query block:
    - **Main Query**: Executes the full `WITH ... SELECT ...` statement.
    - **Standalone CTE**: If a CTE has no dependencies on other blocks and is not recursive, it can be executed in isolation as a simple `SELECT ...` statement.
    - **Dependent CTE**: If a block depends on others, the UI restricts standalone execution and prompts the user to run the main query.

## 6. Results Display (Tabulator)

Query results are rendered in a dedicated modal using the **Tabulator** engine:
- **Professional Grid**: Supports column resizing, reordering, and cell-level selection.
- **Excel Navigation**: Full keyboard support (arrow keys) for moving the selection cursor between cells (via `Keybindings` module).
- **Data Formatting**: Automatically detects and stringifies `JSON`/`JSONB` objects for readable display via custom column formatters.
- **Export**: Includes a **"Copy Result"** action that exports the entire result set to the clipboard as a formatted JSON string.

## 13. CTE Refactoring (Renaming)

The system supports robust renaming of "Query Blocks" (CTEs) with automatic reference propagation:
- **Cascade Updates**: Renaming a block automatically updates all instances where that block is used as a source table in the Main Query or other CTEs.
- **Join & Condition Sync**: All join conditions, filter conditions (WHERE), and selected fields referencing the old alias are updated to use the new alias.
- **Dependency Tracking**: The refactoring logic ensures that recursive CTE configurations (anchor tables) are also updated if they depend on the renamed block.

## 14. UI Interaction Model (Drag-and-Drop)

The Query Builder uses a highly interactive drag-and-drop (DND) model for managing query structure:
- **Selection**: Tables can be dragged from the sidebar into the "Selected Tables" area or directly into the "Selected Fields" list (to add all columns).
- **Deletion (Visual Cue)**: To remove a field or table, the user drags it outside its designated drop zone. The item's border and icon turn **red**, providing a clear visual cue that releasing it will trigger a deletion.
- **Reordering**: Fields within the selection list can be reordered via DND to control the `SELECT` column sequence.

## 15. Conditions & Filters (WHERE Clause)

The system supports complex filtering logic through the **Filters** section of each query block:

### 15.1 WhereCondition Interface
```typescript
interface WhereCondition {
    id: string;
    tableAlias: string;   // The specific table instance (alias) the condition applies to
    columnName: string;   // The name of the column
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
    value: string;        // The value to compare against (ignored for IS NULL/IS NOT NULL)
    valueType?: 'literal' | 'parameter'; // Whether the value is a raw string or a $1 parameter
    logic: 'AND' | 'OR';  // How this condition joins with the previous one
}
```

### 15.2 Operator Support
- **Standard Comparisons**: `=`, `!=`, `>`, `<`, `>=`, `<=`
- **Pattern Matching**: `LIKE` (supports `%` and `_` wildcards)
- **Set Membership**: `IN` (expects comma-separated values in parentheses)
- **Null Safety**: `IS NULL` and `IS NOT NULL` (automatically hides the value input in the UI)

### 15.3 Recursive Anchors
The `IS NULL` operator is critical for recursive queries, as it is often used in the anchor member to identify root nodes (e.g., `WHERE parent_id IS NULL`). The parser specifically handles these to ensure they are correctly restored when reopening a query.

## 17. JSON Builder

The Query Builder includes a dedicated **JSON Builder** tab that allows converting a standard tabular report into a hierarchical JSON document via PostgreSQL JSON functions (`json_build_object`, `json_agg`).

### 17.1 UI Features
- **Visual Drag & Drop**: Users can drag columns into the "JSON Structure" tree.
- **Tree Hierarchy**:
  - **Object Node (`{}`)**: Represents `json_build_object()`.
  - **Array Node (`[]`)**: Represents `json_agg()`. Supports optional `orderByRef`.
  - **Field Node (`val`)**: Scalar database value.

### 17.2 Hierarchical SQL Generation (Topological Leveling)
To avoid "aggregate function calls cannot be nested" errors in PostgreSQL, the generator uses a multi-layered subquery approach:
1. **CTE Partitioning**: The original query state (joins, where, etc.) is isolated into a `WITH meta AS (...)` CTE.
2. **Topological Leveling**: The JSON tree is scanned to find all `Array` nodes. These are sorted into "levels" based on their dependencies.
3. **Subquery Layering**: For each level (starting from the deepest), the generator emits a `sub_N` CTE that performs `json_agg` and `GROUP BY`.
4. **Field Propagation**: Fields required by higher levels are automatically passed through lower subqueries via `GROUP BY`.

### 17.3 State Serialization (`JSON_BUILDER_STATE`)
To guarantee perfect UI reconstruction:
- **Metadata Comment**: The generator prepends a `/* JSON_BUILDER_STATE: [...] */` comment containing the serialized JSON tree.
- **Backend Transparency**: The backend router automatically strips this block comment before executing or validating the SQL.

## 18. Robust Parser (`sqlParser.ts`)
The parser implements industrial-strength tokenization to handle complex manual queries:
- **Nesting Awareness**: Uses `findTopLevelToken` to balance parentheses and ignore keywords inside subqueries or nested expressions.
- **String/Comment Safety**: Correctly identifies single-quoted strings and block comments, ensuring parenthesis balancing doesn't break on characters like `')'`.
- **Clause Isolation**: `SELECT`, `FROM`, `WHERE`, `GROUP BY`, and `ORDER BY` sections are isolated independently within each block level, preventing global regex collisions.

---
*Last Updated: 2026-03-25*
