from sqlalchemy import Column, String, DateTime, JSON, Text, UUID, ForeignKey
from sqlalchemy.sql import func
import uuid
from ..core.database import Base

class AgentHint(Base):
    """Stores markdown hints for AI agents."""
    __tablename__ = "agent_hints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True) # Unique identifier, immutable after creation
    category = Column(String(100), nullable=True, index=True) # e.g., 'Sql', 'Extraction'
    hint = Column(Text, nullable=False) # Markdown content
    meta = Column(JSON, nullable=True) # Additional metadata
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
