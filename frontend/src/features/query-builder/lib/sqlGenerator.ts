import type { QueryState, QueryCTE } from '../model/types';

const q = (id: string, tableAlias?: string): string => {
    if (!id || id === '*') return id;
    
    // Handle dotted identifiers (e.g. "public.table" or "table.column")
    if (id.includes('.') && !id.includes('"')) {
        const parts = id.split('.');
        return parts.map(p => q(p)).join('.');
    }

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

    // LIMIT clause with preview constraint
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
        if (processing.has(cte.id)) return;

        processing.add(cte.id);

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

export const generateSQL = (state: import('../model/types').MultiQueryState, options?: { isForPreview?: boolean }): string => {
    let sql = '';
    
    if (state.ctes.length > 0) {
        const sortedCtes = sortCtesByDependency(state.ctes);
        const hasRecursive = sortedCtes.some(c => c.isRecursive);
        sql += hasRecursive ? 'WITH RECURSIVE ' : 'WITH ';
        const cteStrings = sortedCtes.map(cte => {
            if (cte.isRecursive && cte.recursiveConfig) {
                const { anchorTable, primaryKey, parentKey, depthColumn } = cte.recursiveConfig;
                
                const fieldList = cte.state.selectedFields.map((f: any) => {
                    const base = f.expression || f.columnName || '';
                    const resAlias = f.alias;
                    const tableAlias = f.tableAlias || '';
                    return { base, alias: resAlias, tableAlias };
                });

                let recursiveFields = fieldList.map((f: any) => {
                    if (f.base === '*') return `r.*`;
                    if (!f.tableAlias || f.tableAlias === anchorTable) {
                        const isSimpleCol = /^[a-zA-Z_][\w]*$/.test(f.base);
                        return isSimpleCol ? `r.${q(f.base)}` : f.base;
                    }
                    return `t.${q(f.alias || f.base)}`;
                }).join(', ') || 'r.*';

                let anchorSql = generateBlockSQL(cte.state, options);
                if (depthColumn) {
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
            refs.add((node.fieldRef || node.key).replace(/"/g, '').split('.').pop()!);
        }
        if (node.orderByRef) {
            refs.add(node.orderByRef.replace(/"/g, '').split('.').pop()!);
        }
        if (node.children) {
            getAllFieldRefs(node.children).forEach(r => refs.add(r));
        }
    }
    return Array.from(refs);
}

function collectArrays(nodes: import('../model/types').JsonTreeNode[], out: import('../model/types').JsonTreeNode[] = []): import('../model/types').JsonTreeNode[] {
    for (const node of nodes) {
        if (node.type === 'array') out.push(node);
        if (node.children) collectArrays(node.children, out);
    }
    return out;
}

function getFieldsUsedOutside(allNodes: import('../model/types').JsonTreeNode[], targetArrays: import('../model/types').JsonTreeNode[]): Set<string> {
    const targetIds = new Set(targetArrays.map(a => a.id));
    const outsideFields = new Set<string>();
    
    const walk = (ns: import('../model/types').JsonTreeNode[], isInsideTarget: boolean) => {
        for (const n of ns) {
            const nextInside = isInsideTarget || targetIds.has(n.id);
            if (!nextInside && n.type === 'field') {
                const baseName = (n.fieldRef || n.key).replace(/"/g, '').split('.').pop()!;
                outsideFields.add(baseName);
            }
            if (!nextInside && n.orderByRef) {
                const baseName = n.orderByRef.replace(/"/g, '').split('.').pop()!;
                outsideFields.add(baseName);
            }
            if (n.children) walk(n.children, nextInside);
        }
    };
    
    walk(allNodes, false);
    return outsideFields;
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
        const baseName = (node.fieldRef || node.key).replace(/"/g, '').split('.').pop()!;
        return q(baseName);
    }
    if (node.type === 'object') {
        if (!node.children || node.children.length === 0) return 'NULL';
        const pairs = node.children.map(child =>
            `${innerPad}'${child.key || (child.type === 'field' ? child.fieldRef?.split('.').pop() : 'obj')}', ${formatNodeAccess(child, indent + 1, arrayAliases)}`
        ).join(',\n');
        return `jsonb_build_object(\n${pairs}\n${' '.repeat((indent - 1) * 4)})`;
    }
    if (node.type === 'array') {
        const alias = arrayAliases[node.id];
        return q(alias);
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
            return l !== 'meta' && l !== '__base_query' && !l.startsWith('sub_');
        })
    };
    
    const sortedCtes = sortCtesByDependency(baseState.ctes);
    const hasRecursive = sortedCtes.some(c => c.isRecursive);
    const cteParts: string[] = sortedCtes.map(cte => 
        `${q(cte.alias)} AS (\n${generateBlockSQL(cte.state).split('\n').map(l => '    ' + l).join('\n')}\n)`
    );

    // Initial columns from base query for grouping context
    let currentTableColumns = new Set(getAllFieldRefs(tree));

    const mainBlockInnerSql = generateBlockSQL(baseState.mainQuery, options);
    cteParts.push(`__base_query AS (\n${mainBlockInnerSql.split('\n').map(l => '    ' + l).join('\n')}\n)`);

    const arrayCtes: { alias: string, sql: string }[] = [];
    const arraysList = collectArrays(tree);
    const arrayLevels = groupArraysByLevel(arraysList);
    const arrayAliases: Record<string, string> = {};
    let prevTable = '__base_query';

    for (let i = 0; i < arrayLevels.length; i++) {
        const levelArrays = arrayLevels[i];
        const subAlias = `sub_${i}`;
        
        levelArrays.forEach((arr, idx) => {
            arrayAliases[arr.id] = `arr_${i}_${idx}`;
        });

        const aggAliasesAtThisLevel = new Set(levelArrays.map(a => arrayAliases[a.id]));
        const fieldsUsedHigher = getFieldsUsedOutside(tree, levelArrays);
        
        const carryOverCols = Array.from(currentTableColumns).filter(c => {
            if (aggAliasesAtThisLevel.has(c)) return false;
            
            // Carry over any previous aggregation results that are referenced higher up.
            const isPrevAgg = c.startsWith('arr_');
            if (isPrevAgg) return true; 

            return fieldsUsedHigher.has(c);
        });

        const selectCols = carryOverCols.map(c => `to_jsonb(${q(c)}) AS ${q(c)}`);
        
        levelArrays.forEach(arr => {
            const innerPairs = (arr.children || []).map(child =>
                `                '${child.key || (child.type === 'field' ? (child.fieldRef || child.key).split('.').pop() : 'obj')}', ${formatNodeAccess(child, 4, arrayAliases)}`
            ).join(',\n');
            
            const orderBy = arr.orderByRef ? ` ORDER BY ${q(arr.orderByRef.split('.').pop()!)}` : '';
            const aggAlias = arrayAliases[arr.id];
            const aggExpr = `jsonb_agg(\n            jsonb_build_object(\n${innerPairs}\n            )${orderBy}\n        ) AS ${q(aggAlias)}`;
            selectCols.push(aggExpr);
        });

        const groupByClause = carryOverCols.length > 0 ? `\n    GROUP BY ${carryOverCols.map((_, idx) => idx + 1).join(', ')}` : '';
        const subSql = `    SELECT \n        ${selectCols.join(',\n        ')}\n    FROM ${prevTable}${groupByClause}`;
        
        arrayCtes.push({ alias: subAlias, sql: subSql });
        currentTableColumns = new Set([...carryOverCols, ...Array.from(aggAliasesAtThisLevel)]);
        prevTable = subAlias;
    }

    // 5. Build final SELECT
    const finalCols = tree.map(node => {
        const key = node.key || (node.type === 'field' ? (node.fieldRef || node.key).split('.').pop()! : 'obj');
        return `${formatNodeAccess(node, 1, arrayAliases)} AS ${q(key)}`;
    });
    const bodySql = `SELECT ${finalCols.join(', ')}\nFROM ${prevTable}`;

    let fullSql = stateComment;
    fullSql += hasRecursive ? 'WITH RECURSIVE ' : 'WITH ';
    fullSql += cteParts.join(',\n');
    if (arrayCtes.length > 0) {
        fullSql += ',\n' + arrayCtes.map(c => `${c.alias} AS (\n${c.sql}\n)`).join(',\n');
    }
    fullSql += `\n\n${bodySql}`;

    return fullSql;
};
