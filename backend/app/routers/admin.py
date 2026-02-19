from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..core.database import get_db
from ..core.security import require_role, hash_password
import ast
from ..models.user import User, RoleEnum
from ..models.node import NodeType

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = Depends(require_role("admin"))


def extract_node_parameters(code: str) -> list:
    """Extract parameters from class NodeParameters in the code."""
    try:
        tree = ast.parse(code)
        params = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == "NodeParameters":
                for item in node.body:
                    name = None
                    ptype = "string"
                    
                    if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                        name = item.target.id
                        # Map Python types to frontend field types
                        if isinstance(item.annotation, ast.Name):
                            tid = item.annotation.id
                            if tid in ("int", "float", "number"):
                                ptype = "number"
                            elif tid in ("bool", "boolean"):
                                ptype = "boolean"
                    
                    elif isinstance(item, ast.Assign) and len(item.targets) == 1 and isinstance(item.targets[0], ast.Name):
                        name = item.targets[0].id
                        # Infer type from default value
                        if isinstance(item.value, ast.Constant):
                            if isinstance(item.value.value, (int, float)):
                                ptype = "number"
                            elif isinstance(item.value.value, bool):
                                ptype = "boolean"
                        elif isinstance(item.value, ast.Num): # Legacy compatibility
                            ptype = "number"
                        elif isinstance(item.value, ast.NameConstant): # Legacy compatibility
                            if isinstance(item.value.value, bool):
                                ptype = "boolean"

                    if name:
                        params.append({
                            "name": name,
                            "type": ptype,
                            "label": name.replace("_", " ").title()
                        })
                return params
    except Exception:
        pass
    return []


class UserCreate(BaseModel):
    username: str
    password: str
    role: RoleEnum


class UserOut(BaseModel):
    id: int
    username: str
    role: str

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
    is_async: bool = False


class NodeTypeOut(BaseModel):
    id: int
    name: str
    version: str
    description: str
    code: str
    input_schema: dict
    output_schema: dict
    parameters: list
    is_async: bool

    class Config:
        from_attributes = True


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _=admin_only):
    return db.query(User).all()


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
def assign_client(manager_id: int, client_id: int, db: Session = Depends(get_db), _=admin_only):
    manager = db.query(User).filter(User.id == manager_id, User.role == "manager").first()
    client = db.query(User).filter(User.id == client_id, User.role == "client").first()
    if not manager or not client:
        raise HTTPException(status_code=404, detail="User not found")
    if client not in manager.assigned_clients:
        manager.assigned_clients.append(client)
        db.commit()
    return {"status": "assigned"}


@router.get("/node-types", response_model=List[NodeTypeOut])
def list_node_types(db: Session = Depends(get_db), _=admin_only):
    return db.query(NodeType).all()


@router.post("/node-types", response_model=NodeTypeOut)
def create_node_type(data: NodeTypeCreate, db: Session = Depends(get_db), _=admin_only):
    node_data = data.model_dump()
    node_data["parameters"] = extract_node_parameters(node_data["code"])
    node = NodeType(**node_data)
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.put("/node-types/{node_id}", response_model=NodeTypeOut)
def update_node_type(node_id: int, data: NodeTypeCreate, db: Session = Depends(get_db), _=admin_only):
    node = db.query(NodeType).filter(NodeType.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    
    update_data = data.model_dump()
    update_data["parameters"] = extract_node_parameters(update_data["code"])
    
    for k, v in update_data.items():
        setattr(node, k, v)
        
    db.commit()
    db.refresh(node)
    return node


@router.delete("/node-types/{node_id}")
def delete_node_type(node_id: int, db: Session = Depends(get_db), _=admin_only):
    node = db.query(NodeType).filter(NodeType.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    db.delete(node)
    db.commit()
    return {"status": "deleted"}
