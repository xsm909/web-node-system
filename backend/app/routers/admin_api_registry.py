from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, attributes
from sqlalchemy import and_
from typing import List, Optional
from uuid import UUID

from ..core.database import get_db
from ..models.api_registry import ApiRegistry as ApiRegistryModel
from ..models.lock import LockData
from ..schemas.api_registry import ApiRegistry, ApiRegistryCreate, ApiRegistryUpdate
from ..core.locks import raise_if_locked

router = APIRouter()

@router.get("", response_model=List[ApiRegistry])
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

@router.post("", response_model=ApiRegistry)
def create_api_registry(api_in: ApiRegistryCreate, db: Session = Depends(get_db)):
    try:
        # 1. Check if name already exists
        existing = db.query(ApiRegistryModel).filter(ApiRegistryModel.name == api_in.name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"API with name '{api_in.name}' already exists")
            
        # 2. Extract data safely
        data = api_in.model_dump()
        
        # 3. Create model instance with manual assignment for maximum safety
        db_obj = ApiRegistryModel()
        db_obj.name = data.get('name')
        db_obj.base_url = data.get('base_url')
        db_obj.credential_key = data.get('credential_key')
        db_obj.description = data.get('description')
        db_obj.project_id = data.get('project_id')
        
        # Handle JSON field explicitly
        funcs = data.get('functions')
        if funcs is not None:
            db_obj.functions = funcs
        else:
            db_obj.functions = []
            
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # 4. Validate and return
        return ApiRegistry.model_validate(db_obj)
        
    except Exception as e:
        import traceback
        err_msg = str(e)
        stack = traceback.format_exc()
        print(f"DEBUG Error in create_api_registry: {err_msg}")
        print(stack)
        
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Database error: {err_msg}")

@router.get("/{api_id}", response_model=ApiRegistry)
def get_api_registry(api_id: str, db: Session = Depends(get_db)):
    try:
        try:
            api_uuid = UUID(api_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid API ID format")
            
        result = db.query(ApiRegistryModel, LockData.id.isnot(None).label("is_locked")) \
            .outerjoin(LockData, and_(
                LockData.entity_id == ApiRegistryModel.id,
                LockData.entity_type == "api_registry"
            )) \
            .filter(ApiRegistryModel.id == api_uuid) \
            .first()
            
        if not result:
            raise HTTPException(status_code=404, detail="API not found")
        
        api, is_locked = result
        api_dict = ApiRegistry.model_validate(api).model_dump()
        api_dict["is_locked"] = is_locked
        return api_dict
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{api_id}", response_model=ApiRegistry)
def update_api_registry(api_id: str, api_in: ApiRegistryUpdate, db: Session = Depends(get_db)):
    try:
        try:
            api_uuid = UUID(api_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid API ID format")
            
        db_obj = db.query(ApiRegistryModel).filter(ApiRegistryModel.id == api_uuid).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="API not found")
        
        update_data = api_in.model_dump(exclude_unset=True)
        if "name" in update_data and update_data["name"] != db_obj.name:
            existing = db.query(ApiRegistryModel).filter(ApiRegistryModel.name == update_data["name"]).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"API with name '{update_data['name']}' already exists")
                
        # 1. ENFORCE LOCKS (RULE 15)
        raise_if_locked(db, api_uuid, "api_registry")
            
        for field, value in update_data.items():
            setattr(db_obj, field, value)
            if field == "functions":
                attributes.flag_modified(db_obj, "functions")
        
        db.commit()
        db.refresh(db_obj)
        return ApiRegistry.model_validate(db_obj)
    except Exception as e:
        print(f"DEBUG Error in update_api_registry: {str(e)}")
        import traceback
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Database error during API update: {str(e)}")

@router.delete("/{api_id}")
def delete_api_registry(api_id: str, db: Session = Depends(get_db)):
    try:
        try:
            api_uuid = UUID(api_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid API ID format")
            
        db_obj = db.query(ApiRegistryModel).filter(ApiRegistryModel.id == api_uuid).first()
        if not db_obj:
            raise HTTPException(status_code=404, detail="API not found")
             
        # 1. ENFORCE LOCKS (RULE 15)
        raise_if_locked(db, api_id, "api_registry")
        
        db.delete(db_obj)
        db.commit()
        return {"message": "API deleted"}
    except Exception as e:
        print(f"DEBUG Error in delete_api_registry: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
