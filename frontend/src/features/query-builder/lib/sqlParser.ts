import type { MultiQueryState, QueryState } from '../model/types';

export const parseSQL = (sql: string): MultiQueryState => {
    const state: MultiQueryState = {
        ctes: [],
        mainQuery: {
            tables: [],
            selectedFields: [],
            joins: [],
            where: []
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
            const withMatch = sql.match(/WITH\s+([\s\S]+?)\s+(SELECT[\s\S]+)/i);
            if (withMatch) {
                const ctesContent = withMatch[1];
                const mainQueryContent = withMatch[2];
                
                // Simple regex to find CTE definitions: name AS ( content )
                const cteRegex = /(\w+)\s+AS\s*\(\s*([\s\S]+?)\s*\)/gis;
                let lastIndex = 0;
                let cteMatch;
                
                while ((cteMatch = cteRegex.exec(ctesContent)) !== null) {
                    // Check for stray text between last match and this one
                    const strayText = ctesContent.substring(lastIndex, cteMatch.index).trim();
                    if (strayText !== "" && strayText !== ",") {
                         throw new Error(`Syntax error near "${strayText.split(/\s+/)[0]}"`);
                    }
                    
                    const alias = cteMatch[1];
                    const content = cteMatch[2];
                    state.ctes.push({
                        id: `cte_${Date.now()}_${state.ctes.length}`,
                        alias,
                        state: parseBlock(content)
                    });
                    
                    lastIndex = cteRegex.lastIndex;
                }
                
                // Check for stray text after last CTE match
                const remainingText = ctesContent.substring(lastIndex).trim();
                if (remainingText !== "" && remainingText !== ",") {
                    throw new Error(`Syntax error near "${remainingText.split(/\s+/)[0]}"`);
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

const parseBlock = (sql: string): QueryState => {
    const state: QueryState = {
        tables: [],
        selectedFields: [],
        joins: [],
        where: []
    };

    const upperSql = sql.toUpperCase();
    
    const selectIndex = upperSql.indexOf('SELECT');
    if (selectIndex === -1) throw new Error('syntax error: Missing SELECT');
    
    const fromIndex = upperSql.indexOf('FROM');
    if (fromIndex === -1) throw new Error('syntax error: Missing FROM clause');
    
    // Find where FROM ends and the next part starts (JOIN, WHERE, GROUP BY, ORDER BY, or end)
    const nextKeywords = ['JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT'];
    let fromEnd = sql.length;
    for (const kw of nextKeywords) {
        const idx = upperSql.indexOf(kw, fromIndex + 4);
        if (idx !== -1 && idx < fromEnd) fromEnd = idx;
    }
    
    const fromContent = sql.substring(fromIndex + 4, fromEnd).trim();
    // Support "table AS alias" or "table alias"
    const tableParts = fromContent.split(',').map(s => s.trim());
    for (const part of tableParts) {
        const aliasMatch = part.match(/^([\w\.]+)(?:\s+AS)?\s+([\w\.]+)$/i) || part.match(/^([\w\.]+)$/i);
        if (aliasMatch) {
            const tableName = aliasMatch[1];
            const alias = aliasMatch[2] || tableName;
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
        const aliasMatch = field.match(/(.+?)\s+AS\s+(\w+)$/i) || field.match(/(.+?)\s+(\w+)$/i);
        let expr = field;
        let alias: string | undefined = undefined;

        if (aliasMatch) {
            const potentialExpr = aliasMatch[1];
            const potentialAlias = aliasMatch[2];
            const keywords = ['FROM', 'WHERE', 'JOIN', 'ON', 'GROUP', 'ORDER', 'LIMIT', 'SELECT', 'WITH'];
            
            if (!keywords.includes(potentialAlias.toUpperCase())) {
                // If the potential expression itself has spaces and no special chars like (
                // it's likely a syntax error rather than a complex expression
                // Exception: if it's just "*", it shouldn't have an alias in this way in our builder
                if (potentialExpr.includes(' ') && !potentialExpr.includes('(')) {
                     throw new Error(`syntax error at or near "${potentialExpr.split(/\s+/).pop()}"`);
                }
                expr = potentialExpr;
                alias = potentialAlias;
            }
        }

        // If it's just a single field without AS, and it has spaces but no functions
        if (!alias && field.includes(' ') && !field.includes('(')) {
             throw new Error(`syntax error at or near "${field.trim().split(/\s+/)[1]}"`);
        }
        
        // Special case: * followed by anything in the same field is a syntax error
        if (field.includes('*') && field.trim() !== '*' && !field.includes('(')) {
            throw new Error(`syntax error at or near "*"`);
        }

        // Now parse expr to see if it's a simple column (table.col) or a complex expression
        const simpleColMatch = expr.match(/^([\w\.]+)\.([\w\.]+)$/i) || expr.match(/^([\w\.]+)$/i);
        if (simpleColMatch && !expr.includes('(')) {
            let tableAlias = state.tables[0]?.alias || '';
            let columnName = expr;
            if (expr.includes('.')) {
                const parts = expr.split('.');
                tableAlias = parts[0];
                columnName = parts[1];
            }
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
    const joinRegex = /(?:(LEFT|RIGHT|INNER|FULL)\s+)?JOIN\s+([\w\.]+)(?:\s+AS)?\s+([\w\.]+)\s+ON\s+([\w\.]+)\.([\w\.]+)\s*=\s*([\w\.]+)\.([\w\.]+)/gi;
    let joinMatch;
    while ((joinMatch = joinRegex.exec(sql)) !== null) {
        const type = (joinMatch[1] || 'INNER').toUpperCase() as any;
        const tableName = joinMatch[2];
        const alias = joinMatch[3];
        const leftTable = joinMatch[4];
        const leftCol = joinMatch[5];
        const rightTable = joinMatch[6];
        const rightCol = joinMatch[7];
        
        if (!state.tables.find(t => t.alias === alias)) {
            state.tables.push({ tableName, alias });
        }
        
        state.joins.push({
            id: `join_${Date.now()}_${state.joins.length}`,
            type,
            leftTableAlias: leftTable,
            leftColumn: leftCol,
            rightTableAlias: rightTable,
            rightColumn: rightCol
        });
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
        let currentLogic: 'AND' | 'OR' = 'AND';
        
        for (let i = 0; i < conditions.length; i++) {
            const cond = conditions[i].trim();
            if (cond.toUpperCase() === 'AND' || cond.toUpperCase() === 'OR') {
                currentLogic = cond.toUpperCase() as any;
                continue;
            }
            
            const condMatch = cond.match(/([\w\.]+)\.([\w\.]+)\s*(=|!=|>|<|>=|<=|LIKE|IN)\s*(.+)/i);
            if (condMatch) {
                state.where.push({
                    id: `where_${Date.now()}_${state.where.length}`,
                    tableAlias: condMatch[1],
                    columnName: condMatch[2],
                    operator: condMatch[3].toUpperCase() as any,
                    value: condMatch[4].trim(),
                    logic: currentLogic
                });
            }
        }
    }

    return state;
};
