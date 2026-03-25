import { parseSQL } from './sqlParser';

const sql = `/* JSON_BUILDER_STATE: [] */
WITH meta AS (
    SELECT * FROM users
)
SELECT * FROM meta`;

try {
    const state = parseSQL(sql);
    console.log('Resulting state:');
    console.log('Main Query Tables:', state.mainQuery.tables);
    console.log('CTEs count:', state.ctes.length);
    
    if (state.ctes.length === 0 && state.mainQuery.tables[0]?.tableName === 'meta') {
        console.log('BUG REPRODUCED: CTEs were not parsed because of leading comment.');
    } else {
        console.log('Bug not reproduced or already fixed.');
    }
} catch (e) {
    console.error('Error during parsing:', e);
}
