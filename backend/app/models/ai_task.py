from sqlalchemy import Column, String, DateTime, Index, JSON, UUID
from sqlalchemy.sql import func
from ..core.database import Base
import uuid


class AI_Task(Base):
    __tablename__ = "ai_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(String(50), nullable=False)
    category = Column(String(50), nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    task = Column(JSON, nullable=True)

    __table_args__ = (
        Index("idx_ai_task_owner_id", "owner_id"),
        Index("idx_ai_task_category", "category"),
        Index("idx_ai_task_created_by", "created_by"),
    )
