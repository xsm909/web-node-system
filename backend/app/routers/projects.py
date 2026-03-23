from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from ..core.database import get_db
from ..core.security import require_role
from ..models.project import Project
from ..schemas.project import ProjectCreate, ProjectUpdate, ProjectOut
from ..core.locks import raise_if_locked, check_is_locked

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("", response_model=List[ProjectOut])
def list_projects(
    owner_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_role("admin"))
):
    query = db.query(Project)
    if owner_id:
        query = query.filter(Project.owner_id == owner_id)
    
    projects = query.all()
    results = []
    for p in projects:
        is_locked = check_is_locked(db, p.id, "projects")
        p_dict = ProjectOut.model_validate(p).model_dump()
        p_dict["is_locked"] = is_locked
        results.append(p_dict)
    return results

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin"))
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    is_locked = check_is_locked(db, project_id, "projects")
    project_dict = ProjectOut.model_validate(project).model_dump()
    project_dict["is_locked"] = is_locked
    return project_dict

@router.post("", response_model=ProjectOut)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin"))
):
    project = Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return {**ProjectOut.model_validate(project).model_dump(), "is_locked": False}

@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin"))
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    raise_if_locked(db, project_id, "projects")
    
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(project, k, v)
    
    db.commit()
    db.refresh(project)
    is_locked = check_is_locked(db, project_id, "projects")
    return {**ProjectOut.model_validate(project).model_dump(), "is_locked": is_locked}

@router.delete("/{project_id}")
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin"))
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    raise_if_locked(db, project_id, "projects")
    
    db.delete(project)
    db.commit()
    return {"status": "deleted"}
