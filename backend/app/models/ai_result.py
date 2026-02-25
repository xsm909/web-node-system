from sqlalchemy import Column, String, DateTime, UUID, text
from sqlalchemy.sql import func
from ..core.database import Base
import uuid

class AI_Result(Base):
    __tablename__ = "ai_results"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    uid = Column(String(100), index=True, nullable=True, default=lambda: str(uuid.uuid4()), server_default=text("('AUTO-' || hex(randomblob(8)))"))
    result = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())
