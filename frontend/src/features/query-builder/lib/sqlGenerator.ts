import type { MultiQueryState, QueryState, QueryCTE } from '../model/types';

const q = (id: string, tableAlias?: string): string => {
    if (!id || id === '*') return id;
    
    // Strip table prefix if it's redundant (e.g. users.users.id -> id)
    let cleanId = id;
    if (tableAlias) {
        const prefix = tableAlias + '.';
        while (cleanId.startsWith(prefix)) {
            cleanId = cleanId.substring(prefix.length);
        }
    }
    
    if (cleanId.includes('"')) return cleanId; // Already quoted or complex
    
    // Handle PostgreSQL type casts (::type)
    if (cleanId.includes('::')) {
        const [identifier, ...rest] = cleanId.split('::');
        return `${q(identifier, tableAlias)}::${rest.join('::')}`;
    }

    return `"${cleanId}"`;
};

export const generateBlockSQL = (state: QueryState): string => {
    if (state.tables.length === 0) return '';
    
    let sql = 'SELECT ';
    
    if (state.selectedFields.length === 0) {
        sql += '* ';
    } else {
        const usedAliases = new Set<string>();
        // First pass: register explicit aliases
        state.selectedFields.forEach(f => {
            if (f.alias) usedAliases.add(f.alias);
        });

        const fieldSqls = state.selectedFields.map(f => {
            const columnName = f.columnName || '';
            const tableAlias = f.tableAlias || '';
            
            let field = f.expression || (columnName === '*' ? '*' : `${q(tableAlias)}.${q(columnName, tableAlias)}`);
            let alias = f.alias;
            
            // Automatic aliasing to prevent collisions (e.g. two "id" columns)
            if (!alias && columnName !== '*') {
                const baseName = columnName.split('::')[0]; // Strip cast for alias base
                if (usedAliases.has(baseName)) {
                    alias = `${tableAlias}_${baseName}`;
                }
                usedAliases.add(alias || baseName);
            }

            if (alias) field += ` AS ${q(alias)}`;
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

            sql += `\n${joinType} JOIN ${q(table.tableName)} AS ${q(table.alias)} ON ${q(leftAlias)}.${q(leftCol, leftAlias)} = ${q(rightAlias)}.${q(rightCol, rightAlias)}`;
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
            let value = cond.value;
            if (cond.valueType === 'parameter') {
                value = `:${cond.value}`;
            } else if (cond.operator !== 'IS NULL' && cond.operator !== 'IS NOT NULL') {
                // If it's a literal, quote it if it's not a number and not already quoted
                const isNumeric = !isNaN(Number(cond.value)) && cond.value.trim() !== '';
                const isQuoted = (cond.value.startsWith("'") && cond.value.endsWith("'")) || 
                               (cond.value.startsWith('"') && cond.value.endsWith('"'));
                
                if (!isNumeric && !isQuoted && cond.value.toLowerCase() !== 'null') {
                    value = `'${cond.value.replace(/'/g, "''")}'`;
                }
            }
            sql += `${q(cond.tableAlias)}.${q(cond.columnName, cond.tableAlias)} ${cond.operator} ${value}`;
        });
    }
    
    return sql;
};

const sortCtesByDependency = (ctes: QueryCTE[]): QueryCTE[] => {
    const sorted: QueryCTE[] = [];
    const visited = new Set<string>();
    const processing = new Set<string>();

    const visit = (cte: QueryCTE) => {
        if (visited.has(cte.id)) return;
        if (processing.has(cte.id)) {
            // Circular dependency detected. SQL doesn't support this without RECURSIVE
            // and even then it's complex. We'll just stop here to prevent infinite loop.
            return;
        }

        processing.add(cte.id);

        // A CTE A depends on B if any table in A's state or its anchorTable (if recursive)
        // refers to B's alias.
        const ctasAliases = new Set(ctes.map(c => c.alias));
        
        const dependentAliases = new Set<string>();
        cte.state.tables.forEach((t: any) => {
            if (ctasAliases.has(t.tableName) && t.tableName !== cte.alias) {
                dependentAliases.add(t.tableName);
            }
        });
        
        if (cte.isRecursive && cte.recursiveConfig) {
            if (ctasAliases.has(cte.recursiveConfig.anchorTable) && cte.recursiveConfig.anchorTable !== cte.alias) {
                dependentAliases.add(cte.recursiveConfig.anchorTable);
            }
        }

        dependentAliases.forEach(alias => {
            const depCte = ctes.find(c => c.alias === alias);
            if (depCte) visit(depCte);
        });

        processing.delete(cte.id);
        visited.add(cte.id);
        sorted.push(cte);
    };

    ctes.forEach(visit);
    return sorted;
};

export const generateSQL = (fullState: MultiQueryState): string => {
    let sql = '';
    
    if (fullState.ctes.length > 0) {
        const sortedCtes = sortCtesByDependency(fullState.ctes);
        const hasRecursive = sortedCtes.some(c => c.isRecursive);
        sql += hasRecursive ? 'WITH RECURSIVE ' : 'WITH ';
        sql += sortedCtes.map(cte => {
            if (cte.isRecursive && cte.recursiveConfig) {
                const { anchorTable, primaryKey, parentKey, depthColumn } = cte.recursiveConfig;
                
                // Fields for anchor and recursive parts must match
                const fieldList = cte.state.selectedFields.map((f: any) => {
                    const base = f.expression || f.columnName || '';
                    const resAlias = f.alias;
                    return { base, alias: resAlias };
                });

                let anchorFields = fieldList.map((f: any) => {
                    let s = f.base === '*' ? '*' : q(f.base);
                    if (f.alias) s += ` AS ${q(f.alias)}`;
                    return s;
                }).join(', ') || '*';

                let recursiveFields = fieldList.map((f: any) => {
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
