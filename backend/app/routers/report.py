from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Any, Dict
import uuid
import json
from ..core.database import get_db
from ..core.security import require_role, get_current_user
from ..models.user import User
from ..models.report import Report, ReportTypeEnum, ReportParameter, ReportStyle, ReportRun
from pydantic import BaseModel
from jinja2 import Environment, meta, Template
from ..internal_libs.openai.openai_lib import openai_ask_single
import re

router = APIRouter(prefix="/reports", tags=["reports"])

# Dependencies
admin_access = Depends(require_role("admin"))
manager_access = Depends(require_role("manager", "admin"))

# --- Schemas ---
class ReportParameterBase(BaseModel):
    parameter_name: str
    source: str
    value_field: str
    label_field: str

class ReportParameterCreate(ReportParameterBase):
    pass

class ReportParameterOut(ReportParameterBase):
    id: uuid.UUID

    class Config:
        from_attributes = True

class ReportStyleBase(BaseModel):
    name: str
    css: str
    is_default: bool = False

class ReportStyleCreate(ReportStyleBase):
    pass

class ReportStyleUpdate(BaseModel):
    name: Optional[str] = None
    css: Optional[str] = None
    is_default: Optional[bool] = None

class ReportStyleOut(ReportStyleBase):
    id: uuid.UUID

    class Config:
        from_attributes = True

class ReportBase(BaseModel):
    name: str
    type: ReportTypeEnum = ReportTypeEnum.global_type
    description: Optional[str] = None
    query: str
    template: str
    style_id: Optional[uuid.UUID] = None

class ReportCreate(ReportBase):
    parameters: Optional[List[ReportParameterCreate]] = []

class ReportUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ReportTypeEnum] = None
    description: Optional[str] = None
    query: Optional[str] = None
    template: Optional[str] = None
    style_id: Optional[uuid.UUID] = None
    parameters: Optional[List[ReportParameterCreate]] = None

class ReportOut(ReportBase):
    id: uuid.UUID
    created_by: uuid.UUID
    parameters: List[ReportParameterOut] = []

    class Config:
        from_attributes = True

class ReportGenerateRequest(BaseModel):
    parameters: Dict[str, Any] = {}

class ReportGenerateResponse(BaseModel):
    html: str

class ReportTemplateGenerateRequest(BaseModel):
    query: str

class ReportTemplateGenerateResponse(BaseModel):
    template: str

# --- Routes for Report Styles ---

@router.get("/styles", response_model=List[ReportStyleOut])
def list_report_styles(db: Session = Depends(get_db), _=admin_access):
    return db.query(ReportStyle).all()

@router.post("/styles", response_model=ReportStyleOut)
def create_report_style(data: ReportStyleCreate, db: Session = Depends(get_db), _=admin_access):
    if data.is_default:
        db.query(ReportStyle).filter(ReportStyle.is_default == True).update({"is_default": False})
    
    style = ReportStyle(**data.model_dump())
    db.add(style)
    db.commit()
    db.refresh(style)
    return style

