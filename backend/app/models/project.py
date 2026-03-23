from sqlalchemy import Column, String, Text, UUID
import uuid
from ..core.database import Base

class Project(Base):
    """Stores project information."""
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(75), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
