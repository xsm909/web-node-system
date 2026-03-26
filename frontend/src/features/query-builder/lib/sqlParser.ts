import type { MultiQueryState, QueryState } from '../model/types';

const stripQ = (s: string) => s ? s.replace(/"/g, '') : '';

const splitIdentifier = (s: string): { table?: string, column: string } => {
    const parts = s.split('.').map(stripQ);
    if (parts.length > 1) {
        return { 
            table: parts[parts.length - 2], 
            column: parts[parts.length - 1] 
        };
    }
    return { column: parts[0] };
};

const findTopLevelToken = (sql: string, tokens: string[], startPos: number = 0): { token: string, index: number } | null => {
    let parenCount = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBlockComment = false;
    let inLineComment = false;
    const upperSql = sql.toUpperCase();
    
    for (let i = startPos; i < sql.length; i++) {
        const char = sql[i];
        const nextChar = sql[i + 1];
        
        // Handle block comments
        if (!inSingleQuote && !inDoubleQuote && !inLineComment) {
            if (!inBlockComment && char === '/' && nextChar === '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            if (inBlockComment && char === '*' && nextChar === '/') {
                inBlockComment = false;
                i++;
                continue;
            }
        }
        if (inBlockComment) continue;

        // Handle line comments
        if (!inSingleQuote && !inDoubleQuote && !inBlockComment) {
            if (!inLineComment && char === '-' && nextChar === '-') {
                inLineComment = true;
                i++;
                continue;
            }
        }
        if (inLineComment) {
            if (char === '\n') inLineComment = false;
            continue;
        }

        // Handle identifiers (double quotes)
        if (!inSingleQuote && !inBlockComment && !inLineComment) {
            if (char === '"' && (i === 0 || sql[i - 1] !== '\\')) {
                inDoubleQuote = !inDoubleQuote;
                continue;
            }
        }
        if (inDoubleQuote) continue;

        // Handle strings (single quotes)
        if (!inDoubleQuote && !inBlockComment && !inLineComment) {
            if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) {
                if (!inSingleQuote && nextChar === "'") {
                    i++; 
                    continue;
                }
                inSingleQuote = !inSingleQuote;
                continue;
            }
        }
        if (inSingleQuote) continue;

        // Handle parentheses
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;

        if (parenCount === 0) {
            const remaining = upperSql.substring(i);
            const found = tokens.find(t => remaining.startsWith(t.toUpperCase()));
            if (found) {
                const nextCharAfterToken = remaining[found.length];
                if (!nextCharAfterToken || !/[A-Z0-9_]/.test(nextCharAfterToken)) {
                    return { token: found.toUpperCase(), index: i };
                }
            }
        }
    }
    return null;
};

