# Report System (Python-Based Workflow)

This document describes the architecture, implementation, and storage of the overhauled report system.

## 1. Overview
The report system has been migrated from a legacy SQL-only approach to a powerful Python-based logic engine. This allows for complex data processing, integration with AI, and dynamic rendering.

## 2. Architecture

### 2.1 Backend Logic
- **Executor**: `ReportExecutor` (in `/backend/app/services/report_executor.py`) uses `RestrictedPython` for secure code execution.
- **Library Parity**: Reports have access to specialized internal libraries:
    - `inner_database`: Direct safe SQL access via `unsafe_request`.
    - `charts`: **[NEW]** High-level plotting library for business graphics (SVG).
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

## 6. Graphics and Visualizations (Matplotlib-based)

The system provides a built-in `charts` library specifically designed for "Business/Academic" style reports. It generates high-quality **vector SVGs** that are perfectly suited for PDF export via WeasyPrint.

### 6.1 Python Logic Example
Graphics are generated within the `GenerateReport` function and passed to the template as SVG strings.

```python
def GenerateReport(report_parameters):
    # 1. Get processed data
    query = "SELECT brand, win_rate FROM statistics"
    result = inner_database.unsafe_request(query)
    
    # 2. Create a chart (returns SVG string)
    # Available types: bar, line, pie, area, scatter
    win_graph = charts.bar(
        data=result,
        x='brand',
        y='win_rate',
        title="Win Rate by Brand",
        theme="business", # Applies corporate styling
        color="#3b82f6"   # Optional custom accent color
    )
    
    return {
        'result': result,
        'win_graph': win_graph
    }, True
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
