from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from pydantic import BaseModel
import uuid
from ..core.database import get_db
from ..core.security import require_role, hash_password
import ast
from ..models.user import User, RoleEnum
from ..models.node import NodeType
from ..models.credential import Credential
from ..models import LockData
from sqlalchemy import exists, and_
from sqlalchemy.exc import IntegrityError
from ..core.locks import raise_if_locked, check_is_locked

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = Depends(require_role("admin"))


class UserSummary(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    is_locked: bool = False # Added is_locked here

    class Config:
        from_attributes = True


class UserOut(UserSummary):
    assigned_managers: List[UserSummary] = []

    class Config:
        from_attributes = True


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _=admin_only):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == User.id,
        LockData.entity_type == "users"
    ).exists()
    
    results = db.query(User, is_locked_subquery.label("is_locked")).options(selectinload(User.assigned_managers)).all()
    
    response = []
    for user, is_locked in results:
        user_dict = UserOut.model_validate(user).model_dump()
        user_dict["is_locked"] = is_locked
        response.append(user_dict)
    return response


def extract_node_parameters(code: str) -> list:
    """Extract parameters from class NodeParameters in the code."""
    import re
    import ast

    def _parse_class_body(tree) -> list:
        dataclasses = {}
        # First pass: collect dataclasses
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                is_dc = False
                for decorator in node.decorator_list:
                    if (isinstance(decorator, ast.Name) and decorator.id == "dataclass") or \
                       (isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Name) and decorator.func.id == "dataclass"):
                        is_dc = True
                        break
                
                if is_dc:
                    fields = []
                    for item in node.body:
                        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                            ftype = "string"
                            if isinstance(item.annotation, ast.Name):
                                tid = item.annotation.id
                                if tid in ("int", "float", "number"): ftype = "number"
                                elif tid in ("bool", "boolean"): ftype = "boolean"
                            fields.append({
                                "name": item.target.id, 
                                "type": ftype, 
                                "label": item.target.id.replace("_", " ").title()
                            })
                    dataclasses[node.name] = fields

        params = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "NodeParameters":
                for item in node.body:
                    name = None
                    ptype = "string"
                    default = None
                    dataclass_name = None
                    schema = None
                    
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        name = item.target.id
                        
                        # Handle list[Dataclass] or List[Dataclass]
                        is_list = False
                        inner_type = None
                        
                        if isinstance(item.annotation, ast.Subscript):
                            if isinstance(item.annotation.value, ast.Name) and item.annotation.value.id.lower() == "list":
                                is_list = True
                                # Handle slice for both 3.8 and 3.9+
                                slice_node = item.annotation.slice
                                if isinstance(slice_node, ast.Name):
                                    inner_type = slice_node.id
                                elif hasattr(ast, 'Index') and isinstance(slice_node, ast.Index) and isinstance(slice_node.value, ast.Name):
                                    inner_type = slice_node.value.id
                                elif hasattr(slice_node, 'id'):
                                    inner_type = slice_node.id
                        
                        if is_list and inner_type in dataclasses:
                            ptype = "list_dataclass"
                            schema = dataclasses[inner_type]
                            dataclass_name = inner_type
                        elif isinstance(item.annotation, ast.Name):
                            tid = item.annotation.id
                            if tid in ("int", "float", "number"):
                                ptype = "number"
                            elif tid in ("bool", "boolean"):
                                ptype = "boolean"
                        
                        if item.value:
                            if isinstance(item.value, ast.Constant):
                                default = item.value.value
                            elif isinstance(item.value, ast.Num):
                                default = item.value.n
                            elif isinstance(item.value, ast.Str):
                                default = item.value.s
                            elif isinstance(item.value, ast.NameConstant):
                                default = item.value.value
                    
                    elif isinstance(item, ast.Assign) and len(item.targets) == 1 and isinstance(item.targets[0], ast.Name):
                        name = item.targets[0].id
                        if isinstance(item.value, ast.Constant):
                            default = item.value.value
                            if isinstance(default, (int, float)):
                                ptype = "number"
                            elif isinstance(default, bool):
                                ptype = "boolean"
                        elif isinstance(item.value, ast.Num):
                            default = item.value.n
                            ptype = "number"
                        elif isinstance(item.value, ast.Str):
                            default = item.value.s
                        elif isinstance(item.value, ast.NameConstant):
                            default = item.value.value
                            if isinstance(default, bool):
                                ptype = "boolean"

                    if name:
                        # Extract @table marker from comments on the same line
                        options_source = None
                        line_content = code.splitlines()[item.lineno-1] if item.lineno <= len(code.splitlines()) else ""
                        marker_match = re.search(r"@=table[-|>]+([\w]+)->([\w]+),([\w]+)->([\w]+)", line_content)
                        if marker_match:
                            table_name = marker_match.group(1)
                            options_source = {
                                "table": table_name,
                                "value_field": marker_match.group(2),
                                "label_field": marker_match.group(4),
                                "component": "ComboBox"
                            }
                            if table_name == "AI_Tasks":
                                options_source["filters"] = {"owner_id": "AI_Task"}
                        else:
                            # Support for @function_name
                            func_marker_match = re.search(r"@([\w]+)\b", line_content)
                            if func_marker_match:
                                options_source = {
                                    "function": func_marker_match.group(1),
                                    "component": "ComboBox"
                                }

                        sql_constructor_match = re.search(r"@=sql_query_constructor", line_content)

                        params.append({
                            "name": name,
                            "type": ptype,
                            "label": name.replace("_", " ").title(),
                            "default": default,
                            "options_source": options_source,
                            "is_sql_query_constructor": bool(sql_constructor_match),
                            "schema": schema,
                            "dataclass_name": dataclass_name
                        })
                return params
        return []

    # Try full parse first
    try:
        # Replace problematic assignment-to-comment shorthand to prevent SyntaxError
        cleaned_code = re.sub(r'([ \t]+[\w]+[ \t]*:[ \t]*[\w]+[ \t]*)=[ \t]*#', r'\1 #', code)
        tree = ast.parse(cleaned_code)
        return _parse_class_body(tree)
    except SyntaxError:
        pass

    # Fallback: extract only the NodeParameters class block via regex
    try:
        match = re.search(r'(class\s+NodeParameters\s*:.*?)(?=\n(?:class\s|def\s)|\Z)', code, re.DOTALL)
        if match:
            class_code = match.group(1)
            # Also clean the fallback
            cleaned_class_code = re.sub(r'([ \t]+[\w]+[ \t]*:[ \t]*[\w]+[ \t]*)=[ \t]*#', r'\1 #', class_code)
            tree = ast.parse(cleaned_class_code)
            return _parse_class_body(tree)
    except Exception:
        pass
    return []


