from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..core.database import get_db
from ..core.security import require_role, hash_password
from ..models.user import User, RoleEnum
from ..models.node import NodeType

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = Depends(require_role("admin"))


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
    node = NodeType(**data.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.put("/node-types/{node_id}", response_model=NodeTypeOut)
def update_node_type(node_id: int, data: NodeTypeCreate, db: Session = Depends(get_db), _=admin_only):
    node = db.query(NodeType).filter(NodeType.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    for k, v in data.model_dump().items():
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
