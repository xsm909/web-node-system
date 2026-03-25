from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Any, Dict
import uuid
import json
import os
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
import re
import io
import csv
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

class ReportCompileResponse(BaseModel):
    success: bool
    console: str
    schema: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    validation_reason: Optional[str] = None

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

# --- Routes for Reports ---

@router.get("/", response_model=List[ReportOut])
def list_reports(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == Report.id,
        LockData.entity_type == "reports"
    ).exists()
    
    current_project_id = projects_lib.get_project_id()
    
    query = db.query(Report, is_locked_subquery.label("is_locked"))
    
    if current_project_id:
        # In project mode: see ONLY project items
        query = query.filter(Report.project_id == current_project_id)
    else:
        # Outside project mode: see ONLY general items
        query = query.filter(Report.project_id == None)
        # Also apply original role-based filters if needed, 
        # but the requirement says "либо проектные либ общие"
        if current_user.role != "admin":
             query = query.filter(Report.type == ReportTypeEnum.global_type)

    results = query.all()
    
    response = []
    for report, is_locked in results:
        report_dict = ReportOut.model_validate(report).model_dump()
        report_dict["is_locked"] = is_locked
        response.append(report_dict)
    return response

@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check access for managers
    if current_user.role != "admin" and report.type != ReportTypeEnum.global_type:
        # Assuming managers shouldn't see non-global reports unless authorized, but requirement says
        # manager just opens the report for generation.
        pass
        
    return report

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
        # delete existing parameters
        db.query(ObjectParameter).filter(
            ObjectParameter.object_id == report.id,
            ObjectParameter.object_name == "reports"
        ).delete()
        # add new
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
    """Duplicate a report along with all its parameters."""
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
        meta=report.meta,
        project_id=report.project_id,
        created_by=current_user.id,
    )
    db.add(new_report)
    db.flush()  # get new_report.id before committing

    # Duplicate all parameters
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

def _generate_report_html(report_id: uuid.UUID, params: Dict[str, Any], db: Session, user_context: Dict[str, Any] = None, for_pdf: bool = False) -> Dict[str, Any]:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Inject default values if missing
    final_params = inject_system_params(params.copy())
    for param_config in report.parameters:

        p_name = param_config.parameter_name
        if p_name not in final_params or final_params[p_name] is None or (isinstance(final_params[p_name], str) and not final_params[p_name].strip()):
            if param_config.default_value is not None:
                final_params[p_name] = param_config.default_value

    # Execute Python logic
    executor = ReportExecutor(report.code)
    exec_result = executor.execute(final_params, mode="is_run", user_context=user_context, execution_id=str(report.id))
    
    if not exec_result["success"]:
        # If it's a validation error (reason provided), we don't raise 400, but return it
        if "validation_reason" in exec_result and exec_result["validation_reason"]:
             return {
                "html": "",
                "console": exec_result.get("console", ""),
                "validation_error": exec_result["validation_reason"]
            }
        raise HTTPException(status_code=400, detail=f"Error executing Python: {exec_result.get('error', 'Unknown error')}\nConsole:\n{exec_result.get('console', '')}")

    # Jinja2 Rendering
    try:
        jinja_template = Template(report.template)
        # context: 'data', 'params', 'rows', 'items' and all keys from data if it's a dict
        data_val = exec_result["data"]
        render_context = {
            "data": data_val,
            "rows": data_val,
            "items": data_val,
            "params": final_params
        }
        if isinstance(data_val, dict):
            render_context.update(data_val)
            
        # Add debugging info to console log if success
        available_vars = list(render_context.keys())
        executor.log(f"Rendering template with variables: {', '.join(available_vars)}")
        if isinstance(data_val, list) and data_val:
            executor.log(f"Data is a list with {len(data_val)} items. Accessible via 'data', 'rows', or 'items'.")
        elif isinstance(data_val, dict):
             executor.log(f"Data is a dictionary. Keys unpacked: {', '.join(data_val.keys())}")

        rendered_html = jinja_template.render(**render_context)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error rendering template: {str(e)}")
        
    # CSS logic
    css_content = ""
    if report.style_id:
        style = db.query(ReportStyle).filter(ReportStyle.id == report.style_id).first()
        if style:
            css_content = style.css
    else:
        default_style = db.query(ReportStyle).filter(ReportStyle.is_default == True).first()
        if default_style:
             css_content = default_style.css
             
    # Base PDF CSS
    pdf_scale = exec_result.get("pdf_scale", 0.5)
    
    base_pdf_css = """
    @page {
        margin: 1.5cm;
        size: A4;
    }
    html, body {
        background-color: white !important;
        font-size: """ + ("10pt" if not for_pdf else "6pt") + """ !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        line-height: 1.3;
        color: #000 !important;
        margin: 0;
        padding: 0;
    }
    .report-container {
        width: 100%;
        background-color: white !important;
        padding: """ + ("20px" if not for_pdf else "0px") + """;
        box-sizing: border-box;
    }
    table {
        font-size: """ + ("10pt" if not for_pdf else f"{int(12 * pdf_scale)}pt") + """ !important;
        width: 100% !important;
        border-collapse: collapse;
        table-layout: auto;
    }
    th, td {
        word-break: break-all !important;
        white-space: normal !important;
    }
    img, svg {
        max-width: 100% !important;
        height: auto !important;
    }
    """
    
    if for_pdf:
        # Scale everything down to the requested scale
        base_pdf_css += f"\n    body {{ zoom: {pdf_scale} !important; }}\n"
    
    # We want to inject our base CSS and the report-specific CSS.
    if "<html" in rendered_html.lower():
        # Inject CSS into <head>
        full_css = f"<style>{base_pdf_css}\n{css_content}</style>"
        if "</head>" in rendered_html:
            final_html = rendered_html.replace("</head>", f"{full_css}\n</head>")
        else:
            final_html = f"<html><head>{full_css}</head><body>{rendered_html}</body></html>"
    else:
        final_html = f"<!DOCTYPE html><html><head><style>{base_pdf_css}\n{css_content}</style></head><body><div class='report-container'>\n{rendered_html}\n</div></body></html>"
        
    return {
        "html": final_html,
        "console": exec_result.get("console", ""),
        "validation_error": None
    }

