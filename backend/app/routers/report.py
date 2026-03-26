from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Any, Dict
import uuid
import json
import os
import re
import io
import csv
import markdown2
from datetime import datetime
from ..core.database import get_db
from ..core.security import require_role, get_current_user
from ..models.user import User
from ..models.report import Report, ReportTypeEnum, ObjectParameter, ReportStyle, ReportRun
from ..models import LockData
from sqlalchemy import exists, and_
from ..core.locks import raise_if_locked, check_is_locked
from ..services.report_executor import ReportExecutor, generate_json_schema
from ..internal_libs import projects_lib
from pydantic import BaseModel
from jinja2 import Environment, meta, Template
from ..internal_libs.openai.openai_lib import openai_ask_single
from fastapi.responses import Response, StreamingResponse
from ..core.system_parameters import inject_system_params, get_system_parameters


router = APIRouter(prefix="/reports", tags=["reports"])

# Dependencies
admin_access = Depends(require_role("admin"))
manager_access = Depends(require_role("manager", "admin"))

# --- Schemas ---
from ..schemas.object_parameter import ObjectParameterBase, ObjectParameterCreate, ObjectParameterOut

class ReportStyleBase(BaseModel):
    name: str
    category: Optional[str] = None
    css: str
    is_default: bool = False

class ReportStyleCreate(ReportStyleBase):
    pass

class ReportStyleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    css: Optional[str] = None
    is_default: Optional[bool] = None

class ReportStyleOut(ReportStyleBase):
    id: uuid.UUID
    updated_at: Optional[datetime] = None
    is_locked: bool = False

    class Config:
        from_attributes = True

class ReportBase(BaseModel):
    name: str
    type: ReportTypeEnum = ReportTypeEnum.global_type
    description: Optional[str] = None
    code: str
    schema_json: Optional[Dict[str, Any]] = {}
    template: str
    style_id: Optional[uuid.UUID] = None
    category: Optional[str] = None
    order: Optional[int] = 0
    meta: Optional[Dict[str, Any]] = {}

class ReportCreate(ReportBase):
    project_id: Optional[uuid.UUID] = None
    parameters: Optional[List[ObjectParameterCreate]] = []

class ReportUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ReportTypeEnum] = None
    description: Optional[str] = None
    code: Optional[str] = None
    schema_json: Optional[Dict[str, Any]] = None
    template: Optional[str] = None
    style_id: Optional[uuid.UUID] = None
    category: Optional[str] = None
    order: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None
    parameters: Optional[List[ObjectParameterCreate]] = None

class ReportOut(ReportBase):
    id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    parameters: List[ObjectParameterOut] = []
    is_locked: bool = False

    class Config:
        from_attributes = True

class ReportGenerateRequest(BaseModel):
    parameters: Dict[str, Any] = {}

class ReportGenerateResponse(BaseModel):
    html: str
    console: Optional[str] = None
    validation_error: Optional[str] = None

class ReportReorderRequest(BaseModel):
    ids: List[uuid.UUID]

class ReportCompileResponse(BaseModel):
    success: bool
    console: str
    schema: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    validation_reason: Optional[str] = None

class ReportGroupParametersRequest(BaseModel):
    report_ids: List[uuid.UUID]

class ReportGroupGenerateRequest(BaseModel):
    report_ids: List[uuid.UUID]
    parameters: Dict[str, Any] = {}

class ReportTemplateGenerateRequest(BaseModel):
    report_id: Optional[uuid.UUID] = None
    schema_json: Optional[Dict[str, Any]] = None
    query: Optional[str] = None
    additional_info: Optional[str] = None

class ReportTemplateGenerateResponse(BaseModel):
    template: str

class ReportSQLGenerateRequest(BaseModel):
    prompt: str
    model: str = "gpt-4o"
    additional_info: Optional[str] = None

class ReportSQLGenerateResponse(BaseModel):
    query: str

class SourceTestRequest(BaseModel):
    source: str
    value_field: Optional[str] = None
    label_field: Optional[str] = None

class SourceTestResponse(BaseModel):
    options: List[Dict[str, Any]]
    error: Optional[str] = None

