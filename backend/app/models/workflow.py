from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Enum, UUID, cast, and_
from sqlalchemy.orm import relationship, remote, foreign
from sqlalchemy.sql import func
from ..core.database import Base
import enum
import uuid
from .report import ObjectParameter


class WorkflowStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    owner_id = Column(String(50), nullable=False, index=True) # Changed from UUID/FK to String to allow "common"
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    graph = Column(JSON, nullable=False, default={"nodes": [], "edges": []})
    category = Column(String(50), nullable=False, default="personal")
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.draft)
    workflow_data = Column(JSON, nullable=True, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship(
        "User", 
        back_populates="workflows",
        primaryjoin="remote(cast(User.id, String)) == foreign(Workflow.owner_id)",
        viewonly=True
    )
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")
    parameters = relationship(
        "ObjectParameter", 
        primaryjoin="and_(ObjectParameter.object_id == Workflow.id, ObjectParameter.object_name == 'workflows')",
        foreign_keys=[ObjectParameter.object_id],
        cascade="all, delete-orphan",
        overlaps="parameters"
    )


class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.pending)
    result_summary = Column(Text, nullable=True)
    logs = Column(JSON, nullable=True, default=[])
    runtime_data = Column(JSON, nullable=True, default={})
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

    workflow = relationship("Workflow", back_populates="executions")
    node_results = relationship("NodeExecution", back_populates="execution", cascade="all, delete-orphan")


class NodeExecution(Base):
    __tablename__ = "node_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("workflow_executions.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(String(100), nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.pending)
    output = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)

    execution = relationship("WorkflowExecution", back_populates="node_results")
