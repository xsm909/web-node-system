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
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN';
    value: string;
    logic: 'AND' | 'OR';
}

export interface QueryTable {
    alias: string;
    tableName: string;
    isCte?: boolean;
}

export interface QueryState {
    tables: QueryTable[];
    selectedFields: SelectedField[];
    joins: JoinCondition[];
    where: WhereCondition[];
}

export interface QueryCTE {
    id: string;
    alias: string;
    state: QueryState;
}

export interface MultiQueryState {
    ctes: QueryCTE[];
    mainQuery: QueryState;
}
