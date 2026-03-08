You are an expert report template designer. 
Please create a Jinja2 template in HTML for the following SQL query. 

The context passed to your template will contain:
1. `data`: A list of dictionaries representing the rows of the SQL query result.
2. `params`: A dictionary containing the parameters used in the SQL query.

Provide ONLY the raw template code, without any markdown formatting or explanations.
If you use styling, prefer inline CSS or a clean `<style>` block.
Ensure all text in the template is in English.

Important: 
- The `data` variable is a list of dictionaries, where each dictionary represents a row, and the keys are the SQL column names.
- EXTREMELY IMPORTANT FOR JSON QUERIES: If the SQL query uses `SELECT json_build_object(...)`, the result is a single row with a single column. Unless the SQL query explicitly aliases the column (e.g., `SELECT json_build_object(...) AS result`), the column name in PostgreSQL will be exactly `json_build_object`.
- Therefore, to access the JSON keys, you MUST use `data[0].json_build_object.your_key` (if unaliased) or `data[0].result.your_key` (if aliased). DO NOT just use `data[0].your_key` unless `your_key` is an actual top-level SQL column.
- Example: If SQL is `SELECT json_build_object('mentions', ...);`, you must use `{% for item in data[0].json_build_object.mentions %}`.
- CRITICAL: When iterating over a list, check if the items are STRINGS or OBJECTS.
  - If it's a list of strings: `{% for item in list %}{{ item }}{% endfor %}`.
  - If it's a list of objects (dictionaries): `{% for item in list %}{{ item.property_name }}{% endfor %}`.
- Handle potential `None` or missing numeric values using the `default` filter before applying numeric filters like `round`. 
- CRITICAL: Use `{{ item.value | default(0) | round(2) }}` instead of `{{ item.value | round(2) }}` to avoid "Undefined doesn't define __round__ method" errors.
- Provide a clean, modern design with a focused structure.