def extract_input_parameters(code: str) -> list:
    """Extract parameters from class InputParameters in the code."""
    import re
    
    def _parse_class_body(tree) -> list:
        inputs = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "InputParameters":
                for item in node.body:
                    name = None
                    
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        name = item.target.id
                    elif isinstance(item, ast.Assign) and len(item.targets) == 1 and isinstance(item.targets[0], ast.Name):
                        name = item.targets[0].id
                        
                    if name:
                        inputs.append({
                            "name": name,
                            "label": name.replace("_", " ").title()
                        })
                return inputs
        return []

    # Try full parse first
    try:
        tree = ast.parse(code)
        return _parse_class_body(tree)
    except SyntaxError:
        pass

    # Fallback: extract only the InputParameters class block via regex
    try:
        match = re.search(r'(class\s+InputParameters\s*:.*?)(?=\n(?:class\s|def\s)|\Z)', code, re.DOTALL)
        if match:
            class_code = match.group(1)
            tree = ast.parse(class_code)
            return _parse_class_body(tree)
    except Exception:
        pass
    return []


class UserCreate(BaseModel):
    username: str
    password: str
    role: RoleEnum


class UserSummary(BaseModel):
    id: uuid.UUID
    username: str
    role: str
    is_locked: bool = False

    class Config:
        from_attributes = True


class UserOut(UserSummary):
    assigned_managers: List[UserSummary] = []

    class Config:
        from_attributes = True


