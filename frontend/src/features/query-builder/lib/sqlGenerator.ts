import type { MultiQueryState, QueryState, QueryCTE, JsonTreeNode } from '../model/types';

const q = (id: string, tableAlias?: string): string => {
    if (!id || id === '*') return id;
    
    // Strip table prefix if it's redundant (e.g. users.users.id -> id)
    let cleanId = id;
    if (tableAlias) {
        const prefix = tableAlias + '.';
        if (cleanId.startsWith(prefix)) {
            cleanId = cleanId.substring(prefix.length);
        }
    }
    
    if (cleanId.includes('"')) return cleanId; // Already quoted or complex
    
    // Handle PostgreSQL type casts (::type)
    if (cleanId.includes('::')) {
        const [identifier, ...rest] = cleanId.split('::');
        return `${q(identifier, tableAlias)}::${rest.join('::')}`;
    }

    const quotedId = `"${cleanId}"`;
    if (tableAlias) {
        return `${q(tableAlias)}.${quotedId}`;
    }
    return quotedId;
};

export const generateBlockSQL = (state: QueryState, options?: { isForPreview?: boolean }): string => {
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
            
            let field = f.expression || (columnName === '*' ? '*' : q(columnName, tableAlias));
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

            sql += `\n${joinType} JOIN ${q(table.tableName)} AS ${q(table.alias)} ON ${q(leftCol, leftAlias)} = ${q(rightCol, rightAlias)}`;
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
            let sqlCond = `${q(cond.columnName, cond.tableAlias)} ${cond.operator}`;
            if (cond.operator !== 'IS NULL' && cond.operator !== 'IS NOT NULL') {
                sqlCond += ` ${value}`;
            }
            sql += sqlCond;
        });
    }

    if (state.groupBy && state.groupBy.length > 0) {
        sql += '\nGROUP BY ';
        sql += state.groupBy.map(g => q(g.columnName, g.tableAlias)).join(', ');
    }

    if (state.orderBy && state.orderBy.length > 0) {
        sql += '\nORDER BY ';
        sql += state.orderBy.map(o => `${q(o.columnName, o.tableAlias)} ${o.direction}`).join(', ');
    }

    // 6. LIMIT clause with preview constraint
    let effectiveLimit = state.useLimit ? state.limit : undefined;
    
    if (options?.isForPreview) {
        const previewMax = 1000;
        effectiveLimit = effectiveLimit !== undefined 
            ? Math.min(effectiveLimit, previewMax) 
            : previewMax;
    }

    if (effectiveLimit !== undefined) {
        sql += `\nLIMIT ${effectiveLimit}`;
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

export const generateSQL = (state: MultiQueryState, options?: { isForPreview?: boolean }): string => {
    let sql = '';
    
    if (state.ctes.length > 0) {
        const sortedCtes = sortCtesByDependency(state.ctes);
        const hasRecursive = sortedCtes.some(c => c.isRecursive);
        sql += hasRecursive ? 'WITH RECURSIVE ' : 'WITH ';
        const cteStrings = sortedCtes.map(cte => {
            if (cte.isRecursive && cte.recursiveConfig) {
                const { anchorTable, primaryKey, parentKey, depthColumn } = cte.recursiveConfig;
                
                // Fields for anchor and recursive parts must match
                const fieldList = cte.state.selectedFields.map((f: any) => {
                    const base = f.expression || f.columnName || '';
                    const resAlias = f.alias;
                    const tableAlias = f.tableAlias || '';
                    return { base, alias: resAlias, tableAlias };
                });

                let recursiveFields = fieldList.map((f: any) => {
                    if (f.base === '*') return `r.*`;
                    
                    // If it's from the anchor table, use 'r.' prefix
                    if (!f.tableAlias || f.tableAlias === anchorTable) {
                        const isSimpleCol = /^[a-zA-Z_][\w]*$/.test(f.base);
                        return isSimpleCol ? `r.${q(f.base)}` : f.base;
                    }
                    
                    // If it's from another table (joined in anchor member), it must be carried over from 't'
                    return `t.${q(f.alias || f.base)}`;
                }).join(', ') || 'r.*';

                let anchorSql = generateBlockSQL(cte.state, options);
                if (depthColumn) {
                    // Inject depth column into the anchor member's SELECT
                    anchorSql = anchorSql.replace(/SELECT\s+/i, `SELECT 0 AS ${q(depthColumn)}, `);
                    recursiveFields = `t.${q(depthColumn)} + 1, ${recursiveFields}`;
                }

                return `${q(cte.alias)} AS (
    -- Anchor member
    ${anchorSql}

    UNION ALL

    -- Recursive member
    SELECT ${recursiveFields}
    FROM ${q(anchorTable)} AS r
    JOIN ${q(cte.alias)} AS t ON ${q(parentKey, 'r')} = ${q(primaryKey, 't')}
)`;
            }
            return `${q(cte.alias)} AS (\n${generateBlockSQL(cte.state, options)}\n)`;
        });
        
        sql += cteStrings.join(',\n');
        sql += '\n';
    }
    
    const mainSql = generateBlockSQL(state.mainQuery, options);
    if (!mainSql && sql) {
        // If we have CTEs but no main query, the SQL would be invalid.
        // We add a default SELECT from the last CTE to make it valid for preview/save.
        const lastCte = state.ctes[state.ctes.length - 1];
        sql += `\nSELECT * FROM ${q(lastCte.alias)}`;
    } else {
        sql += mainSql;
    }
    
    return sql;
};

// ── JSON Builder SQL Generation ───────────────────────────────────────────────

function getAllFieldRefs(nodes: import('../model/types').JsonTreeNode[]): string[] {
    const refs = new Set<string>();
    for (const node of nodes) {
        if (node.type === 'field') {
            refs.add((node.fieldRef || node.key).replace(/"/g, ''));
        } else if (node.children) {
            getAllFieldRefs(node.children).forEach(r => refs.add(r));
        }
    }
    return Array.from(refs);
}

function getArrayDirectFields(arrayNode: import('../model/types').JsonTreeNode): string[] {
    const refs = new Set<string>();
    if (!arrayNode.children) return [];
    for (const child of arrayNode.children) {
        if (child.type === 'field') {
            refs.add((child.fieldRef || child.key).replace(/"/g, ''));
        } else if (child.type === 'object' && child.children) {
            getArrayDirectFields(child).forEach(r => refs.add(r)); 
        }
    }
    return Array.from(refs);
}

function collectArrays(nodes: import('../model/types').JsonTreeNode[], out: import('../model/types').JsonTreeNode[] = []): import('../model/types').JsonTreeNode[] {
    for (const node of nodes) {
        if (node.children) collectArrays(node.children, out);
        if (node.type === 'array') out.push(node);
    }
    return out;
}

function getDirectChildArrayIds(nodes: import('../model/types').JsonTreeNode[]): string[] {
    const ids: string[] = [];
    for (const node of nodes) {
        if (node.type === 'array') {
            ids.push(node.id);
        } else if (node.type === 'object' && node.children) {
            ids.push(...getDirectChildArrayIds(node.children));
        }
    }
    return ids;
}

function formatNodeAccess(node: import('../model/types').JsonTreeNode, indent: number, arrayAliases: Record<string, string>): string {
    const innerPad = ' '.repeat(indent * 4);
    if (node.type === 'field') {
        return `"${(node.fieldRef || node.key).replace(/"/g, '')}"`;
    }
    if (node.type === 'object') {
        if (!node.children || node.children.length === 0) return 'NULL';
        const pairs = node.children.map(child =>
            `${innerPad}'${child.key}', ${formatNodeAccess(child, indent + 1, arrayAliases)}`
        ).join(',\n');
        return `json_build_object(\n${pairs}\n${' '.repeat((indent - 1) * 4)})`;
    }
    if (node.type === 'array') {
        const alias = arrayAliases[node.id];
        return `"${alias}"`;
    }
    return 'NULL';
}

function groupArraysByLevel(arrays: import('../model/types').JsonTreeNode[]): import('../model/types').JsonTreeNode[][] {
    const levels: import('../model/types').JsonTreeNode[][] = [];
    const processedIds = new Set<string>();
    
    let remaining = [...arrays];
    while (remaining.length > 0) {
        const currentLevel = remaining.filter(arr => {
            const childIds = getDirectChildArrayIds(arr.children || []);
            return childIds.every(id => processedIds.has(id));
        });
        
        if (currentLevel.length === 0) {
            levels.push(remaining);
            break;
        }
        
        levels.push(currentLevel);
        currentLevel.forEach(arr => processedIds.add(arr.id));
        remaining = remaining.filter(arr => !processedIds.has(arr.id));
    }
    
    return levels;
}

export const generateJsonSQL = (state: import('../model/types').MultiQueryState, options?: { isForPreview?: boolean }): string => {
    const tree = state.jsonTree;
    if (!tree || tree.length === 0) return generateSQL(state, options);

    const stateComment = `/* JSON_BUILDER_STATE: ${JSON.stringify(tree)} */\n`;

    const baseState = { 
        ...state, 
        jsonTree: [],
        ctes: state.ctes.filter(c => {
            const l = c.alias.toLowerCase();
            return l !== 'meta' && !l.startsWith('sub_');
        })
    };
    const innerSql = generateSQL(baseState, options);
    
    let fullSql = `${stateComment}WITH meta AS (\n${innerSql.split('\n').map(l => '    ' + l).join('\n')}\n)\n`;

    const arraysList = collectArrays(tree);
    const arrayLevels = groupArraysByLevel(arraysList);
    const arrayAliases: Record<string, string> = {};
    
    let currentFields = new Set(getAllFieldRefs(tree));
    let currentAggs = new Set<string>();
    const subqueries: string[] = [];
    let prevTable = 'meta';

    for (let i = 0; i < arrayLevels.length; i++) {
        const levelArrays = arrayLevels[i];
        
        levelArrays.forEach((arr, idx) => {
            arrayAliases[arr.id] = `arr_${i}_${idx}`;
        });

        const levelDirectFields = new Set<string>();
        const levelChildAggAliases = new Set<string>();
        
        levelArrays.forEach(arr => {
            getArrayDirectFields(arr).forEach(f => levelDirectFields.add(f));
            getDirectChildArrayIds(arr.children || []).forEach(id => {
                if (arrayAliases[id]) levelChildAggAliases.add(arrayAliases[id]);
            });
        });

        levelDirectFields.forEach(f => currentFields.delete(f));
        currentAggs.forEach(a => { if (levelChildAggAliases.has(a)) currentAggs.delete(a); });

        const groupByCols = [...Array.from(currentFields), ...Array.from(currentAggs)].map(c => `"${c}"`);
        const selectCols = [...groupByCols];
        
        levelArrays.forEach(arr => {
            const innerPairs = (arr.children || []).map(child =>
                `                '${child.key}', ${formatNodeAccess(child, 4, arrayAliases)}`
            ).join(',\n');
            
            const orderBy = arr.orderByRef ? ` ORDER BY "${arr.orderByRef.replace(/"/g, '')}"` : '';
            const aggAlias = arrayAliases[arr.id];
            const aggExpr = `json_agg(\n            json_build_object(\n${innerPairs}\n            )${orderBy}\n        ) AS "${aggAlias}"`;
            selectCols.push(aggExpr);
        });

        const groupByClause = groupByCols.length > 0 ? `\n    GROUP BY ${groupByCols.join(', ')}` : '';
        
        const subSql = `    SELECT \n        ${selectCols.join(',\n        ')}\n    FROM ${prevTable}${groupByClause}`;
        
        subqueries.push(`sub_${i} AS (\n${subSql}\n)`);
        prevTable = `sub_${i}`;
        
        levelArrays.forEach(arr => currentAggs.add(arrayAliases[arr.id]));
    }
    
    if (subqueries.length > 0) {
        const subList = subqueries.join(',\n');
        fullSql = fullSql.replace(/\)\n$/, `),\n${subList}\n\n`);
    } else {
        fullSql += '\n';
    }

    const topPairs = tree.map(node =>
        `    '${node.key}', ${formatNodeAccess(node, 1, arrayAliases)}`
    ).join(',\n');
    
    fullSql += `SELECT json_build_object(\n${topPairs}\n) AS result\nFROM ${prevTable}`;
    
    return fullSql;
};
