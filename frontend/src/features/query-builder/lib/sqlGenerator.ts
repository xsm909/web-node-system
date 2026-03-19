import type { MultiQueryState, QueryState } from '../model/types';

const q = (id: string) => {
    if (!id || id === '*') return id;
    if (id.includes('"')) return id; // Already quoted or complex
    return `"${id}"`;
};

const generateBlockSQL = (state: QueryState): string => {
    if (state.tables.length === 0) return '';
    
    let sql = 'SELECT ';
    
    if (state.selectedFields.length === 0) {
        sql += '* ';
    } else {
        const fieldSqls = state.selectedFields.map(f => {
            let field = f.expression || (f.columnName === '*' ? '*' : `${q(f.tableAlias)}.${q(f.columnName || '')}`);
            if (f.alias) field += ` AS ${q(f.alias)}`;
            return field;
        });
        sql += fieldSqls.join(', ');
    }
    
    const primaryTable = state.tables[0];
    sql += `\nFROM ${q(primaryTable.tableName)} AS ${q(primaryTable.alias)}`;
    
    state.joins.forEach(join => {
        const joinTable = state.tables.find(t => t.alias === join.rightTableAlias);
        const joinTableStr = joinTable ? `${q(joinTable.tableName)} AS ${q(joinTable.alias)}` : q(join.rightTableAlias);
        sql += `\n${join.type} JOIN ${joinTableStr} ON ${q(join.leftTableAlias)}.${q(join.leftColumn)} = ${q(join.rightTableAlias)}.${q(join.rightColumn)}`;
    });
    
    if (state.where.length > 0) {
        sql += '\nWHERE ';
        state.where.forEach((cond, index) => {
            if (index > 0) sql += ` ${cond.logic} `;
            sql += `${q(cond.tableAlias)}.${q(cond.columnName)} ${cond.operator} ${cond.value}`;
        });
    }
    
    return sql;
};

export const generateSQL = (fullState: MultiQueryState): string => {
    let sql = '';
    
    if (fullState.ctes.length > 0) {
        const hasRecursive = fullState.ctes.some(c => c.isRecursive);
        sql += hasRecursive ? 'WITH RECURSIVE ' : 'WITH ';
        sql += fullState.ctes.map(cte => {
            if (cte.isRecursive && cte.recursiveConfig) {
                const { anchorTable, primaryKey, parentKey, depthColumn } = cte.recursiveConfig;
                
                // Fields for anchor and recursive parts must match
                const fieldList = cte.state.selectedFields.map(f => {
                    const base = f.expression || f.columnName || '';
                    const resAlias = f.alias;
                    return { base, alias: resAlias };
                });

                let anchorFields = fieldList.map(f => {
                    let s = f.base === '*' ? '*' : q(f.base);
                    if (f.alias) s += ` AS ${q(f.alias)}`;
                    return s;
                }).join(', ') || '*';

                let recursiveFields = fieldList.map(f => {
                    if (f.base === '*') return `r.*`;
                    // Try to prefix with 'r.' if it looks like a simple column (starts with letter/underscore)
                    const isSimpleCol = /^[a-zA-Z_][\w]*$/.test(f.base);
                    return isSimpleCol ? `r.${q(f.base)}` : f.base;
                }).join(', ') || 'r.*';
                
                if (depthColumn) {
                    anchorFields += `, 0 AS ${q(depthColumn)}`;
                    recursiveFields += `, t.${q(depthColumn)} + 1`;
                }

                return `${q(cte.alias)} AS (
    -- Anchor member
    SELECT ${anchorFields}
    FROM ${q(anchorTable)}
    WHERE ${q(parentKey)} IS NULL

    UNION ALL

    -- Recursive member
    SELECT ${recursiveFields}
    FROM ${q(anchorTable)} AS r
    JOIN ${q(cte.alias)} AS t ON r.${q(parentKey)} = t.${q(primaryKey)}
)`;
            }
            return `${q(cte.alias)} AS (\n${generateBlockSQL(cte.state)}\n)`;
        }).join(',\n');
        sql += '\n';
    }
    
    sql += generateBlockSQL(fullState.mainQuery);
    
    return sql;
};