class NodeTypeCreate(BaseModel):
    name: str
    version: str = "1.0"
    description: str = ""
    code: str = "def run(inputs, params):\n    return {}"
    input_schema: dict = {}
    output_schema: dict = {}
    parameters: list = []
    category: Optional[str] = ""
    icon: Optional[str] = "task"
    is_async: bool = False
    show_in_toolbar: bool = False
    meta: Optional[dict] = {}


class NodeTypeOut(BaseModel):
    id: uuid.UUID
    name: str
    version: str
    description: Optional[str] = ""
    code: str
    input_schema: dict
    output_schema: dict
    parameters: list
    category: Optional[str] = None
    icon: Optional[str] = "task"
    is_async: bool
    show_in_toolbar: bool = False
    meta: Optional[dict] = {}
    is_locked: bool = False

    class Config:
        from_attributes = True


class CredentialCreate(BaseModel):
    key: str
    value: str
    type: str
    auth_type: Optional[str] = "header"
    meta: Optional[dict] = None
    description: Optional[str] = None
    expired: bool = False


class CredentialOut(BaseModel):
    id: uuid.UUID
    key: str
    value: str
    type: str
    auth_type: Optional[str] = "header"
    meta: Optional[dict] = None
    description: Optional[str] = None
    expired: bool = False
    is_locked: bool = False

    class Config:
        from_attributes = True


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _=admin_only):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == User.id,
        LockData.entity_type == "users"
    ).exists()
    
    results = db.query(User, is_locked_subquery.label("is_locked")).options(selectinload(User.assigned_managers)).all()
    
    response = []
    for user, is_locked in results:
        user_dict = UserOut.model_validate(user).model_dump()
        user_dict["is_locked"] = is_locked
        response.append(user_dict)
    return response


@router.get("/managers", response_model=List[UserOut])
def list_managers(db: Session = Depends(get_db), _=admin_only):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == User.id,
        LockData.entity_type == "users"
    ).exists()
    
    results = db.query(User, is_locked_subquery.label("is_locked")).filter(User.role == RoleEnum.manager).all()
    
    response = []
    for user, is_locked in results:
        user_dict = UserOut.model_validate(user).model_dump()
        user_dict["is_locked"] = is_locked
        response.append(user_dict)
    return response


