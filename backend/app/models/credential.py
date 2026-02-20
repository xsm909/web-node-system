from sqlalchemy import Column, String, Text, UUID
import uuid
from ..core.database import Base

class Credential(Base):
    __tablename__ = "credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)  # e.g., 'ai', 'db', 'telegram', 'api'
    description = Column(String(255), nullable=True)
