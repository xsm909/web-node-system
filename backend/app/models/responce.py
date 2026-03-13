from sqlalchemy import Column, String, DateTime, JSON, UUID, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from ..core.database import Base
import uuid

class Responce(Base):
    __tablename__ = "responce"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    # regclass is a postgres internal type, we'll map it to string for SQLAlchemy compatibility
    entity_type = Column(String, nullable=False) 
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    reference_type = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    category = Column(String, nullable=True)
    context = Column(JSON, nullable=True)
    context_type = Column(String(25), nullable=True)
    meta = Column(JSON, nullable=True)
