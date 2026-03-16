from sqlalchemy import Column, String, DateTime, JSON, UUID
from sqlalchemy.sql import func
import uuid
from ..core.database import Base

class Prompt(Base):
    """Stores JSON prompts associated with entities (clients or records)."""
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True) # ID of the client or record
    entity_type = Column(String, nullable=False, index=True) # 'client' or 'record'
    content = Column(JSON, nullable=False) # The actual prompt data
    category = Column(String, nullable=True, index=True) # Category like 'Common|Prompt'
    datatype = Column(String, nullable=False, index=True) # Key of schema (datatype)
    reference_id = Column(UUID(as_uuid=True), nullable=True, index=True) # Optional reference ID
    meta = Column(JSON, nullable=True) # Additional technical metadata
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
