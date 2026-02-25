from sqlalchemy import Column, String, DateTime, UUID
from sqlalchemy.sql import func
from ..core.database import Base
import uuid

class AI_Result(Base):
    __tablename__ = "ai_results"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    uid = Column(String(100), index=True, nullable=True)
    result = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
