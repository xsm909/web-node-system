from sqlalchemy import Column, String, DateTime, text
from sqlalchemy.sql import func
from ..core.database import Base
import uuid

class AI_Result(Base):
    __tablename__ = "ai_results"

    uid = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    result = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())
