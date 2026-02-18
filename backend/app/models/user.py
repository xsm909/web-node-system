from sqlalchemy import Column, Integer, String, Enum, ForeignKey, Table
from sqlalchemy.orm import relationship
from ..core.database import Base
import enum

class RoleEnum(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    client = "client"

# Association table: manager -> assigned clients
manager_client = Table(
    "manager_client",
    Base.metadata,
    Column("manager_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("client_id", Integer, ForeignKey("users.id"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.client)

    # Manager's assigned clients
    assigned_clients = relationship(
        "User",
        secondary=manager_client,
        primaryjoin=id == manager_client.c.manager_id,
        secondaryjoin=id == manager_client.c.client_id,
        backref="assigned_managers",
    )

    workflows = relationship("Workflow", back_populates="owner", foreign_keys="Workflow.owner_id")