function tokenizeJsonArgs(funcBody: string) {
    const args: string[] = [];
    let current = '';
    let p = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    
    for (let i = 0; i < funcBody.length; i++) {
        const c = funcBody[i];
        
        // Handle quotes
        if (c === "'" && !inDoubleQuote && (i === 0 || funcBody[i - 1] !== '\\')) {
            inSingleQuote = !inSingleQuote;
        } else if (c === '"' && !inSingleQuote && (i === 0 || funcBody[i - 1] !== '\\')) {
            inDoubleQuote = !inDoubleQuote;
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (c === '(') p++;
            else if (c === ')') p--;
            else if (c === ',' && p === 0) {
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
    const lowerExpr = expr.toLowerCase();
    if (lowerExpr.startsWith('json_build_object') || lowerExpr.startsWith('jsonb_build_object')) {
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
    
    if (lowerExpr.startsWith('json_agg') || lowerExpr.startsWith('jsonb_agg')) {
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
        else children = [parsed];
        
        return {
            id: 'node_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            key: '',
            type: 'array',
            children: children,
            orderByRef
        };
    }
    
    // field
    return {
        id: 'node_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        key: '',
        type: 'field',
        fieldRef: expr.replace(/"/g, '')
    };
}

export function extractJsonTreeAST(fullSql: string): import('../model/types').JsonTreeNode[] | undefined {
    try {
        const aliasMap: Record<string, string> = {};
        
        const extractAggAliases = (text: string) => {
            const regex = /jsonb?(?:_agg|_build_object)\s*\(/gi;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                let parens = 0;
                let end = -1;
                let inSingleIdx = false;
                let inDoubleIdx = false;
                for (let i = start; i < text.length; i++) {
                    const c = text[i];
                    if (c === "'" && !inDoubleIdx && (i === 0 || text[i-1] !== '\\')) inSingleIdx = !inSingleIdx;
                    else if (c === '"' && !inSingleIdx && (i === 0 || text[i-1] !== '\\')) inDoubleIdx = !inDoubleIdx;
                    
                    if (!inSingleIdx && !inDoubleIdx) {
                        if (c === '(') parens++;
                        else if (c === ')') {
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
        
        const firstSelect = findTopLevelToken(fullSql, ['SELECT']);
        if (!firstSelect) return undefined;
        
        const firstFrom = findTopLevelToken(fullSql, ['FROM'], firstSelect.index + 6);
        if (!firstFrom) return undefined;

        const mainSelectContent = fullSql.substring(firstSelect.index + 6, firstFrom.index);
        const rootStartMatch = mainSelectContent.match(/jsonb?_build_object\s*\(/i);
        if (!rootStartMatch) return undefined;

        const rootStart = firstSelect.index + 6 + rootStartMatch.index!;
        let rootExpr = '';
        let parens = 0, inSingle = false, inDouble = false;
        
        for (let i = rootStart; i < fullSql.length; i++) {
            const c = fullSql[i];
            if (c === "'" && !inDouble && (i === 0 || fullSql[i-1] !== '\\')) inSingle = !inSingle;
            else if (c === '"' && !inSingle && (i === 0 || fullSql[i-1] !== '\\')) inDouble = !inDouble;
            
            if (!inSingle && !inDouble) {
                if (c === '(') parens++;
                else if (c === ')') {
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
                
                const wordRegex = new RegExp(`([^'"])\\b${alias}\\b([^'"])`, 'g');
                if (wordRegex.test(expanded)) {
                    const before = expanded;
                    expanded = expanded.replace(wordRegex, `$1${expr}$2`);
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
    
    const clauseKeywords = ['WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN'];
    const clauses: { token: string, index: number }[] = [];
    
    let searchPos = firstFrom ? firstFrom.index : (firstSelect.index + 6);
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
    if (firstFrom) {
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
    }

    // 2. SELECT (Fields)
    const selectEnd = firstFrom ? firstFrom.index : (clauses.length > 0 ? clauses[0].index : sql.length);
    const selectContent = sql.substring(firstSelect.index + 6, selectEnd).trim();
    const fields: string[] = [];
    let curField = '';
    let p = 0;
    let s = false;
    let d = false;
    for (let i = 0; i < selectContent.length; i++) {
        const c = selectContent[i];
        if (c === "'" && !d && (i === 0 || selectContent[i-1] !== '\\')) s = !s;
        if (c === '"' && !s && (i === 0 || selectContent[i-1] !== '\\')) d = !d;
        if (!s && !d) {
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
        const aliasMatch = field.match(/^([\s\S]+?)\s+AS\s+(["\w]+)$/i) || field.match(/^([\s\S]+?)\s+(["\w]+)$/i);
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
                if (!conditions[j]) continue;
                const condStr = conditions[j].trim();
                const logic = j > 0 ? (conditions[j-1] || 'AND').toUpperCase() : 'AND';
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
        let startIdx = 0;
        let inBlockComment = false;
        while (startIdx < sql.length) {
            const char = sql[startIdx];
            const nextChar = sql[startIdx + 1];
            if (!inBlockComment && char === '/' && nextChar === '*') {
                inBlockComment = true;
                startIdx += 2;
            } else if (inBlockComment && char === '*' && nextChar === '/') {
                inBlockComment = false;
                startIdx += 2;
            } else if (inBlockComment) {
                startIdx++;
            } else if (/\s/.test(char)) {
                startIdx++;
            } else {
                break;
            }
        }

        const effectiveSql = sql.substring(startIdx);
        const upperEffectiveSql = effectiveSql.toUpperCase().trimStart();

        if (upperEffectiveSql.startsWith('WITH ')) {
            const isRecursive = upperEffectiveSql.startsWith('WITH RECURSIVE');
            const firstSelect = findTopLevelToken(sql, ['SELECT'], startIdx);
            
            if (firstSelect) {
                const withClause = sql.substring(startIdx, firstSelect.index);
                const mainQueryContent = sql.substring(firstSelect.index);
                const ctesContent = withClause.substring(isRecursive ? 15 : 5).trim(); 
                
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

                    // Robust CTE name extraction (handle double quotes)
                    const cteStartMatch = ctesContent.substring(currentPos).match(/^((?:"[^"]+")|[\w]+)\s+AS\s*\(/i);
                    if (!cteStartMatch) break;

                    const alias = stripQ(cteStartMatch[1]);
                    const contentStart = currentPos + cteStartMatch[0].length;
                    
                    // Robust balanced parentheses extraction
                    let parenCount = 1;
                    let contentEnd = contentStart;
                    let inSingle = false, inDouble = false, inBlock = false, inLine = false;

                    while (contentEnd < ctesContent.length && parenCount > 0) {
                        const c = ctesContent[contentEnd];
                        const nc = ctesContent[contentEnd + 1];

                        if (!inSingle && !inDouble && !inLine) {
                            if (!inBlock && c === '/' && nc === '*') { inBlock = true; contentEnd += 2; continue; }
                            if (inBlock && c === '*' && nc === '/') { inBlock = false; contentEnd += 2; continue; }
                        }
                        if (inBlock) { contentEnd++; continue; }

                        if (!inSingle && !inDouble && !inBlock) {
                            if (c === '-' && nc === '-') { inLine = true; contentEnd += 2; continue; }
                        }
                        if (inLine) { if (c === '\n') inLine = false; contentEnd++; continue; }

                        if (!inSingle && !inBlock && !inLine) {
                            if (c === '"') inDouble = !inDouble;
                        }
                        if (inDouble) { contentEnd++; continue; }

                        if (!inDouble && !inBlock && !inLine) {
                            if (c === "'") {
                                if (!inSingle && nc === "'") { contentEnd += 2; continue; }
                                inSingle = !inSingle;
                            }
                        }
                        if (inSingle) { contentEnd++; continue; }

                        if (c === '(') parenCount++;
                        else if (c === ')') parenCount--;
                        contentEnd++;
                    }
                    
                    const content = ctesContent.substring(contentStart, contentEnd - 1);
                    const innerRes = parseSQL(content);
                    
                    // Flatten inner CTEs
                    state.ctes.push(...innerRes.ctes);

                    state.ctes.push({
                        id: `cte_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                        alias,
                        isRecursive: false,
                        state: innerRes.mainQuery
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

        const stateMatch = sql.match(/\/\*\s*JSON_BUILDER_STATE:\s*(\[.+?\])\s*\*\//);
        let finalJsonTree: import('../model/types').JsonTreeNode[] | undefined;
        
        if (stateMatch) {
            try { finalJsonTree = JSON.parse(stateMatch[1]); } catch(e){}
        } else {
            const upperSqlCheck = sql.toUpperCase();
            if (upperSqlCheck.includes('JSON_BUILD_OBJECT') || upperSqlCheck.includes('JSONB_BUILD_OBJECT')) {
                finalJsonTree = extractJsonTreeAST(sql);
            }
        }
        
        if (finalJsonTree && finalJsonTree.length > 0) {
            const metaCteIndex = state.ctes.findIndex(c => {
                const al = c.alias.toLowerCase();
                return al === 'meta' || al === '__base_query';
            });
            if (metaCteIndex !== -1) {
                const promotedState = state.ctes[metaCteIndex].state;
                const cteAlias = state.ctes[metaCteIndex].alias;
                const targetAlias = promotedState.tables[0]?.alias || '';

                // Aggressive Normalization: If the promoted state contains references to its own outer CTE alias
                // OR the legacy fallback 'meta', remap them to the actual primary table alias.
                if (targetAlias) {
                    const knownAliases = new Set(promotedState.tables.map(t => t.alias));
                    const fallbacks = ['meta', '__base_query', 'meta_data', 'meta_d']; // Common suspects
                    if (cteAlias) fallbacks.push(cteAlias);
                    
                    const fix = (a: string) => {
                        if (!a) return targetAlias;
                        if (knownAliases.has(a)) return a;
                        // If it's a known fallback OR there's only one table and the alias is unknown:
                        if (fallbacks.includes(a) || knownAliases.size === 1) return targetAlias;
                        return a;
                    };
                    
                    promotedState.selectedFields.forEach(f => { f.tableAlias = fix(f.tableAlias); });
                    promotedState.where.forEach(w => { w.tableAlias = fix(w.tableAlias); });
                    promotedState.groupBy.forEach(g => { g.tableAlias = fix(g.tableAlias); });
                    promotedState.orderBy.forEach(o => { o.tableAlias = fix(o.tableAlias); });
                    promotedState.joins.forEach(j => {
                        j.leftTableAlias = fix(j.leftTableAlias);
                        j.rightTableAlias = fix(j.rightTableAlias);
                    });

                    // Also normalize JsonTree fieldRefs/orderByRefs
                    const normalizeNodes = (nodes: import('../model/types').JsonTreeNode[]) => {
                        nodes.forEach(n => {
                            if (n.fieldRef) {
                                const p = splitIdentifier(n.fieldRef);
                                if (p.table && p.table !== targetAlias && (fallbacks.includes(p.table) || knownAliases.size === 1)) {
                                    n.fieldRef = `${targetAlias}.${p.column}`;
                                }
                            }
                            if (n.orderByRef) {
                                const p = splitIdentifier(n.orderByRef);
                                if (p.table && p.table !== targetAlias && (fallbacks.includes(p.table) || knownAliases.size === 1)) {
                                    n.orderByRef = `${targetAlias}.${p.column}`;
                                }
                            }
                            if (n.children) normalizeNodes(n.children);
                        });
                    };
                    if (finalJsonTree) normalizeNodes(finalJsonTree);
                }

                state.mainQuery = promotedState;
                state.ctes = state.ctes.filter(c => {
                    const l = c.alias.toLowerCase();
                    return l !== 'meta' && l !== '__base_query' && !l.startsWith('sub_');
                });
            }
            state.jsonTree = finalJsonTree;
        }

        return state;
    } catch (err: any) {
        if (err.message.includes('syntax error')) throw err;
        throw new Error(`syntax error: ${err.message}`);
    }
};
