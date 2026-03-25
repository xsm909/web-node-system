import type { MultiQueryState, QueryState } from '../model/types';
const stripQ = (s: string) => s ? s.replace(/"/g, '') : '';

const splitIdentifier = (s: string): { table?: string, column: string } => {
    // This handles: "table"."column", table.column, "column", column
    // It also handles complex cases like "users.users.users.id" by taking the last part as column
    const parts = s.split('.').map(stripQ);
    if (parts.length > 1) {
        return { 
            table: parts[parts.length - 2], 
            column: parts[parts.length - 1] 
        };
    }
    return { column: parts[0] };
};


function tokenizeJsonArgs(funcBody: string) {
    const args: string[] = [];
    let current = '';
    let p = 0;
    let inStr = false;
    for (let i = 0; i < funcBody.length; i++) {
        const c = funcBody[i];
        if (c === "'" && (i === 0 || funcBody[i-1] !== '\\')) inStr = !inStr;
        if (!inStr) {
            if (c === '(') p++;
            if (c === ')') p--;
            if (c === ',' && p === 0) {
                args.push(current.trim());
                current = '';
                continue;
            }
        }
        current += c;
    }
    if (current.trim()) args.push(current.trim());
    return args;
}

function parseJsonAST(expr: string): import('../model/types').JsonTreeNode | import('../model/types').JsonTreeNode[] {
    expr = expr.trim();
    if (expr.toLowerCase().startsWith('json_build_object')) {
        const inner = expr.substring(expr.indexOf('(') + 1, expr.lastIndexOf(')'));
        const args = tokenizeJsonArgs(inner);
        const children: import('../model/types').JsonTreeNode[] = [];
        for (let i = 0; i < args.length; i += 2) {
            const keyStr = args[i]; 
            const valExpr = args[i + 1] || 'NULL';
            const keyMatch = keyStr.match(/^'(.*)'$/);
            const key = keyMatch ? keyMatch[1] : keyStr;
            
            const parsed = parseJsonAST(valExpr);
            let childNode: import('../model/types').JsonTreeNode;
            if (Array.isArray(parsed)) {
                childNode = {
                    id: 'node_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
                    key: key,
                    type: 'object',
                    children: parsed
                };
            } else {
                childNode = parsed;
                childNode.key = key;
            }
            if (!childNode.id) childNode.id = 'node_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            children.push(childNode);
        }
        return children;
    }
    
    if (expr.toLowerCase().startsWith('json_agg')) {
        const inner = expr.substring(expr.indexOf('(') + 1, expr.lastIndexOf(')'));
        let orderByRef: string | undefined;
        let aggBody = inner;
        const obMatch = inner.match(/\s+ORDER\s+BY\s+"?([^"\s]+)"?/i);
        if (obMatch) {
            orderByRef = obMatch[1];
            aggBody = inner.substring(0, obMatch.index).trim();
        }
        
        const parsed = parseJsonAST(aggBody);
        let children: import('../model/types').JsonTreeNode[] = [];
        if (Array.isArray(parsed)) children = parsed;
        else children = [parsed]; // fallback
        
        return {
            id: '',
            key: '',
            type: 'array',
            children: children,
            orderByRef
        };
    }
    
    // field
    return {
        id: '',
        key: '',
        type: 'field',
        fieldRef: expr.replace(/"/g, '')
    };
}

export function extractJsonTreeAST(fullSql: string): import('../model/types').JsonTreeNode[] | undefined {
    try {
        const aliasMap: Record<string, string> = {};
        
        const extractAggAliases = (text: string) => {
            const regex = /json(?:_agg|_build_object)\s*\(/gi;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                let parens = 0;
                let end = -1;
                let inString = false;
                for (let i = start; i < text.length; i++) {
                    const c = text[i];
                    if (c === "'" && (i === 0 || text[i-1] !== '\\')) inString = !inString;
                    if (!inString) {
                        if (c === '(') parens++;
                        if (c === ')') {
                            parens--;
                            if (parens === 0) {
                                end = i;
                                break;
                            }
                        }
                    }
                }
                if (end !== -1) {
                    const expr = text.substring(start, end + 1);
                    const after = text.substring(end + 1);
                    const aliasMatch = after.match(/^\s+(?:AS\s+)?(["\w]+)/i);
                    if (aliasMatch && !aliasMatch[1].toUpperCase().match(/^(FROM|WHERE|GROUP|ORDER|LIMIT|SELECT)$/)) {
                        aliasMap[aliasMatch[1].replace(/"/g, '')] = expr;
                    }
                }
            }
        };
        
        extractAggAliases(fullSql);
        
        const mainSelectMatch = fullSql.match(/SELECT\s+(json_build_object\s*\([\s\S]+?)\s+FROM/i) || fullSql.match(/SELECT\s+(json_build_object\s*\([\s\S]+)$/i);
        if (!mainSelectMatch) return undefined;
        
        const rootStart = fullSql.toUpperCase().indexOf('JSON_BUILD_OBJECT', mainSelectMatch.index);
        let rootExpr = '';
        let parens = 0, inString = false;
        for (let i = rootStart; i < fullSql.length; i++) {
            const c = fullSql[i];
            if (c === "'" && (i===0 || fullSql[i-1] !== '\\')) inString = !inString;
            if (!inString) {
                if (c === '(') parens++;
                if (c === ')') {
                    parens--;
                    if (parens === 0) {
                        rootExpr = fullSql.substring(rootStart, i + 1);
                        break;
                    }
                }
            }
        }
        
        if (!rootExpr) return undefined;
        
        let expanded = rootExpr;
        let changed = true;
        let passes = 0;
        while (changed && passes < 10) {
            changed = false;
            passes++;
            for (const [alias, expr] of Object.entries(aliasMap)) {
                const searchStr = `"${alias}"`;
                if (expanded.includes(searchStr)) {
                    expanded = expanded.split(searchStr).join(expr);
                    changed = true;
                }
                const wordRegex = new RegExp(`\\b${alias}\\b`, 'g');
                if (wordRegex.test(expanded)) {
                    const before = expanded;
                    expanded = expanded.replace(new RegExp(`([^'])(\\b${alias}\\b)([^']|$)`, 'g'), `$1${expr}$3`);
                    if (expanded !== before) changed = true;
                }
            }
        }

        const parsedTree = parseJsonAST(expanded);
        return Array.isArray(parsedTree) ? parsedTree : [parsedTree];
        
    } catch (e) {
        console.error("Failed to parse JSON AST fallback", e);
        return undefined;
    }
}
export const parseSQL = (sql: string): MultiQueryState => {
    const state: MultiQueryState = {
        ctes: [],
        mainQuery: {
            tables: [],
            selectedFields: [],
            joins: [],
            where: [],
            groupBy: [],
            orderBy: []
        }
    };

    if (!sql || sql.trim() === '') return state;

    try {
        const normalizedSql = sql.trim().replace(/\s+/g, ' ');
        const upperSql = normalizedSql.toUpperCase();

        // Reject unsupported commands
        const unsupportedKeywords = ['EXPLAIN', 'UPDATE', 'DELETE', 'INSERT', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];
        for (const kw of unsupportedKeywords) {
            if (upperSql.startsWith(kw)) {
                throw new Error(`syntax error at or near "${kw}"`);
            }
        }
        
        // Handle CTEs (WITH clause)
        if (upperSql.startsWith('WITH ')) {
            const isRecursive = upperSql.startsWith('WITH RECURSIVE');
            const firstSelect = findTopLevelToken(sql, ['SELECT']);
            if (firstSelect) {
                const withClause = sql.substring(0, firstSelect.index);
                const mainQueryContent = sql.substring(firstSelect.index);
                const ctesContent = withClause.substring(isRecursive ? 15 : 5).trim(); 
                
                // Parse individual CTEs: alias AS ( content )
                let currentPos = 0;
                while (currentPos < ctesContent.length) {
                    const remaining = ctesContent.substring(currentPos).trimStart();
                    if (!remaining) break;
                    
                    const skipLength = ctesContent.substring(currentPos).length - remaining.length;
                    currentPos += skipLength;
                    
                    if (ctesContent[currentPos] === ',') {
                        currentPos++;
                        continue;
                    }

                    const cteStartMatch = ctesContent.substring(currentPos).match(/^(["\w]+)\s+AS\s*\(/i);
                    if (!cteStartMatch) {
                         const stray = ctesContent.substring(currentPos).split(/\s+/)[0];
                         if (stray) throw new Error(`Syntax error near "${stray}"`);
                         break;
                    }

                    const alias = stripQ(cteStartMatch[1]);
                    const contentStart = currentPos + cteStartMatch[0].length;
                    
                    // Find matching closing parenthesis
                    let parenCount = 1;
                    let contentEnd = contentStart;
                    while (contentEnd < ctesContent.length && parenCount > 0) {
                        if (ctesContent[contentEnd] === '(') parenCount++;
                        else if (ctesContent[contentEnd] === ')') parenCount--;
                        contentEnd++;
                    }
                    
                    if (parenCount > 0) {
                        throw new Error(`Syntax error: missing closing parenthesis for CTE "${alias}"`);
                    }

                    const content = ctesContent.substring(contentStart, contentEnd - 1);
                    
                    // Detect recursive pattern
                    let isCteRecursive = false;
                    let recursiveConfig: any = undefined;
                    
                    if (content.toUpperCase().includes('UNION ALL')) {
                        const unionParts = content.split(/UNION ALL/i);
                        if (unionParts.length === 2) {
                            const anchorPart = unionParts[0].trim();
                            const recursivePart = unionParts[1].trim();
                            
                            // 1. Detect recursion by JOIN onto the CTE itself (the alias)
                            // Pattern: JOIN alias AS t ON ... or JOIN alias t ON ...
                            const recursiveJoinRegex = new RegExp(`JOIN\\s+(?:"?)${alias}(?:"?)\\s+(?:AS\\s+)?(["\\w]+)\\s+ON\\s+`, 'i');
                            const recursiveJoinMatch = recursivePart.match(recursiveJoinRegex);
                            
                            if (recursiveJoinMatch) {
                                const cteAliasInRecursive = stripQ(recursiveJoinMatch[1]);
                                
                                // 2. Find the other table in the recursive part (the anchor table)
                                const anchorTableMatch = recursivePart.match(/FROM\s+(?:"?)([\w\.]+)(?:"?)(?:\s+AS\s+(?:"?)([\w]+)(?:"?))?/i);
                                
                                // 3. Find the join condition: r.parent_id = t.id or t.id = r.parent_id
                                const joinCondMatch = recursivePart.match(/ON\s+(?:"?)([\w\.]+)(?:"?)\.(?:"?)([\w\.]+)(?:"?)\s*=\s*(?:"?)([\w\.]+)(?:"?)\.(?:"?)([\w\.]+)(?:"?)/i);
                                
                                if (anchorTableMatch && joinCondMatch) {
                                    const anchorTable = stripQ(anchorTableMatch[1]);
                                    
                                    const leftT = stripQ(joinCondMatch[1]);
                                    const leftC = stripQ(joinCondMatch[2]);
                                    const rightT = stripQ(joinCondMatch[3]);
                                    const rightC = stripQ(joinCondMatch[4]);
                                    
                                    let primaryKey = '';
                                    let parentKey = '';
                                    
                                    if (leftT === cteAliasInRecursive) {
                                        primaryKey = leftC;
                                        parentKey = rightC;
                                    } else if (rightT === cteAliasInRecursive) {
                                        primaryKey = rightC;
                                        parentKey = leftC;
                                    }
                                    
                                    if (primaryKey && parentKey) {
                                        isCteRecursive = true;
                                        recursiveConfig = {
                                            anchorTable,
                                            primaryKey,
                                            parentKey
                                        };
                                        
                                        // 4. Extract depth column if present
                                        const depthMatch = anchorPart.match(/0\s+AS\s+(["\w]+)/i);
                                        if (depthMatch) {
                                            recursiveConfig.depthColumn = stripQ(depthMatch[1]);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    const anchorContent = isCteRecursive ? content.split(/UNION ALL/i)[0] : content;
                    const blockState = parseBlock(anchorContent);
                    
                    if (isCteRecursive && recursiveConfig?.depthColumn) {
                        blockState.selectedFields = blockState.selectedFields.filter(f => {
                            const name = f.alias || f.columnName || '';
                            return name.toLowerCase() !== recursiveConfig.depthColumn.toLowerCase();
                        });
                    }

                    state.ctes.push({
                        id: `cte_${Date.now()}_${state.ctes.length}`,
                        alias,
                        isRecursive: isCteRecursive,
                        recursiveConfig,
                        state: blockState
                    });
                    
                    currentPos = contentEnd;
                }
                
                state.mainQuery = parseBlock(mainQueryContent);
            } else {
                throw new Error('syntax error at or near "WITH"');
            }
        } else {
            state.mainQuery = parseBlock(sql);
        }

        // Check for JSON Builder injections
        const stateMatch = sql.match(/\/\*\s*JSON_BUILDER_STATE:\s*(\[.+?\])\s*\*\//);
        let finalJsonTree: import('../model/types').JsonTreeNode[] | undefined;
        
        if (stateMatch) {
            try { finalJsonTree = JSON.parse(stateMatch[1]); } catch(e){}
        } else {
            const upperSqlCheck = sql.toUpperCase();
            if (upperSqlCheck.includes('JSON_BUILD_OBJECT') && upperSqlCheck.includes('JSON_AGG')) {
                finalJsonTree = extractJsonTreeAST(sql);
            }
        }
        
        if (finalJsonTree && finalJsonTree.length > 0) {
            const metaCteIndex = state.ctes.findIndex(c => c.alias.toLowerCase() === 'meta');
            if (metaCteIndex !== -1) {
                state.mainQuery = state.ctes[metaCteIndex].state;
                state.ctes = state.ctes.filter(c => {
                    const l = c.alias.toLowerCase();
                    return l !== 'meta' && !l.startsWith('sub_');
                });
            }
            state.jsonTree = finalJsonTree;
        }

        return state;
    } catch (err: any) {
        if (err.message.includes('syntax error')) {
            throw err;
        }
        throw new Error(`syntax error: ${err.message}`);
    }
};

const findTopLevelToken = (sql: string, tokens: string[], startPos: number = 0): { token: string, index: number } | null => {
    let parenCount = 0;
    let inString = false;
    const upperSql = sql.toUpperCase();
    
    for (let i = startPos; i < sql.length; i++) {
        const char = sql[i];
        
        // Handle strings
        if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) {
            inString = !inString;
            continue;
        }
        if (inString) continue;

        // Handle parentheses
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;

        if (parenCount === 0) {
            const remaining = upperSql.substring(i);
            for (const token of tokens) {
                const upperToken = token.toUpperCase();
                if (remaining.startsWith(upperToken)) {
                    // Ensure it's a whole word
                    const nextChar = remaining[upperToken.length];
                    if (!nextChar || !/[A-Z0-9_]/.test(nextChar)) {
                        return { token: upperToken, index: i };
                    }
                }
            }
        }
    }
    return null;
};

const parseBlock = (sql: string): QueryState => {
    const state: QueryState = {
        tables: [],
        selectedFields: [],
        joins: [],
        where: [],
        groupBy: [],
        orderBy: []
    };

    const firstSelect = findTopLevelToken(sql, ['SELECT']);
    if (!firstSelect) throw new Error('syntax error: Missing SELECT');
    
    const firstFrom = findTopLevelToken(sql, ['FROM'], firstSelect.index + 6);
    if (!firstFrom) throw new Error('syntax error: Missing FROM clause');

    // Isolate clauses using findTopLevelToken
    const clauseKeywords = ['WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN'];
    const clauses: { token: string, index: number }[] = [];
    
    let searchPos = firstFrom.index;
    while (true) {
        const match = findTopLevelToken(sql, clauseKeywords, searchPos);
        if (!match) break;
        clauses.push(match);
        searchPos = match.index + match.token.length;
    }

    const getClauseContent = (startToken: { token: string, index: number }, nextToken?: { token: string, index: number }) => {
        const start = startToken.index + startToken.token.length;
        const end = nextToken ? nextToken.index : sql.length;
        return sql.substring(start, end).trim();
    };

    // 1. FROM & JOINs (Table identification)
    const fromEnd = clauses.length > 0 ? clauses[0].index : sql.length;
    const fromContent = sql.substring(firstFrom.index + 4, fromEnd).trim();
    
    const tableParts = fromContent.split(',').map(s => s.trim());
    for (const part of tableParts) {
        const aliasMatch = part.match(/^(["\w\.]+)(?:\s+AS)?\s+(["\w\.]+)$/i) || part.match(/^(["\w\.]+)$/i);
        if (aliasMatch) {
            const tableName = stripQ(aliasMatch[1]);
            const alias = stripQ(aliasMatch[2] || tableName);
            if (!state.tables.find(t => t.alias === alias)) {
                state.tables.push({ tableName, alias });
            }
        }
    }

    // 2. SELECT (Fields)
    const selectContent = sql.substring(firstSelect.index + 6, firstFrom.index).trim();
    const fields: string[] = [];
    let curField = '';
    let p = 0;
    let s = false;
    for (let i = 0; i < selectContent.length; i++) {
        const c = selectContent[i];
        if (c === "'" && (i === 0 || selectContent[i-1] !== '\\')) s = !s;
        if (!s) {
            if (c === '(') p++;
            if (c === ')') p--;
            if (c === ',' && p === 0) {
                fields.push(curField.trim());
                curField = '';
                continue;
            }
        }
        curField += c;
    }
    if (curField.trim()) fields.push(curField.trim());

    for (const field of fields) {
        if (field === '*') {
            state.selectedFields.push({ id: `all_${state.selectedFields.length}`, tableAlias: state.tables[0]?.alias || '', columnName: '*' });
            continue;
        }
        const aliasMatch = field.match(/(.+?)\s+AS\s+(["\w]+)$/i) || field.match(/(.+?)\s+(["\w]+)$/i);
        let expr = field;
        let alias: string | undefined = undefined;
        if (aliasMatch && !['FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'LIMIT'].includes(aliasMatch[2].toUpperCase())) {
            expr = aliasMatch[1];
            alias = stripQ(aliasMatch[2]);
        }

        const identifierRegex = /^(?:"?([^"\s]+)"?\.)?"?([^"\s]+)"?$/i;
        const simpleColMatch = expr.match(identifierRegex);
        if (simpleColMatch && !expr.includes('(') && !expr.includes('->') && !expr.includes('#')) {
            const parsed = splitIdentifier(expr);
            const tableAlias = parsed.table || state.tables[0]?.alias || '';
            state.selectedFields.push({ id: `${tableAlias}_${parsed.column}_${state.selectedFields.length}`, tableAlias, columnName: parsed.column, alias });
        } else {
            state.selectedFields.push({ id: `expr_${state.selectedFields.length}`, tableAlias: state.tables[0]?.alias || '', expression: expr, alias });
        }
    }

    // 3. Process remaining clauses
    for (let i = 0; i < clauses.length; i++) {
        const c = clauses[i];
        const content = getClauseContent(c, clauses[i+1]);

        if (c.token.includes('JOIN')) {
            const joinMatch = content.match(/^(["\w\.]+)(?:\s+AS)?\s+(["\w\.]+)\s+ON\s+(["\w\.]+)\.(["\w\.]+)\s*=\s*(["\w\.]+)\.(["\w\.]+)/i);
            if (joinMatch) {
                const type = c.token.replace(' CROSS', '').replace(' JOIN', '') || 'INNER';
                const tableName = stripQ(joinMatch[1]);
                const alias = stripQ(joinMatch[2]);
                if (!state.tables.find(t => t.alias === alias)) state.tables.push({ tableName, alias });
                state.joins.push({
                    id: `join_${Date.now()}_${state.joins.length}`,
                    type: (type === 'CROSS' ? 'INNER' : type) as any,
                    leftTableAlias: stripQ(joinMatch[3]), leftColumn: stripQ(joinMatch[4]),
                    rightTableAlias: stripQ(joinMatch[5]), rightColumn: stripQ(joinMatch[6])
                });
            }
        } else if (c.token === 'WHERE') {
            const conditions = content.split(/\s+(AND|OR)\s+/gi);
            for (let j = 0; j < conditions.length; j += 2) {
                const condStr = conditions[j].trim();
                const logic = j > 0 ? conditions[j-1].toUpperCase() : 'AND';
                const condMatch = condStr.match(/(["\w\.]+)(?:\.(["\w\.]+))?\s*(=|!=|>|<|>=|<=|LIKE|IN)\s*([\s\S]+)/i);
                const nullMatch = condStr.match(/(["\w\.]+)(?:\.(["\w\.]+))?\s+(IS\s+NULL|IS\s+NOT\s+NULL)/i);
                if (condMatch) {
                    const parsed = splitIdentifier(condMatch[2] ? `${condMatch[1]}.${condMatch[2]}` : condMatch[1]);
                    let val = condMatch[4].trim();
                    let vt: 'literal' | 'parameter' = 'literal';
                    if (val.startsWith(':')) { vt = 'parameter'; val = val.substring(1); }
                    state.where.push({ id: `w_${Date.now()}_${state.where.length}`, tableAlias: parsed.table || state.tables[0]?.alias || '', columnName: parsed.column, operator: condMatch[3].toUpperCase() as any, value: val, valueType: vt, logic: logic as any });
                } else if (nullMatch) {
                    const parsed = splitIdentifier(nullMatch[2] ? `${nullMatch[1]}.${nullMatch[2]}` : nullMatch[1]);
                    state.where.push({ id: `w_${Date.now()}_${state.where.length}`, tableAlias: parsed.table || state.tables[0]?.alias || '', columnName: parsed.column, operator: nullMatch[3].toUpperCase() as any, value: 'NULL', logic: logic as any });
                }
            }
        } else if (c.token === 'GROUP BY') {
            content.split(',').forEach(g => {
                const p = splitIdentifier(g.trim());
                state.groupBy.push({ id: `g_${Date.now()}_${state.groupBy.length}`, tableAlias: p.table || state.tables[0]?.alias || '', columnName: p.column });
            });
        } else if (c.token === 'ORDER BY') {
            content.split(',').forEach(o => {
                const pts = o.trim().split(/\s+/);
                const p = splitIdentifier(pts[0]);
                state.orderBy.push({ id: `o_${Date.now()}_${state.orderBy.length}`, tableAlias: p.table || state.tables[0]?.alias || '', columnName: p.column, direction: (pts[1] || 'ASC').toUpperCase() as any });
            });
        } else if (c.token === 'LIMIT') {
            const m = content.match(/^(\d+)/);
            if (m) { state.limit = parseInt(m[1], 10); state.useLimit = true; }
        }
    }

    return state;
};