@router.post("/users", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), _=admin_only):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(username=data.username, hashed_password=hash_password(data.password), role=data.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{manager_id}/assign/{client_id}")
def assign_client(manager_id: uuid.UUID, client_id: uuid.UUID, db: Session = Depends(get_db), _=admin_only):
    manager = db.query(User).filter(User.id == manager_id, User.role == RoleEnum.manager).first()
    client = db.query(User).filter(User.id == client_id, User.role == RoleEnum.client).first()
    if not manager or not client:
        raise HTTPException(status_code=404, detail="User not found")
    if client not in manager.assigned_clients:
        manager.assigned_clients.append(client)
        db.commit()
    return {"status": "assigned"}


@router.delete("/users/manager-assignment/{manager_id}/{client_id}")
def unassign_client(manager_id: uuid.UUID, client_id: uuid.UUID, db: Session = Depends(get_db), _=admin_only):
    manager = db.query(User).filter(User.id == manager_id, User.role == RoleEnum.manager).first()
    client = db.query(User).filter(User.id == client_id, User.role == RoleEnum.client).first()
    if not manager or not client:
        raise HTTPException(status_code=404, detail="User not found")
    if client in manager.assigned_clients:
        manager.assigned_clients.remove(client)
        db.commit()
    return {"status": "unassigned"}


@router.get("/node-types", response_model=List[NodeTypeOut])
def list_node_types(db: Session = Depends(get_db), _=admin_only):
    is_locked_subquery = db.query(LockData.id).filter(
        LockData.entity_id == NodeType.id,
        LockData.entity_type == "node_types"
    ).exists()
    
    results = db.query(NodeType, is_locked_subquery.label("is_locked")).all()
    
    response = []
    for node, is_locked in results:
        node_dict = NodeTypeOut.model_validate(node).model_dump()
        node_dict["is_locked"] = is_locked
        response.append(node_dict)
    return response


@router.get("/node-types/{node_id}", response_model=NodeTypeOut)
def get_node_type(node_id: uuid.UUID, db: Session = Depends(get_db), _=admin_only):
    node = db.query(NodeType).filter(NodeType.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    
    is_locked = check_is_locked(db, node_id, "node_types")
    node_dict = NodeTypeOut.model_validate(node).model_dump()
    node_dict["is_locked"] = is_locked
    return node_dict


@router.post("/node-types", response_model=NodeTypeOut)
def create_node_type(data: NodeTypeCreate, db: Session = Depends(get_db), _=admin_only):
    node_data = data.model_dump()
    node_data["parameters"] = extract_node_parameters(node_data["code"])
    
    extracted_inputs = extract_input_parameters(node_data["code"])
    if extracted_inputs:
        schema = node_data.get("input_schema") or {}
        schema["inputs"] = extracted_inputs
        node_data["input_schema"] = schema
        
    try:
        node = NodeType(**node_data)
        db.add(node)
        db.commit()
        db.refresh(node)
        node_dict = NodeTypeOut.model_validate(node).model_dump()
        node_dict["is_locked"] = False
        return node_dict
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/node-types/{node_id}", response_model=NodeTypeOut)
def update_node_type(node_id: uuid.UUID, data: NodeTypeCreate, db: Session = Depends(get_db), _=admin_only):
    node = db.query(NodeType).filter(NodeType.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    
    raise_if_locked(db, node_id, "node_types")
    
    update_data = data.model_dump()
    update_data["parameters"] = extract_node_parameters(update_data["code"])
    
    extracted_inputs = extract_input_parameters(update_data["code"])
    if extracted_inputs:
        schema = update_data.get("input_schema") or {}
        schema["inputs"] = extracted_inputs
        update_data["input_schema"] = schema
    elif "input_schema" in update_data and isinstance(update_data["input_schema"], dict) and "inputs" in update_data["input_schema"]:
        # Remove inputs array if the class was removed
        schema = update_data["input_schema"]
        del schema["inputs"]
        update_data["input_schema"] = schema
    
    try:
        for k, v in update_data.items():
            setattr(node, k, v)
            
        db.commit()
        db.refresh(node)
        is_locked = check_is_locked(db, node_id, "node_types")
        node_dict = NodeTypeOut.model_validate(node).model_dump()
        node_dict["is_locked"] = is_locked
        return node_dict
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/node-types/{node_id}")
def delete_node_type(node_id: uuid.UUID, db: Session = Depends(get_db), _=admin_only):
    node = db.query(NodeType).filter(NodeType.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    
    raise_if_locked(db, node_id, "node_types")
    
    db.delete(node)
    db.commit()
    return {"status": "deleted"}


@router.get("/credentials", response_model=List[CredentialOut])
def list_credentials(db: Session = Depends(get_db), _=admin_only):
    # Use an outer join to check for locks, which is more portable than exists() in SELECT
    results = db.query(Credential, LockData.id.isnot(None).label("is_locked")) \
        .outerjoin(LockData, and_(
            LockData.entity_id == Credential.id,
            LockData.entity_type == "credentials"
        )).all()
    
    response = []
    for cred, is_locked in results:
        cred_dict = CredentialOut.model_validate(cred).model_dump()
        cred_dict["is_locked"] = is_locked
        response.append(cred_dict)
    return response


@router.post("/credentials", response_model=CredentialOut)
def create_credential(data: CredentialCreate, db: Session = Depends(get_db), _=admin_only):
    if db.query(Credential).filter(Credential.key == data.key).first():
        raise HTTPException(status_code=400, detail="Credential key already exists")
    credential = Credential(**data.model_dump())
    db.add(credential)
    db.commit()
    db.refresh(credential)
    return credential


@router.put("/credentials/{credential_id}", response_model=CredentialOut)
def update_credential(credential_id: uuid.UUID, data: CredentialCreate, db: Session = Depends(get_db), _=admin_only):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    raise_if_locked(db, credential_id, "credentials")
    
    for k, v in data.model_dump().items():
        setattr(credential, k, v)
    
    db.commit()
    db.refresh(credential)
    return credential


@router.delete("/credentials/{credential_id}")
def delete_credential(credential_id: uuid.UUID, db: Session = Depends(get_db), _=admin_only):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    raise_if_locked(db, credential_id, "credentials")
    
    db.delete(credential)
    db.commit()
    return {"status": "deleted"}
