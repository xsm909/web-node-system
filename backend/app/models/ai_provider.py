from sqlalchemy import Column, String, Text, UUID, JSON
import uuid
from ..core.database import Base

class AiProvider(Base):
    __tablename__ = "ai_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    key = Column(String(75), unique=True, nullable=False, index=True)
    models = Column(JSON, nullable=True)
    api_key = Column(String(75), nullable=True)
    base_url = Column(String(255), nullable=True)
    description = Column(String(255), nullable=True)
