# Report System (Python-Based Workflow)

This document describes the architecture, implementation, and storage of the overhauled report system.

## 1. Overview
The report system has been migrated from a legacy SQL-only approach to a powerful Python-based logic engine. This allows for complex data processing, integration with AI, and dynamic rendering.

## 2. Architecture

### 2.1 Backend Logic
- **Executor**: `ReportExecutor` (in `/backend/app/services/report_executor.py`) uses `RestrictedPython` for secure code execution.
- **Library Parity**: Reports have access to specialized internal libraries:
    - `inner_database`: Direct safe SQL access via `unsafe_request`.
    - `charts`: **[NEW]** Comprehensive plotting library (15+ types) for professional business graphics (SVG).
    - `analytics`: Usage and performance tracking.
    - `ai`: Integrated access to Gemini, OpenAI, and Perplexity.
    - `prompt_lib` / `response_lib`: Access to the platform's prompt/response system.
- **Execution Context**: A custom context resolution system ensures that `unsafe_request` correctly identifies the report creator as the data owner.

### 2.2 Rendering (Jinja2)
- Reports use **Jinja2** for HTML generation.
- **Context Aliases**: The result of the Python `GenerateReport` function is passed to the template with multiple aliases: `data`, `rows`, and `items`.
- **Dictionary Unpacking**: If the Python logic returns a dictionary, its keys are automatically available as top-level variables in the template.

## 3. Storage Structure

### 3.1 Database Models (`/backend/app/models/report.py`)
- `Report`:
    - `code`: Validated Python logic.
    - `template`: Jinja2 HTML/CSS template.
    - `schema_json`: Automatically generated JSON schema of the output data.
    - `style_id`: Link to global CSS styles.
    - `category`: Hierarchical grouping string.
- `ReportParameter`:
    - Stores input configurations.
    - Supports dynamic SQL-backed dropdowns via the `@table-name->value,label` syntax.
- `ReportRun`:
    - Audit log for every report execution.
    - Stores executor console logs for debugging.

## 4. Key Implementation Details

- **Indentation Control**: The system enforces 4-space indentation for all Python and HTML code editors to match the platform's Node Editor standards.
- **Permission Mapping**: 
    - `Admin`: Full CRUD access.
    - `Manager`: Can generate reports, edit report content (logic/template), and manage parameters.
    - `Client`: Read-only access to assigned report results.

### 6. Graphics and Visualizations (15+ Chart Types)

The system provides a built-in `charts` library specifically designed for "Business/Academic" style reports. It generates high-quality **vector SVGs** using the non-interactive `Agg` backend.

#### 6.1 Available Chart Types

| Category | Function | Sample Usage |
| :--- | :--- | :--- |
| **Comparison** | `bar`, `barh` | `charts.bar(data, x='label', y='value', stacked=True)` |
| **Evolution** | `line`, `area` | `charts.area(data, x='date', y=['v1', 'v2'], stacked=True)` |
| **Distribution** | `histogram`, `boxplot`, `violin` | `charts.violin(data, y='score', x='group')` |
| **Relationship** | `scatter`, `heatmap` | `charts.heatmap(data, x='reg', y='cat', values='val')` |
| **Specialized** | `radar`, `waterfall`, `gauge`, `funnel`, `gantt` | `charts.radar(data, labels='dim', values=['m1', 'm2'])` |

### 6.2 Implementation Checklist (Python Code)

Functions are generated within `GenerateReport` and passed to the template.

```python
def GenerateReport(report_parameters):
    # 1. Fetch data
    result = inner_database.unsafe_request("SELECT brand, win_rate, cases FROM stats")
    
    # 2. Enrich data if needed (e.g. for long labels in horizontal bars)
    for row in result:
        row['display_name'] = f"{row['brand']} (n={row['cases']})"
        
    # 3. Create chart (returns SVG string)
    # Hint: Use barh (horizontal) for long labels on Y-axis
    chart_svg = charts.barh(
        data=result,
        x='display_name',
        y='win_rate',
        title="Win Rate by Brand"
    )
    
    return {
        'data': result,
        'my_chart': chart_svg
    }, True
```

### 6.3 Template Best Practices (HTML/Jinja2)

Use the `| safe` filter and clean wrappers for professional layout.

```html
<div class="report-container" style="font-family: sans-serif; padding: 20px;">
    <h1>Performance Dashboard</h1>
    
    <!-- Chart Wrapper -->
    <div style="margin: 30px 0; background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 15px;">
        {{ my_chart | safe }}
    </div>

    <!-- Data Table -->
    <table style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr style="border-bottom: 2px solid #334155; text-align: left;">
                <th style="padding: 10px;">Brand</th>
                <th style="padding: 10px; text-align: right;">Win Rate</th>
            </tr>
        </thead>
        <tbody>
            {% for row in data %}
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px;">{{ row.brand }}</td>
                <td style="padding: 10px; text-align: right; color: #3b82f6; font-weight: bold;">
                    {{ (row.win_rate * 100) | round(1) }}%
                </td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>
```

### 6.2 Template Example (Jinja2)
To render the chart, use the `| safe` filter to inject the raw SVG.

```html
<div class="report-section">
    <h2>Performance Overview</h2>
    <div class="chart-container">
        {{ win_graph | safe }}
    </div>
</div>
```

## 7. File Manifest
- `/backend/app/routers/report.py`: API endpoints and rendering logic.
- `/backend/app/services/report_executor.py`: Sandboxed execution engine.
- `/backend/app/internal_libs/charts.py`: **[NEW]** Matplotlib-based chart wrapper.
- `/backend/app/internal_libs/database_lib.py`: Modified for report-aware resolution.
- `/frontend/src/widgets/report-management/`: UI components for the professional report editor.
