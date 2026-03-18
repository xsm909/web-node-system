import type { MultiQueryState, QueryState } from '../model/types';

const generateBlockSQL = (state: QueryState): string => {
    if (state.tables.length === 0) return '';
    
    let sql = 'SELECT ';
    
    if (state.selectedFields.length === 0) {
        sql += '* ';
    } else {
        sql += state.selectedFields.map(f => {
            let field = `${f.tableAlias}.${f.columnName}`;
            if (f.alias) field += ` AS ${f.alias}`;
            return field;
        }).join(', ');
    }
    
    const primaryTable = state.tables[0];
    sql += `\nFROM ${primaryTable.tableName} AS ${primaryTable.alias}`;
    
    state.joins.forEach(join => {
        const joinTable = state.tables.find(t => t.alias === join.rightTableAlias);
        const joinTableStr = joinTable ? `${joinTable.tableName} AS ${joinTable.alias}` : join.rightTableAlias;
        sql += `\n${join.type} JOIN ${joinTableStr} ON ${join.leftTableAlias}.${join.leftColumn} = ${join.rightTableAlias}.${join.rightColumn}`;
    });
    
    if (state.where.length > 0) {
        sql += '\nWHERE ';
        state.where.forEach((cond, index) => {
            if (index > 0) sql += ` ${cond.logic} `;
            sql += `${cond.tableAlias}.${cond.columnName} ${cond.operator} ${cond.value}`;
        });
    }
    
    return sql;
};

export const generateSQL = (fullState: MultiQueryState): string => {
    let sql = '';
    
    if (fullState.ctes.length > 0) {
        sql += 'WITH ';
        sql += fullState.ctes.map(cte => {
            return `${cte.alias} AS (\n${generateBlockSQL(cte.state)}\n)`;
        }).join(',\n');
        sql += '\n';
    }
    
    sql += generateBlockSQL(fullState.mainQuery);
    
    return sql;
};