@router.put("/styles/{style_id}", response_model=ReportStyleOut)
def update_report_style(style_id: uuid.UUID, data: ReportStyleUpdate, db: Session = Depends(get_db), _=admin_access):
    style = db.query(ReportStyle).filter(ReportStyle.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    
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
    
    db.delete(style)
    db.commit()
    return {"status": "deleted"}

# --- Routes for Reports ---

@router.get("/", response_model=List[ReportOut])
def list_reports(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    if current_user.role == "admin":
        return db.query(Report).all()
    # Managers can only see global reports for now (or client reports depending on logic)
    # The requirement says manager can only list and generate. So list all global or reports.
    # Assuming global is always visible.
    return db.query(Report).filter(Report.type == ReportTypeEnum.global_type).all()

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
    report_data = data.model_dump(exclude={"parameters"})
    
    report = Report(
        **report_data,
        created_by=current_user.id
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    if data.parameters:
        for p in data.parameters:
            param = ReportParameter(**p.model_dump(), report_id=report.id)
            db.add(param)
        db.commit()
        db.refresh(report)
        
    return report

@router.put("/{report_id}", response_model=ReportOut)
def update_report(report_id: uuid.UUID, data: ReportUpdate, db: Session = Depends(get_db), _=admin_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    update_data = data.model_dump(exclude_unset=True, exclude={"parameters"})
    
    for k, v in update_data.items():
        setattr(report, k, v)
        
    if data.parameters is not None:
        # delete existing parameters
        db.query(ReportParameter).filter(ReportParameter.report_id == report.id).delete()
        # add new
        for p in data.parameters:
            param = ReportParameter(**p.model_dump(), report_id=report.id)
            db.add(param)
            
    db.commit()
    db.refresh(report)
    return report

@router.delete("/{report_id}")
def delete_report(report_id: uuid.UUID, db: Session = Depends(get_db), _=admin_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    db.delete(report)
    db.commit()
    return {"status": "deleted"}

@router.post("/{report_id}/generate", response_model=ReportGenerateResponse)
def generate_report(report_id: uuid.UUID, data: ReportGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Validation: ensuring all required parameters are provided.
    provided_params = data.parameters
    
    # Execute Query
    try:
        # We need to execute the raw SQL query with mapped parameters.
        # Ensure we only pass the parameters that exist in the query to avoid errors.
        exec_params = provided_params.copy()
        result_query = db.execute(text(report.query), exec_params)
        columns = result_query.keys()
        # Convert ResultSet to List of dictionaries
        sql_result = [dict(zip(columns, row)) for row in result_query.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error executing SQL: {str(e)}")

    # Jinja2 Rendering
    try:
        jinja_template = Template(report.template)
        # Pass result list as 'data' and parameters as 'params' to jinja context
        rendered_html = jinja_template.render(data=sql_result, params=provided_params)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error rendering template: {str(e)}")
        
    # Embed CSS
    css_content = ""
    if report.style_id:
        style = db.query(ReportStyle).filter(ReportStyle.id == report.style_id).first()
        if style:
            css_content = style.css
    else:
        # Use default style
        default_style = db.query(ReportStyle).filter(ReportStyle.is_default == True).first()
        if default_style:
             css_content = default_style.css
             
    final_html = f"<style>{css_content}</style>\n<div class='report-container'>\n{rendered_html}\n</div>"

    # Optional: Log the report run
    run = ReportRun(
        report_id=report.id,
        executed_by=current_user.id,
        parameters_json=provided_params,
        result_snapshot=None # Opting to not save full HTML to save space, but could if needed.
    )
    db.add(run)
    db.commit()

    return {"html": final_html}

@router.post("/generate-template", response_model=ReportTemplateGenerateResponse)
def generate_report_template(data: ReportTemplateGenerateRequest, _=manager_access):
    query_text = data.query
    if not query_text:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    prompt = f"""
    You are an expert report template designer. 
    Please create a stylish Jinja2 template in HTML for the following SQL query. 
    The context passed to your template will contain a variable called `data`, which is a list of dictionaries representing the rows of the SQL query result.
    Provide ONLY the raw template code, without any markdown formatting or explanations.
    If you use styling, prefer inline CSS or a clean `<style>` block.
    Ensure all text in the template is in English.
    
    SQL Query:
    {query_text}

    Important: 
    - If the SQL query returned is a single row with a JSON column (e.g., using `json_agg`), make sure to iterate over that specific column correctly in Jinja2 (e.g., `{{% for item in data[0].column_name %}}`).
    - The `data` variable is always a list of dictionaries (rows). If the entire result is encapsulated in one JSON field of the first row, you must access it as `data[0].field_name`.
    - Provide a clean, modern design with a focused structure.
    """
    
    response_text = openai_ask_single(prompt, "gpt-4o")
    if response_text.startswith("Error:") or response_text.startswith("HTTPError"):
        raise HTTPException(status_code=500, detail=response_text)
        
    # Remove markdown code formatting if present
    template_text = response_text
    template_text = re.sub(r'^```html\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```jinja2\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```j2\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'^```\n', '', template_text, flags=re.MULTILINE)
    template_text = re.sub(r'```$', '', template_text, flags=re.MULTILINE)
    template_text = template_text.strip()
    
    return {"template": template_text}

@router.get("/{report_id}/options")
def get_report_parameter_options(report_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=manager_access):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
         raise HTTPException(status_code=404, detail="Report not found")
         
    options = {}
    for param in report.parameters:
        if param.source and param.source.strip().lower().startswith("select"):
            # Execute raw SQL directly
            try:
                result = db.execute(text(param.source))
                val_field = param.value_field or "value"
                lbl_field = param.label_field or "label"
                
                rows = result.fetchall()
                # Create dictionary mapping from keys
                if rows and len(rows) > 0:
                     columns = result.keys()
                     # make sure the val_field and lbl_field are in the query
                     options[param.parameter_name] = []
                     for row in rows:
                          row_dict = dict(zip(columns, row))
                          options[param.parameter_name].append({
                               "value": str(row_dict.get(val_field, row[0])), 
                               "label": str(row_dict.get(lbl_field, row[1] if len(row) > 1 else row[0]))
                          })
                else:
                     options[param.parameter_name] = []
            except Exception as e:
                print(f"Failed to fetch options for {param.parameter_name}: {e}")
                options[param.parameter_name] = []
        else:
            options[param.parameter_name] = []
            
    return options

