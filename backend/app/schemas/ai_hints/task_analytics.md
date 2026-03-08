# AI Task Generation Hints: Analytics

## Objective
Generate task descriptions for the "Analytics" category. These tasks are typically used to perform data analysis, identify trends, or summarize information from the system.

## Task Structure
An "Analytics" task should provide clear instructions for an AI model to follow. The output must be a JSON object containing the task content.

### Expected Output Format
```json
{
  "value": "Single string for non-multiline tasks",
  "values": ["List", "of", "strings", "for", "multiline", "tasks"]
}
```

### Context
- The system manages reports, datasets, and user queries.
- Analytics tasks often involve:
    - Summarizing recent activity.
    - Identifying anomalies in data.
    - Providing recommendations based on report output.
    - Formatting data for specialized views.

### Examples
- **Prompt:** "Analyze user retention"
  **Output:** { "value": "Analyze report 'Monthly User Retention' and identify the top 3 reasons for churn." }

- **Prompt:** "Daily sales"
  **Output:** { "values": ["Query today's sales data", "Compare with yesterday", "Highlight any drop > 5%"] }

## Rules
1. DO NOT include markdown code blocks in the output.
2. Output ONLY the JSON object.
3. Be concise and professional.