# --- Routes for Report Styles ---

@router.get("/styles", response_model=List[ReportStyleOut])
def list_report_styles(db: Session = Depends(get_db), _=admin_access):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == ReportStyle.id,
        LockData.entity_type == "report_styles"
    ).exists()
    
    results = db.query(ReportStyle, is_locked_subquery.label("is_locked")).all()
    
    response = []
    for style, is_locked in results:
        style_dict = ReportStyleOut.model_validate(style).model_dump()
        style_dict["is_locked"] = is_locked
        response.append(style_dict)
    return response

@router.post("/styles", response_model=ReportStyleOut)
def create_report_style(data: ReportStyleCreate, db: Session = Depends(get_db), _=admin_access):
    if data.is_default:
        db.query(ReportStyle).filter(ReportStyle.is_default == True).update({"is_default": False})
    
    style = ReportStyle(**data.model_dump())
    db.add(style)
    db.commit()
    db.refresh(style)
    
    style_dict = ReportStyleOut.model_validate(style).model_dump()
    style_dict["is_locked"] = False
    return style_dict

@router.put("/styles/{style_id}", response_model=ReportStyleOut)
def update_report_style(style_id: uuid.UUID, data: ReportStyleUpdate, db: Session = Depends(get_db), _=admin_access):
    style = db.query(ReportStyle).filter(ReportStyle.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    
    raise_if_locked(db, style_id, "report_styles")
    
    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("is_default"):
         db.query(ReportStyle).filter(ReportStyle.id != style_id, ReportStyle.is_default == True).update({"is_default": False})

    for k, v in update_data.items():
        setattr(style, k, v)
        
    db.commit()
    db.refresh(style)
    return style

@router.delete("/styles/{style_id}")
def delete_report_style(style_id: uuid.UUID, db: Session = Depends(get_db), _=admin_access):
    style = db.query(ReportStyle).filter(ReportStyle.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    
    raise_if_locked(db, style_id, "report_styles")
    
    db.delete(style)
    db.commit()
    return {"status": "deleted"}

# --- Routes for Reports (Management) ---

@router.get("/", response_model=List[ReportOut])
def list_reports(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == Report.id,
        LockData.entity_type == "reports"
    ).exists()
    
    current_project_id = projects_lib.get_project_id()
    
    query = db.query(Report, is_locked_subquery.label("is_locked"))
    
    if current_project_id:
        query = query.filter(Report.project_id == current_project_id)
    else:
        query = query.filter(Report.project_id == None)
        if current_user.role != "admin":
             query = query.filter(Report.type == ReportTypeEnum.global_type)

    query = query.order_by(Report.order.asc(), Report.name.asc())
    results = query.all()
    
    response = []
    for report, is_locked in results:
        report_dict = ReportOut.model_validate(report).model_dump()
        report_dict["is_locked"] = is_locked
        response.append(report_dict)
    return response

@router.post("/", response_model=ReportOut)
def create_report(data: ReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=admin_access):
    db_report = Report(
        **data.model_dump(exclude={"parameters", "project_id"}),
        created_by=current_user.id,
        project_id=data.project_id or projects_lib.get_project_id()
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    if data.parameters:
        for p in data.parameters:
            param = ObjectParameter(**p.model_dump(), object_id=db_report.id, object_name="reports")
            db.add(param)
        db.commit()
        db.refresh(db_report)
        
    return db_report

@router.put("/reorder")
def reorder_reports(data: ReportReorderRequest, db: Session = Depends(get_db), _=admin_access):
    """Update the order of reports based on the provided list of IDs."""
    for index, report_id in enumerate(data.ids):
        db.query(Report).filter(Report.id == report_id).update({"order": index})
    db.commit()
    return {"status": "reordered"}

# --- Routes for Reports (Grouped - LITERAL PATHS FIRST) ---

@router.post("/grouped/parameters", response_model=List[ObjectParameterOut])
def get_grouped_report_parameters(data: ReportGroupParametersRequest, db: Session = Depends(get_db), _=manager_access):
    """Returns unique union of parameters for multiple reports."""
    params_map = {}
    for rid in data.report_ids:
        report = db.query(Report).filter(Report.id == rid).first()
        if not report: continue
        for p in report.parameters:
            if p.parameter_name not in params_map:
                params_map[p.parameter_name] = p
    
    return [ObjectParameterOut.model_validate(p) for p in params_map.values()]

@router.post("/grouped/generate", response_model=ReportGenerateResponse)
def generate_grouped_report(data: ReportGroupGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    res = _generate_grouped_report_html(data.report_ids, data.parameters, db, user_context=user_context)
    
    return {
        "html": res["html"],
        "console": res.get("console", ""),
        "validation_error": res.get("validation_error")
    }

@router.post("/grouped/pdf")
def generate_grouped_report_pdf(data: ReportGroupGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    from weasyprint import HTML
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    res = _generate_grouped_report_html(data.report_ids, data.parameters, db, user_context=user_context, for_pdf=True)
    
    pdf_bytes = io.BytesIO()
    HTML(string=res["html"]).write_pdf(pdf_bytes)
    
    return Response(
        content=pdf_bytes.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=grouped_report.pdf"
        }
    )

@router.post("/grouped/csv")
def generate_grouped_report_csv(data: ReportGroupGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    """Concatenate CSV data from all reports in the group."""
    combined_rows = []
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    
    for rid in data.report_ids:
        res = _get_report_fragment(rid, data.parameters, db, user_context=user_context)
        rows = res["data"]
        if isinstance(rows, list):
            combined_rows.extend(rows)
        elif isinstance(rows, dict):
            combined_rows.append(rows)

    if not combined_rows:
         return Response(content="", media_type="text/csv")
         
    columns = combined_rows[0].keys() if isinstance(combined_rows[0], dict) else []
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    writer.writerows(combined_rows)
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=grouped_report.csv"
        }
    )

@router.post("/grouped/html-file")
def generate_grouped_report_html_file(data: ReportGroupGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    res = _generate_grouped_report_html(data.report_ids, data.parameters, db, user_context=user_context)
    
    return Response(
        content=res["html"],
        media_type="text/html",
        headers={
            "Content-Disposition": f"attachment; filename=grouped_report.html"
        }
    )

# --- Other Literal Paths ---

@router.post("/test-source", response_model=SourceTestResponse)
def test_parameter_source(data: SourceTestRequest, db: Session = Depends(get_db), _=manager_access):
    source = data.source.strip()
    if not source:
        return {"options": [], "error": None}
    
    try:
        if source.startswith("@"):
            parts = source[1:].split("->")
            table_name = parts[0]
            fields_str = parts[1] if len(parts) > 1 else "id,name"
            fields = fields_str.split(",")
            val_field = fields[0]
            lbl_field = fields[1] if len(fields) > 1 else val_field
            
            if not re.match(r'^\w+$', table_name) or not re.match(r'^\w+$', val_field) or not re.match(r'^\w+$', lbl_field):
                return {"options": [], "error": "Invalid table or field names"}

            system_params = get_system_parameters()
            result = db.execute(text(f"SELECT {val_field}, {lbl_field} FROM {table_name} LIMIT 100"), system_params)
            options = [
                {"value": str(row[0]), "label": str(row[1])} for row in [tuple(r) for r in result.fetchall()]
            ]
            return {"options": options, "error": None}
            
        elif source.lower().startswith("select"):
            system_params = get_system_parameters()
            result = db.execute(text(source), system_params)
            val_field = data.value_field or "value"
            lbl_field = data.label_field or "label"
            columns = result.keys()
            rows = [tuple(r) for r in result.fetchall()]
            
            param_options = []
            for row in rows:
                row_dict = dict(zip(columns, row))
                param_options.append({
                    "value": str(row_dict.get(val_field, row[0])), 
                    "label": str(row_dict.get(lbl_field, row[1] if len(row) > 1 else row[0]))
                })
            return {"options": param_options, "error": None}
        else:
            return {"options": [], "error": "Unknown source format"}
    except Exception as e:
        print(f"Failed to test source {source}: {e}")
        return {"options": [], "error": "Error source"}

@router.post("/generate-template", response_model=ReportTemplateGenerateResponse)
def generate_report_template(data: ReportTemplateGenerateRequest, _=manager_access):
    query_text = data.query
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    additional_context = ""
    if data.additional_info:
        additional_context = f"USER ADDITIONAL REQUIREMENTS: {data.additional_info}"
    else:
        additional_context = "If no additional requirements are provided, the report MUST BE STRICT AND MINIMAL in terms of design and formatting (clean black and white table, no fancy colors)."

    prompt = f"""
    You are an expert report template designer. 
    Please create a **FULL HTML DOCUMENT** (including `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>`) for the following SQL query and its resulting data schema.
    
    The context passed to your template will contain:
    - `rows`: A list of dictionaries representing the query result rows.
    - `data`: (Alias) Same as `rows`. You can also access the first row as `rows[0]`.

    Provide ONLY the raw template code, without any markdown formatting or explanations.
    Ensure all text in the template is in English.

    SQL Query:
    {query_text}

    Result Schema (JSON Schema):
    {json.dumps(data.schema_json, indent=2) if data.schema_json else "Not provided"}

    REPORT DESIGN GUIDELINES (CRITICAL):
    1. SELECTION OF LAYOUT:
       - FLAT DATA (Simple Rows): If the items in `rows` only contain primitive fields (strings, numbers, simple dates), USE A FLAT `<table>`.
       - NESTED DATA (JSON-Builder Style): If the items in `rows` contain complex nested objects or arrays, USE A **STRUCTURAL** approach:
         - **DOCUMENT LOGIC**: Include a main `<h1>` for the report title. Use `<section>` tags for each primary group (e.g., Topics).
         - **OUTER CONTAINER**: Inside each section, use a `<ul>` for the list of items.
         - **ITEM CARDS**: Each item (e.g., each entry in the nested query) MUST be wrapped in an `<li>`.
         - **TITLES**: Inside the `<li>`, use an `<h3>` for the primary label/question of that item.
         - **DETAILS**: Use a `<dl>` for the internal properties of that item (e.g., metadata, scores, etc.).
         - **PROPERTY LABELS**: Use `<dt>` for labels (e.g., "Field Name:") and `<dd>` for values.
         - **MARKDOWN**: Always wrap fields that likely contain narrative text or AI responses in `<md>...</md>` tags for rich text rendering.
         - **DEEP NESTING**: Write nested loops and paths to traverse the ENTIRE hierarchy provided in the schema. Dig as deep as needed.
         - **INTERACTIVITY (STRUCTURAL ONLY)**:
           - The report must be interactive. Clicking a header (`<h2>` or `<h3>`) must toggle the visibility of the content following it (`<ul>` or `<dl>`).
           - By default, all content is **expanded**.
           - Add a small `<script>` at the end of `<body>`:
             - Attach click listeners to all `h2` and `h3` elements.
             - Define global `window.expandAll()` and `window.collapseAll()` functions that find all collapsible content and toggle visibility.
             - **MESSAGE LISTENER**: Add `window.addEventListener('message', (e) => {{ if (e.data === 'expandAll') window.expandAll(); if (e.data === 'collapseAll') window.collapseAll(); }});` to allow control from the parent UI.
           - Add a `<style>` block in `<head>`:
             - Mark headers with `cursor: pointer; user-select: none;`.
             - Use a `.hidden` class to hide content.
             - **CRITICAL**: Use `@media print {{ .hidden {{ display: block !important; }} }}` so PDF exports are always fully expanded.
    2. CLEANLINESS: The report MUST BE CLEAN AND MINIMAL. Use semantic HTML. 
    3. NO INLINE STYLES: DO NOT USE ANY INLINE CSS OR STYLE ATTRIBUTES. CSS is handled separately.
    4. DATA ACCESS (IMPORTANT): 
       - If the result is a single row with a complex JSON column (e.g., named 'result'), access it as `rows[0].result`.
       - **RESERVED NAMES**: Jinja2 uses `.items`, `.keys`, and `.values` as built-in dictionary methods. If the schema contains fields with these names (e.g. `row.items`), YOU MUST USE BRACKET NOTATION: `{{{{ row['items'] }}}}` or `{{% for x in row['items'] %}}`. 
       - Example for nested iteration with reserved names: `{{% for model in rows[0]['result']['Models'] %}}...{{% endfor %}}`.
    5. SAFETY: Use the `default` filter for potential `None` values (e.g., `{{{{ item.val | default(0) }}}}`).
    6. MARKDOWN SUPPORT: If a field contains Markdown content (e.g., from an AI response), you can render it in two ways:
       - Wrap it in a tag: `<md>{{{{ item.markdown_field | default('') }}}}</md>`
       - Use a filter: `{{{{ item.markdown_field | markdown | default('') }}}}` (Note: The tag is preferred for complex multi-line blocks).

    {data.additional_info if data.additional_info else ""}
    """
    
    response_text = openai_ask_single(prompt, "gpt-4o")
    if response_text.startswith("Error:") or response_text.startswith("HTTPError"):
        raise HTTPException(status_code=500, detail=response_text)
        
    template_text = response_text
    template_text = re.sub(r'^```html\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```jinja2\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```jinja\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```j2\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'```$', '', template_text, flags=re.MULTILINE)
    template_text = template_text.strip()
    
    return {"template": template_text}

# --- Helper Functions ---

def _scope_css(css: str, scope_id: str) -> str:
    """Very basic CSS scoping by prefixing selectors with an ID."""
    if not css.strip():
        return ""
    
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)
    parts = []
    for chunk in re.split(r'({[^}]*})', css):
        if not chunk.strip():
            continue
        if chunk.startswith('{'):
            parts.append(chunk)
        else:
            selectors = chunk.split(',')
            scoped_selectors = []
            for sel in selectors:
                sel = sel.strip()
                if not sel: continue
                if sel.startswith('@'):
                    scoped_selectors.append(sel)
                else:
                    scoped_selectors.append(f"#{scope_id} {sel}")
            parts.append(", ".join(scoped_selectors))
            
    return "\n".join(parts)

def _get_report_fragment(report_id: uuid.UUID, params: Dict[str, Any], db: Session, user_context: Dict[str, Any] = None) -> Dict[str, Any]:
    """Generates the HTML fragment and CSS for a single report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    final_params = inject_system_params(params.copy())
    for param_config in report.parameters:
        p_name = param_config.parameter_name
        if p_name not in final_params or final_params[p_name] is None or (isinstance(final_params[p_name], str) and not final_params[p_name].strip()):
            if param_config.default_value is not None:
                final_params[p_name] = param_config.default_value

    executor = ReportExecutor(report.code)
    exec_result = executor.execute(final_params, mode="is_run", user_context=user_context, execution_id=str(report.id))
    
    if not exec_result["success"]:
        if "validation_reason" in exec_result and exec_result["validation_reason"]:
             return {
                "fragment": "",
                "css": "",
                "console": exec_result.get("console", ""),
                "validation_error": exec_result["validation_reason"],
                "data": None
            }
        raise HTTPException(status_code=400, detail=f"Error executing Python for '{report.name}': {exec_result.get('error', 'Unknown error')}\nConsole:\n{exec_result.get('console', '')}")

    try:
        env = Environment()
        def jinja_markdown_filter(text):
            if not text: return ""
            return markdown2.markdown(str(text), extras=["tables", "fenced-code-blocks", "task_list"]).strip()
        env.filters['markdown'] = jinja_markdown_filter
        
        jinja_template = env.from_string(report.template)
        data_val = exec_result["data"]
        render_context = {
            "data": data_val,
            "rows": data_val,
            "items": data_val,
            "params": final_params
        }
        if isinstance(data_val, dict):
            render_context.update(data_val)
            
        rendered_html = jinja_template.render(**render_context)
        
        if '<md>' in rendered_html:
            def md_replacer(match):
                return markdown2.markdown(match.group(1), extras=["tables", "fenced-code-blocks", "task_list"]).strip()
            rendered_html = re.sub(r'<md>(.*?)</md>', md_replacer, rendered_html, flags=re.DOTALL)
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error rendering template for '{report.name}': {str(e)}")
        
    css_content = ""
    if report.style_id:
        style = db.query(ReportStyle).filter(ReportStyle.id == report.style_id).first()
        if style: css_content = style.css
    else:
        default_style = db.query(ReportStyle).filter(ReportStyle.is_default == True).first()
        if default_style: css_content = default_style.css
             
    return {
        "fragment": rendered_html,
        "css": css_content,
        "console": exec_result.get("console", ""),
        "validation_error": None,
        "data": data_val,
        "pdf_scale": exec_result.get("pdf_scale", 0.5)
    }

def _generate_report_html(report_id: uuid.UUID, params: Dict[str, Any], db: Session, user_context: Dict[str, Any] = None, for_pdf: bool = False) -> Dict[str, Any]:
    res = _get_report_fragment(report_id, params, db, user_context=user_context)
    if res["validation_error"]:
        return {
            "html": "",
            "console": res["console"],
            "validation_error": res["validation_error"]
        }
    
    rendered_html = res["fragment"]
    css_content = res["css"]
    pdf_scale = res["pdf_scale"]
    
    base_pdf_css = f"""
    @page {{ margin: 1.5cm; size: A4; }}
    html, body {{
        background-color: white !important;
        font-size: {"10pt" if not for_pdf else "6pt"} !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        line-height: 1.3;
        color: #000 !important;
        margin: 0; padding: 0;
    }}
    .report-container {{
        width: 100%;
        background-color: white !important;
        padding: {"20px" if not for_pdf else "0px"};
        box-sizing: border-box;
    }}
    table {{
        font-size: {"10pt" if not for_pdf else f"{int(12 * pdf_scale)}pt"} !important;
        width: 100% !important;
        border-collapse: collapse;
        table-layout: auto;
    }}
    th, td {{ word-break: break-all !important; white-space: normal !important; }}
    img, svg {{ max-width: 100% !important; height: auto !important; }}
    """
    
    if for_pdf:
        base_pdf_css += f"\n    body {{ zoom: {pdf_scale} !important; }}\n"
    
    if "<html" in rendered_html.lower():
        full_css = f"<style>{base_pdf_css}\n{css_content}</style>"
        if "</head>" in rendered_html:
            final_html = rendered_html.replace("</head>", f"{full_css}\n</head>")
        else:
            final_html = f"<html><head>{full_css}</head><body>{rendered_html}</body></html>"
    else:
        final_html = f"<!DOCTYPE html><html><head><style>{base_pdf_css}\n{css_content}</style></head><body><div class='report-container'>\n{rendered_html}\n</div></body></html>"
        
    return {
        "html": final_html,
        "console": res["console"],
        "validation_error": None
    }

def _generate_grouped_report_html(report_ids: List[uuid.UUID], params: Dict[str, Any], db: Session, user_context: Dict[str, Any] = None, for_pdf: bool = False) -> Dict[str, Any]:
    fragments = []
    css_blocks = []
    full_console = []
    
    for rid in report_ids:
        try:
            res = _get_report_fragment(rid, params, db, user_context=user_context)
            if res["validation_error"]:
                return {
                    "html": "",
                    "console": "\n".join(full_console) + "\n" + res["console"],
                    "validation_error": f"Report {rid} Validation: {res['validation_error']}"
                }
            
            scope_id = f"rb-{str(rid).replace('-', '')}"
            scoped_fragment = f"<div class='report-block' id='{scope_id}'>\n{res['fragment']}\n</div>"
            scoped_css = _scope_css(res["css"], scope_id)
            
            fragments.append(scoped_fragment)
            css_blocks.append(scoped_css)
            full_console.append(f"--- Report {rid} ---\n{res['console']}")
            
        except HTTPException as e:
             raise e
        except Exception as e:
            full_console.append(f"Error generating report {rid}: {str(e)}")
            continue

    base_pdf_css = f"""
    @page {{ margin: 1.5cm; size: A4; }}
    html, body {{
        background-color: white !important;
        font-size: {"10pt" if not for_pdf else "6pt"} !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        line-height: 1.3;
        color: #000 !important;
        margin: 0; padding: 0;
    }}
    .report-container {{
        width: 100%;
        background-color: white !important;
        padding: {"20px" if not for_pdf else "0px"};
        box-sizing: border-box;
    }}
    .report-block {{ margin-bottom: 2rem; }}
    table {{
        font-size: {"10pt" if not for_pdf else "6pt"} !important;
        width: 100% !important;
        border-collapse: collapse;
        table-layout: auto;
    }}
    th, td {{ word-break: break-all !important; white-space: normal !important; }}
    img, svg {{ max-width: 100% !important; height: auto !important; }}
    """
    
    combined_css = "\n".join(css_blocks)
    combined_html = "\n".join(fragments)
    final_html = f"<!DOCTYPE html><html><head><style>{base_pdf_css}\n{combined_css}</style></head><body><div class='report-container'>\n{combined_html}\n</div></body></html>"
    
    return {
        "html": final_html,
        "console": "\n".join(full_console),
        "validation_error": None
    }

# --- Routes for Reports (PARAMETERIZED PATHS LAST) ---

@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@router.put("/{report_id}", response_model=ReportOut)
def update_report(report_id: uuid.UUID, data: ReportUpdate, db: Session = Depends(get_db), _=admin_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    raise_if_locked(db, report_id, "reports")
        
    update_data = data.model_dump(exclude_unset=True, exclude={"parameters"})
    for k, v in update_data.items():
        setattr(report, k, v)
        
    if data.parameters is not None:
        db.query(ObjectParameter).filter(
            ObjectParameter.object_id == report.id,
            ObjectParameter.object_name == "reports"
        ).delete()
        for p in data.parameters:
            param_data = p.model_dump()
            param = ObjectParameter(**param_data, object_id=report.id, object_name="reports")
            db.add(param)
            
    db.commit()
    db.refresh(report)
    
    is_locked = db.query(exists().where(and_(
        LockData.entity_id == report_id,
        LockData.entity_type == "reports"
    ))).scalar()
    
    report_dict = ReportOut.model_validate(report).model_dump()
    report_dict["is_locked"] = is_locked
    return report_dict

@router.delete("/{report_id}")
def delete_report(report_id: uuid.UUID, db: Session = Depends(get_db), _=admin_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    raise_if_locked(db, report_id, "reports")
    db.delete(report)
    db.commit()
    return {"status": "deleted"}

@router.post("/{report_id}/duplicate", response_model=ReportOut)
def duplicate_report(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=admin_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    new_report = Report(
        name=f"{report.name} (Copy)",
        type=report.type,
        description=report.description,
        code=report.code,
        schema_json=report.schema_json,
        template=report.template,
        style_id=report.style_id,
        category=report.category,
        order=report.order,
        meta=report.meta,
        project_id=report.project_id,
        created_by=current_user.id,
    )
    db.add(new_report)
    db.flush()

    for param in report.parameters:
        new_param = ObjectParameter(
            object_id=new_report.id,
            object_name="reports",
            parameter_name=param.parameter_name,
            parameter_type=param.parameter_type,
            default_value=param.default_value,
            source=param.source,
            value_field=param.value_field,
            label_field=param.label_field,
        )
        db.add(new_param)

    db.commit()
    db.refresh(new_report)
    new_report_dict = ReportOut.model_validate(new_report).model_dump()
    new_report_dict["is_locked"] = False
    return new_report_dict

@router.post("/{report_id}/generate", response_model=ReportGenerateResponse)
def generate_report(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    res = _generate_report_html(report_id, data.parameters, db, user_context=user_context)
    
    run = ReportRun(
        report_id=report_id,
        executed_by=current_user.id,
        parameters_json=data.parameters,
        result_snapshot=None
    )
    db.add(run)
    db.commit()
    return {
        "html": res["html"],
        "console": res.get("console", ""),
        "validation_error": res.get("validation_error")
    }

@router.post("/{report_id}/pdf")
def generate_report_pdf(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    from weasyprint import HTML
    res = _generate_report_html(report_id, data.parameters, db, for_pdf=True)
    pdf_bytes = io.BytesIO()
    HTML(string=res["html"]).write_pdf(pdf_bytes)
    
    run = ReportRun(
        report_id=report_id,
        executed_by=current_user.id,
        parameters_json=data.parameters,
        result_snapshot=None
    )
    db.add(run)
    db.commit()
    return Response(
        content=pdf_bytes.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{report_id}.pdf"}
    )

@router.post("/{report_id}/csv")
def generate_report_csv(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    res = _get_report_fragment(report_id, data.parameters, db, user_context=user_context)
    if res["validation_error"]: raise HTTPException(status_code=400, detail=res["validation_error"])
         
    data_rows = res["data"]
    if not isinstance(data_rows, list) or (len(data_rows) > 0 and not isinstance(data_rows[0], dict)):
         raise HTTPException(status_code=400, detail="GenerateReport must return a list of dictionaries for CSV export")

    columns = data_rows[0].keys() if data_rows else []
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    writer.writerows(data_rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{report_id}.csv"}
    )

@router.post("/{report_id}/html-file")
def generate_report_html_file(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    res = _generate_report_html(report_id, data.parameters, db)
    run = ReportRun(
        report_id=report_id,
        executed_by=current_user.id,
        parameters_json=data.parameters,
        result_snapshot=None
    )
    db.add(run)
    db.commit()
    return Response(
        content=res["html"],
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=report_{report_id}.html"}
    )

@router.post("/{report_id}/compile", response_model=ReportCompileResponse)
def compile_report(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=admin_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report: raise HTTPException(status_code=404, detail="Report not found")
    
    test_params = {"user": {"id": str(current_user.id), "name": current_user.username, "role": str(current_user.role)}}
    for param_config in report.parameters:
        if param_config.default_value is not None:
            val = param_config.default_value
            if not val and "date" in param_config.parameter_type: val = datetime.now().strftime("%Y-%m-%d")
            test_params[param_config.parameter_name] = val
        elif "date" in param_config.parameter_type:
             test_params[param_config.parameter_name] = datetime.now().strftime("%Y-%m-%d")

    test_params = inject_system_params(test_params)
    executor = ReportExecutor(report.code)
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    result = executor.execute(test_params, mode="is_design", user_context=user_context, execution_id=str(report.id))
    
    if result["success"]:
        try: schema = generate_json_schema(result["data"])
        except: schema = {}
        report.schema_json = schema
        db.commit()
        return {"success": True, "console": result["console"], "schema": schema}
    else:
        return {"success": False, "console": result["console"], "error": result.get("error"), "validation_reason": result.get("validation_reason")}

@router.get("/{report_id}/options")
def get_report_parameter_options(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report: raise HTTPException(status_code=404, detail="Report not found")
    options = {}
    for param in report.parameters:
        source = param.source.strip() if param.source else ""
        if not source:
             options[param.parameter_name] = []
             continue
        try:
            if source.startswith("@"):
                parts = source[1:].split("->")
                table_name, fields_str = parts[0], parts[1] if len(parts) > 1 else "id,name"
                fields = fields_str.split(",")
                val_field, lbl_field = fields[0], fields[1] if len(fields) > 1 else fields[0]
                if not re.match(r'^\w+$', table_name) or not re.match(r'^\w+$', val_field) or not re.match(r'^\w+$', lbl_field):
                    options[param.parameter_name] = []
                    continue
                result = db.execute(text(f"SELECT {val_field}, {lbl_field} FROM {table_name} LIMIT 1000"), get_system_parameters())
                options[param.parameter_name] = [{"value": str(row[0]), "label": str(row[1])} for row in result.fetchall()]
            elif source.lower().startswith("select"):
                result = db.execute(text(source), get_system_parameters())
                val_field, lbl_field = param.value_field or "value", param.label_field or "label"
                columns = result.keys()
                options[param.parameter_name] = [{"value": str(row_dict.get(val_field, row[0])), "label": str(row_dict.get(lbl_field, row[1] if len(row) > 1 else row[0]))} for row in result.fetchall() for row_dict in [dict(zip(columns, row))]]
            else: options[param.parameter_name] = []
        except Exception as e:
            print(f"Error fetching options: {e}")
            options[param.parameter_name] = []
    return options
