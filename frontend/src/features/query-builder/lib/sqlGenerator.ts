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

    const processedAliases = new Set<string>([primaryTable.alias]);
    
    // Follow the order of tables for JOINS
    for (let i = 1; i < state.tables.length; i++) {
        const table = state.tables[i];
        
        // Find a join connecting this table to any previously processed table
        let join = state.joins.find(j => 
            j.rightTableAlias === table.alias && processedAliases.has(j.leftTableAlias)
        );
        let directionFlipped = false;

        if (!join) {
            // Try the other direction
            join = state.joins.find(j => 
                j.leftTableAlias === table.alias && processedAliases.has(j.rightTableAlias)
            );
            if (join) directionFlipped = true;
        }

        if (join) {
            let joinType = join.type;
            let leftAlias = join.leftTableAlias;
            let leftCol = join.leftColumn;
            let rightAlias = join.rightTableAlias;
            let rightCol = join.rightColumn;

            if (directionFlipped) {
                // Flip join type if needed
                if (joinType === 'LEFT') joinType = 'RIGHT';
                else if (joinType === 'RIGHT') joinType = 'LEFT';
                
                // Swap columns and aliases for the ON clause to match the flipped direction
                // However, in "A JOIN B ON cond", B is the table being joined.
                // If we have join(A, B) and we are joining A to processed B:
                // SQL: ... FROM B [FLIPPED JOIN] A ON A.col = B.col
                leftAlias = join.rightTableAlias;
                leftCol = join.rightColumn;
                rightAlias = join.leftTableAlias;
                rightCol = join.leftColumn;
            }

            sql += `\n${joinType} JOIN ${q(table.tableName)} AS ${q(table.alias)} ON ${q(leftAlias)}.${q(leftCol)} = ${q(rightAlias)}.${q(rightCol)}`;
        } else {
            // If no join defined, fallback to CROSS JOIN to keep the table in the sequence
            sql += `\nCROSS JOIN ${q(table.tableName)} AS ${q(table.alias)}`;
        }
        
        processedAliases.add(table.alias);
    }
    
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
