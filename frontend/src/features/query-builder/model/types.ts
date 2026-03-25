export interface DbColumn {
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
    primary_key: boolean;
}

export interface DbForeignKey {
    name: string | null;
    constrained_columns: string[];
    referred_table: string;
    referred_columns: string[];
}

export interface DbFunction {
    category: string;
    name: string;
    args: string;
}

export interface SelectedField {
    id: string;
    tableAlias: string;
    columnName?: string;
    columnType?: string;
    expression?: string;
    alias?: string;
}

export interface JoinCondition {
    id: string;
    leftTableAlias: string;
    leftColumn: string;
    rightTableAlias: string;
    rightColumn: string;
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

export interface WhereCondition {
    id: string;
    tableAlias: string;
    columnName: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
    value: string;
    valueType?: 'literal' | 'parameter';
    logic: 'AND' | 'OR';
}

export interface GroupBy {
    id: string;
    tableAlias: string;
    columnName: string;
}

export interface OrderBy {
    id: string;
    tableAlias: string;
    columnName: string;
    direction: 'ASC' | 'DESC';
}

export interface QueryTable {
    alias: string;
    tableName: string;
    isCte?: boolean;
    isRecursive?: boolean;
}

export interface QueryState {
    tables: QueryTable[];
    selectedFields: SelectedField[];
    joins: JoinCondition[];
    where: WhereCondition[];
    groupBy: GroupBy[];
    orderBy: OrderBy[];
    limit?: number;
    useLimit?: boolean;
}

export interface RecursiveCteConfig {
    anchorTable: string;
    primaryKey: string;
    parentKey: string;
    depthColumn?: string;
}

export interface QueryCTE {
    id: string;
    alias: string;
    state: QueryState;
    isRecursive?: boolean;
    recursiveConfig?: RecursiveCteConfig;
}

// ── JSON Builder ──────────────────────────────────────────────────────────────

/** Discriminator for JSON tree node kinds */
export type JsonNodeType = 'object' | 'array' | 'field';

/**
 * A node in the visual JSON-builder tree.
 *
 * - `field`  → leaf: maps to a column/alias from the SELECT list
 * - `object` → `json_build_object(key, expr, …)`
 * - `array`  → `json_agg(json_build_object(…))` — children are field / object nodes
 */
export interface JsonTreeNode {
    id: string;
    key: string;               // JSON key used in json_build_object
    type: JsonNodeType;
    fieldRef?: string;         // alias or "table.column" for leaf nodes
    orderByRef?: string;       // optional ORDER BY column for array aggregation
    children?: JsonTreeNode[]; // object / array containers
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MultiQueryState {
    ctes: QueryCTE[];
    mainQuery: QueryState;
    /** When non-empty, the report uses JSON-mode SQL instead of tabular SQL. */
    jsonTree?: JsonTreeNode[];
}
