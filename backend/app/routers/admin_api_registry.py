from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from uuid import UUID

from ..core.database import get_db
from ..models.api_registry import ApiRegistry as ApiRegistryModel
from ..models.lock import LockData
from ..schemas.api_registry import ApiRegistry, ApiRegistryCreate, ApiRegistryUpdate

router = APIRouter(prefix="/admin/api-registry", tags=["api-registry"])

@router.get("/", response_model=List[ApiRegistry])
def list_api_registry(
    project_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(ApiRegistryModel, LockData.id.isnot(None).label("is_locked")) \
            .outerjoin(LockData, and_(
                LockData.entity_id == ApiRegistryModel.id,
                LockData.entity_type == "api_registry"
            ))
            
        if project_id:
            query = query.filter(ApiRegistryModel.project_id == project_id)
        else:
            query = query.filter(ApiRegistryModel.project_id == None)
            
        results = query.all()
        
        response = []
        for api, is_locked in results:
            api_dict = ApiRegistry.model_validate(api).model_dump()
            api_dict["is_locked"] = is_locked
            response.append(api_dict)
        return response
    except Exception as e:
        print(f"DEBUG Error in list_api_registry: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ApiRegistry)
def create_api_registry(api_in: ApiRegistryCreate, db: Session = Depends(get_db)):
    try:
        # Check for existing name
        existing = db.query(ApiRegistryModel).filter(ApiRegistryModel.name == api_in.name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"API with name '{api_in.name}' already exists")
            
        # Safely extract data, filtering for only keys that exist in the SQLAlchemy model
        data = api_in.model_dump()
        model_columns = {c.key for c in ApiRegistryModel.__table__.columns}
        filtered_data = {k: v for k, v in data.items() if k in model_columns}
        
        db_obj = ApiRegistryModel(**filtered_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        # Explicitly validate and return the schema-ready object
        # This handles potential JSON serialization issues on the return trip
        return ApiRegistry.model_validate(db_obj)
    except Exception as e:
        print(f"DEBUG Error in create_api_registry: {str(e)}")
        import traceback
        traceback.print_exc()
        # If it's already an HTTPException, re-raise it
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Database error during API creation: {str(e)}")

@router.patch("/{api_id}/", response_model=ApiRegistry)
def update_api_registry(api_id: UUID, api_in: ApiRegistryUpdate, db: Session = Depends(get_db)):
    try:
        db_obj = db.query(ApiRegistryModel).filter(ApiRegistryModel.id == api_id).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="API not found")
        
        update_data = api_in.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"] != db_obj.name:
            existing = db.query(ApiRegistryModel).filter(ApiRegistryModel.name == update_data["name"]).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"API with name '{update_data['name']}' already exists")
                
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db.commit()
        db.refresh(db_obj)
        return ApiRegistry.model_validate(db_obj)
    except Exception as e:
        print(f"DEBUG Error in update_api_registry: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database error during API update: {str(e)}")

@router.delete("/{api_id}/")
def delete_api_registry(api_id: UUID, db: Session = Depends(get_db)):
    try:
        db_obj = db.query(ApiRegistryModel).filter(ApiRegistryModel.id == api_id).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="API not found")
             
        db.delete(db_obj)
        db.commit()
        return {"message": "API deleted"}
    except Exception as e:
        print(f"DEBUG Error in delete_api_registry: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
