from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Enum, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum
import uuid


class WorkflowStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    graph = Column(JSON, nullable=False, default={"nodes": [], "edges": []})
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.draft)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", foreign_keys=[owner_id], back_populates="workflows")
    executions = relationship("WorkflowExecution", back_populates="workflow")


class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.pending)
    result_summary = Column(Text, nullable=True)
    logs = Column(JSON, nullable=True, default=[])
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

    workflow = relationship("Workflow", back_populates="executions")
    node_results = relationship("NodeExecution", back_populates="execution")


class NodeExecution(Base):
    __tablename__ = "node_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("workflow_executions.id"), nullable=False)
    node_id = Column(String(100), nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.pending)
    output = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)

    execution = relationship("WorkflowExecution", back_populates="node_results")
