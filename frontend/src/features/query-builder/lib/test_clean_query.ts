
import { parseSQL } from './sqlParser';

const cleanQuery = `
WITH "metad" AS (
      SELECT "users"."id", "users"."username", "metadata"."data", "metadata"."order"
      FROM "users" AS "users"
      INNER JOIN "metadata" AS "metadata" ON "users"."id" = "metadata"."entity_id"
)
SELECT "metad"."id", "metad"."username", "metad"."data", "metad"."order"
FROM "metad" AS "metad"
`;

console.log("Parsing clean query...");
try {
    const state = parseSQL(cleanQuery);

    console.log("CTEs Count:", state.ctes.length);
    if (state.ctes.length > 0) {
        console.log("First CTE alias:", state.ctes[0].alias);
        console.log("First CTE tables:", JSON.stringify(state.ctes[0].state.tables, null, 2));
    }

    console.log("Main Query Tables:", JSON.stringify(state.mainQuery.tables, null, 2));
} catch (e) {
    console.error("Parse failed:", e);
}
