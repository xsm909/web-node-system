from sqlalchemy import Column, String, UUID, JSON
from ..core.database import Base
import uuid

class Preset(Base):
    __tablename__ = "presets"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    category = Column(String(75), nullable=True)
    preset_data = Column(JSON, nullable=False)