@router.post("/{report_id}/generate", response_model=ReportGenerateResponse)
def generate_report(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    res = _generate_report_html(report_id, data.parameters, db, user_context=user_context)
    final_html = res["html"]

    # Optional: Log the report run
    run = ReportRun(
        report_id=report_id,
        executed_by=current_user.id,
        parameters_json=data.parameters, # Use original raw params for logging
        result_snapshot=None # Opting to not save full HTML to save space, but could if needed.
    )
    db.add(run)
    db.commit()

    return {
        "html": final_html,
        "console": res.get("console", ""),
        "validation_error": res.get("validation_error")
    }

@router.post("/{report_id}/pdf")
def generate_report_pdf(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    from weasyprint import HTML
    res = _generate_report_html(report_id, data.parameters, db, for_pdf=True)
    final_html = res["html"]
    
    # Convert HTML to PDF
    pdf_bytes = io.BytesIO()
    HTML(string=final_html).write_pdf(pdf_bytes)
    
    # Optional: Log the report run
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
        headers={
            "Content-Disposition": f"attachment; filename=report_{report_id}.pdf"
        }
    )

@router.post("/{report_id}/csv")
def generate_report_csv(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    # This was a snippet in the middle, but I need to make sure I don't break logic.
    # Actually, generate_report_csv calls execute directly.
    # I'll replace the lines inside it.
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    try:
        # Inject default values for consistency
        final_params = inject_system_params(data.parameters.copy())
        for param_config in report.parameters:

            p_name = param_config.parameter_name
            if p_name not in final_params or final_params[p_name] is None or (isinstance(final_params[p_name], str) and not final_params[p_name].strip()):
                if param_config.default_value is not None:
                    final_params[p_name] = param_config.default_value

        executor = ReportExecutor(report.code)
        user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
        exec_result = executor.execute(final_params, mode="is_run", user_context=user_context, execution_id=str(report.id))
        if not exec_result["success"]:
             raise HTTPException(status_code=400, detail=f"Error executing Python: {exec_result.get('error')}")
        
        data_rows = exec_result["data"]
        # Assuming data_rows is a list of dicts for CSV
        if not isinstance(data_rows, list) or (len(data_rows) > 0 and not isinstance(data_rows[0], dict)):
             raise HTTPException(status_code=400, detail="GenerateReport must return a list of dictionaries for CSV export")

        columns = data_rows[0].keys() if data_rows else []
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        writer.writerows(data_rows)
        
        # Log the report run
        run = ReportRun(
            report_id=report_id,
            executed_by=current_user.id,
            parameters_json=data.parameters,
            result_snapshot=None
        )
        db.add(run)
        db.commit()

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=report_{report.name.replace(' ', '_')}.csv"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error generating CSV: {str(e)}")

@router.post("/{report_id}/html-file")
def generate_report_html_file(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    res = _generate_report_html(report_id, data.parameters, db)
    final_html = res["html"]
    
    # Log the report run
    run = ReportRun(
        report_id=report_id,
        executed_by=current_user.id,
        parameters_json=data.parameters,
        result_snapshot=None
    )
    db.add(run)
    db.commit()

    return Response(
        content=final_html,
        media_type="text/html",
        headers={
            "Content-Disposition": f"attachment; filename=report_{report.name.replace(' ', '_')}.html"
        }
    )

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
    Please create a Jinja2 template in HTML for the following SQL query and its resulting data schema.
    
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
       - NESTED DATA (JSON-Builder Style): If the items in `rows` contain complex nested objects or arrays (e.g., `rows[0].result` or `rows[0].Models`), DO NOT use a flat table. Instead, use a **STRUCTURAL** approach:
         - Hierarchical headers (<h1>-<h3>) for categories.
         - Definition lists (<dl>) or sections for objects.
         - Nested lists (<ul>/<li>) for arrays.
    2. CLEANLINESS: The report MUST BE CLEAN AND MINIMAL. Use semantic HTML. 
    3. NO INLINE STYLES: DO NOT USE ANY INLINE CSS OR STYLE ATTRIBUTES. CSS is handled separately.
    4. DATA ACCESS: 
       - If the result is a single row with a complex JSON column (e.g., named 'result'), access it as `rows[0].result`.
       - Example for nested iteration: `{{% for model in rows[0].result.Models %}}...{{% endfor %}}`.
    5. SAFETY: Use the `default` filter for potential `None` values (e.g., `{{ item.val | default(0) }}`).

    {data.additional_info if data.additional_info else ""}
    """
    
    response_text = openai_ask_single(prompt, "gpt-4o")
    if response_text.startswith("Error:") or response_text.startswith("HTTPError"):
        raise HTTPException(status_code=500, detail=response_text)
        
    # Remove markdown code formatting if present
    template_text = response_text
    template_text = re.sub(r'^```html\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```jinja2\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```jinja\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```j2\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'```$', '', template_text, flags=re.MULTILINE)
    template_text = template_text.strip()
    
    return {"template": template_text}

@router.post("/{report_id}/compile", response_model=ReportCompileResponse)
def compile_report(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=admin_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Inject default values for testing in design mode
    test_params = {
        "user": {
            "id": "00000000-0000-0000-0000-000000000000",
            "name": "Test User",
            "email": "test@example.com",
            "role": "client"
        }
    }
    for param_config in report.parameters:
        if param_config.default_value is not None:
            # For date types, provide current date if default is empty but type is date
            val = param_config.default_value
            if not val and "date" in param_config.parameter_type:
                val = datetime.now().strftime("%Y-%m-%d")
            test_params[param_config.parameter_name] = val
        elif "date" in param_config.parameter_type:
             test_params[param_config.parameter_name] = datetime.now().strftime("%Y-%m-%d")

    test_params = inject_system_params(test_params)

    executor = ReportExecutor(report.code)
    # Use injected defaults for design mode compilation test
    user_context = {"id": str(current_user.id), "username": current_user.username, "role": str(current_user.role)}
    result = executor.execute(test_params, mode="is_design", user_context=user_context, execution_id=str(report.id))
    
    if result["success"]:
        # Generate schema from data
        try:
            schema = generate_json_schema(result["data"])
        except:
            schema = {}
            
        report.schema_json = schema
        db.commit()
        return {
            "success": True,
            "console": result["console"],
            "schema": schema,
            "validation_reason": None
        }
    else:
        return {
            "success": False,
            "console": result["console"],
            "error": result.get("error"),
            "validation_reason": result.get("validation_reason")
        }

@router.get("/{report_id}/options")
def get_report_parameter_options(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
         raise HTTPException(status_code=404, detail="Report not found")
         
    options = {}
    for param in report.parameters:
        source = param.source.strip() if param.source else ""
        if not source:
             options[param.parameter_name] = []
             continue

        try:
            if source.startswith("@"):
                # Support for @table-name->value,label
                parts = source[1:].split("->")
                table_name = parts[0]
                fields_str = parts[1] if len(parts) > 1 else "id,name"
                fields = fields_str.split(",")
                val_field = fields[0]
                lbl_field = fields[1] if len(fields) > 1 else val_field
                
                if not re.match(r'^\w+$', table_name) or not re.match(r'^\w+$', val_field) or not re.match(r'^\w+$', lbl_field):
                    options[param.parameter_name] = []
                    continue

                system_params = get_system_parameters()
                result = db.execute(text(f"SELECT {val_field}, {lbl_field} FROM {table_name} LIMIT 1000"), system_params)
                options[param.parameter_name] = [
                    {"value": str(row[0]), "label": str(row[1])} for row in [tuple(r) for r in result.fetchall()]
                ]
            elif source.lower().startswith("select"):
                system_params = get_system_parameters()
                result = db.execute(text(source), system_params)
                val_field = param.value_field or "value"
                lbl_field = param.label_field or "label"
                columns = result.keys()
                rows = [tuple(r) for r in result.fetchall()]
                
                param_options = []
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    param_options.append({
                        "value": str(row_dict.get(val_field, row[0])), 
                        "label": str(row_dict.get(lbl_field, row[1] if len(row) > 1 else row[0]))
                    })
                options[param.parameter_name] = param_options
            else:
                options[param.parameter_name] = []
        except Exception as e:
            print(f"Failed to fetch options for {param.parameter_name}: {e}")
            options[param.parameter_name] = []
            
    return options

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

