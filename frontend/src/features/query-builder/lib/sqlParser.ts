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
            const skip = isRecursive ? 15 : 5;
            const selectPos = findTopLevelSelect(sql);
            if (selectPos !== -1) {
                const withClause = sql.substring(0, selectPos);
                const mainQueryContent = sql.substring(selectPos);
                
                const ctesContent = withClause.substring(skip).trim(); 
                
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

        return state;
    } catch (err: any) {
        if (err.message.includes('syntax error')) {
            throw err;
        }
        throw new Error(`syntax error: ${err.message}`);
    }
};

const findTopLevelSelect = (sql: string): number => {
    let parenCount = 0;
    const upperSql = sql.toUpperCase();
    
    for (let i = 0; i < sql.length; i++) {
        if (sql[i] === '(') parenCount++;
        else if (sql[i] === ')') parenCount--;
        
        if (parenCount === 0) {
            const nextPart = upperSql.substring(i);
            // Search for SELECT keyword following whitespace or start/end of previous group
            const match = nextPart.match(/^(\s+|(?:\)|,)\s*)SELECT\b/);
            if (match) {
                return i + match[0].indexOf('SELECT');
            }
        }
    }
    return -1;
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

    const upperSql = sql.toUpperCase();
    
    const selectIndex = upperSql.indexOf('SELECT');
    if (selectIndex === -1) throw new Error('syntax error: Missing SELECT');
    
    const fromIndex = upperSql.indexOf('FROM');
    if (fromIndex === -1) throw new Error('syntax error: Missing FROM clause');
    
    // Find where FROM ends and the next part starts (JOIN, WHERE, GROUP BY, ORDER BY, or end)
    const nextKeywords = ['CROSS JOIN', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT'];
    let fromEnd = sql.length;
    for (const kw of nextKeywords) {
        const idx = upperSql.indexOf(kw, fromIndex + 4);
        if (idx !== -1 && idx < fromEnd) fromEnd = idx;
    }
    
    const fromContent = sql.substring(fromIndex + 4, fromEnd).trim();
    // Support "table AS alias" or "table alias"
    const tableParts = fromContent.split(',').map(s => s.trim());
    for (const part of tableParts) {
        const aliasMatch = part.match(/^(["\w\.]+)(?:\s+AS)?\s+(["\w\.]+)$/i) || part.match(/^(["\w\.]+)$/i);
        if (aliasMatch) {
            const tableName = stripQ(aliasMatch[1]);
            const alias = stripQ(aliasMatch[2] || tableName);
            state.tables.push({ tableName, alias });
        }
    }

    // 2. SELECT clause (fields)
    const selectContent = sql.substring(selectIndex + 6, fromIndex).trim();
    
    // Split by comma, but be careful of commas inside function calls
    // Using a simple split for now, but in a real-world scenario, we'd need a more robust parser
    const fields: string[] = [];
    let currentField = '';
    let parenCount = 0;
    for (let i = 0; i < selectContent.length; i++) {
        const char = selectContent[i];
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        
        if (char === ',' && parenCount === 0) {
            fields.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    if (currentField.trim()) fields.push(currentField.trim());

    for (const field of fields) {
        if (field === '*') {
            state.selectedFields.push({
                id: `all_${state.selectedFields.length}`,
                tableAlias: state.tables[0]?.alias || '',
                columnName: '*'
            });
            continue;
        }

        // Match "expression AS alias" or just "expression"
        // Improved to detect stray text
        const aliasMatch = field.match(/(.+?)\s+AS\s+(["\w]+)$/i) || field.match(/(.+?)\s+(["\w]+)$/i);
        let expr = field;
        let alias: string | undefined = undefined;

        if (aliasMatch) {
            const potentialExpr = aliasMatch[1];
            const potentialAlias = stripQ(aliasMatch[2]);
            const keywords = ['FROM', 'WHERE', 'JOIN', 'ON', 'GROUP', 'ORDER', 'LIMIT', 'SELECT', 'WITH'];
            
            if (!keywords.includes(potentialAlias.toUpperCase())) {
                // Allow spaces if it looks like an expression (contains operators)
                // or if it's just a single identifier. 
                // We'll remove the aggressive throw here as it breaks valid expressions.
                expr = potentialExpr;
                alias = potentialAlias;
            }
        }

        // If it's just a single field without AS, and it has spaces but no functions
        // we'll allow it as it might be an expression like "a - b"
        // The generator/UI will handle it as a complex expression.
        
        // Special case: * followed by anything in the same field is a syntax error
        if (field.includes('*') && field.trim() !== '*' && !field.includes('(')) {
            throw new Error(`syntax error at or near "*"`);
        }

        // Now parse expr to see if it's a simple column (table.col) or a complex expression
        // Improved regex to better handle dots inside quotes vs outside
        const identifierRegex = /^(?:"?([^"\s]+)"?\.)?"?([^"\s]+)"?$/i;
        const simpleColMatch = expr.match(identifierRegex);

        if (simpleColMatch && !expr.includes('(') && !expr.includes('->') && !expr.includes('#')) {
            const parsed = splitIdentifier(expr);
            const tableAlias = parsed.table || state.tables[0]?.alias || '';
            const columnName = parsed.column;

            state.selectedFields.push({
                id: `${tableAlias}_${columnName}_${state.selectedFields.length}`,
                tableAlias,
                columnName,
                alias
            });
        } else {
            // Complex expression
            state.selectedFields.push({
                id: `expr_${state.selectedFields.length}`,
                tableAlias: state.tables[0]?.alias || '',
                expression: expr,
                alias: alias
            });
        }
    }

    // 3. JOIN clauses
    const joinRegex = /(?:(LEFT|RIGHT|INNER|FULL)\s+)?JOIN\s+(["\w\.]+)(?:\s+AS)?\s+(["\w\.]+)\s+ON\s+(["\w\.]+)\.(["\w\.]+)\s*=\s*(["\w\.]+)\.(["\w\.]+)/gi;
    let joinMatch;
    while ((joinMatch = joinRegex.exec(sql)) !== null) {
        const type = (joinMatch[1] || 'INNER').toUpperCase() as any;
        const tableName = stripQ(joinMatch[2]);
        const alias = stripQ(joinMatch[3]);
        const leftTable = stripQ(joinMatch[4]);
        const leftCol = stripQ(joinMatch[5]);
        const rightTable = stripQ(joinMatch[6]);
        const rightCol = stripQ(joinMatch[7]);
        
        if (!state.tables.find(t => t.alias === alias)) {
            state.tables.push({ tableName, alias });
        }
        
        let finalLeftTable = leftTable;
        let finalLeftCol = leftCol;
        let finalRightTable = rightTable;
        let finalRightCol = rightCol;
        
        // Ensure rightTableAlias is always the table being joined (after JOIN keyword)
        if (leftTable === alias && rightTable !== alias) {
            finalLeftTable = rightTable;
            finalLeftCol = rightCol;
            finalRightTable = leftTable;
            finalRightCol = leftCol;
        }

        state.joins.push({
            id: `join_${Date.now()}_${state.joins.length}`,
            type,
            leftTableAlias: finalLeftTable,
            leftColumn: finalLeftCol,
            rightTableAlias: finalRightTable,
            rightColumn: finalRightCol
        });
    }

    const crossJoinRegex = /CROSS\s+JOIN\s+(["\w\.]+)(?:\s+AS)?\s+(["\w\.]+)/gi;
    let crossJoinMatch;
    while ((crossJoinMatch = crossJoinRegex.exec(sql)) !== null) {
        const tableName = stripQ(crossJoinMatch[1]);
        const alias = stripQ(crossJoinMatch[2]);
        if (!state.tables.find(t => t.alias === alias)) {
            state.tables.push({ tableName, alias });
        }
    }

    // 4. WHERE clause
    const whereIndex = upperSql.indexOf('WHERE');
    if (whereIndex !== -1) {
        let whereEnd = sql.length;
        const endKeywords = ['GROUP BY', 'ORDER BY', 'LIMIT'];
        for (const kw of endKeywords) {
            const idx = upperSql.indexOf(kw, whereIndex + 5);
            if (idx !== -1 && idx < whereEnd) whereEnd = idx;
        }
        
        const whereContent = sql.substring(whereIndex + 5, whereEnd).trim();
        // Simplified split by AND/OR
        const conditions = whereContent.split(/\s+(AND|OR)\s+/gi);
        
        for (let i = 0; i < conditions.length; i += 2) {
            const condStr = conditions[i].trim();
            const logic = i > 0 ? conditions[i - 1].toUpperCase() : 'AND';
            
            // Match standard operators
            const condMatch = condStr.match(/(["\w\.]+)(?:\.(["\w\.]+))?\s*(=|!=|>|<|>=|<=|LIKE|IN)\s*([\s\S]+)/i);
            // Match IS NULL / IS NOT NULL
            const nullMatch = condStr.match(/(["\w\.]+)(?:\.(["\w\.]+))?\s+(IS\s+NULL|IS\s+NOT\s+NULL)/i);
            
            if (condMatch) {
                const [, fullColOrAlias, colNameIfPresent, operator, value] = condMatch;
                const parsed = splitIdentifier(colNameIfPresent ? `${fullColOrAlias}.${colNameIfPresent}` : fullColOrAlias);
                const tableAlias = parsed.table || state.tables[0]?.alias || '';
                const columnName = parsed.column;

                let trimmedValue = value.trim();
                let valueType: 'literal' | 'parameter' = 'literal';
                if (trimmedValue.startsWith(':')) {
                    valueType = 'parameter';
                    trimmedValue = trimmedValue.substring(1);
                }

                state.where.push({ 
                    id: `where_${Date.now()}_${state.where.length}`, 
                    tableAlias, 
                    columnName, 
                    operator: operator.toUpperCase() as any, 
                    value: trimmedValue, 
                    valueType,
                    logic: logic as 'AND' | 'OR' 
                });
            } else if (nullMatch) {
                const [, fullColOrAlias, colNameIfPresent, operator] = nullMatch;
                const parsed = splitIdentifier(colNameIfPresent ? `${fullColOrAlias}.${colNameIfPresent}` : fullColOrAlias);
                const tableAlias = parsed.table || state.tables[0]?.alias || '';
                const columnName = parsed.column;
                state.where.push({ 
                    id: `where_${Date.now()}_${state.where.length}`, 
                    tableAlias, 
                    columnName, 
                    operator: operator.toUpperCase() as any, 
                    value: 'NULL', 
                    logic: logic as 'AND' | 'OR' 
                });
            }
        }
    }

    const normalizedSql = sql.replace(/\s+/g, ' ');

    // 5. GROUP BY clause
    const groupByMatch = normalizedSql.match(/GROUP BY\s+(.+?)(?:\s+(?:ORDER BY|LIMIT)|$)/i);
    if (groupByMatch) {
        const groupByContent = groupByMatch[1].trim();
        const groups = groupByContent.split(',').map((s: string) => s.trim());
        for (const group of groups) {
            const parsed = splitIdentifier(group);
            const tableAlias = parsed.table || state.tables[0]?.alias || '';
            const columnName = parsed.column;
            state.groupBy.push({
                id: `group_${Date.now()}_${state.groupBy.length}`,
                tableAlias,
                columnName
            });
        }
    }

    // 6. ORDER BY clause
    const orderByMatch = normalizedSql.match(/ORDER BY\s+(.+?)(?:\s+LIMIT|$)/i);
    if (orderByMatch) {
        const orderByContent = orderByMatch[1].trim();
        const orders = orderByContent.split(',').map((s: string) => s.trim());
        for (const order of orders) {
            const orderParts = order.split(/\s+/);
            const identifier = orderParts[0];
            const direction = (orderParts[1] || 'ASC').toUpperCase() as 'ASC' | 'DESC';
            
            const parsed = splitIdentifier(identifier);
            const tableAlias = parsed.table || state.tables[0]?.alias || '';
            const columnName = parsed.column;
            
            state.orderBy.push({
                id: `order_${Date.now()}_${state.orderBy.length}`,
                tableAlias,
                columnName,
                direction
            });
        }
    }

    // 7. LIMIT clause
    const limitMatch = normalizedSql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
        state.limit = parseInt(limitMatch[1], 10);
        state.useLimit = true;
    }

    return state;
};
