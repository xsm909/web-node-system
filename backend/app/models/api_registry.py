from sqlalchemy import Column, String, Text, UUID, JSON, Enum
import uuid
import enum
from ..core.database import Base

class AuthType(str, enum.Enum):
    header = "header"
    query = "query"

class ApiRegistry(Base):
    __tablename__ = "api_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    base_url = Column(String(255), nullable=False)
    credential_key = Column(String(100), nullable=True) # References Credential.key
    functions = Column(JSON, nullable=True) # JSON list/dict of available functions
    description = Column(Text, nullable=True)
    project_id = Column(UUID(as_uuid=True), nullable=True, index=True)
