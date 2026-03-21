from sqlalchemy import Column, String, DateTime, UUID, UniqueConstraint
from sqlalchemy.sql import func
import uuid
from ..core.database import Base

class LockData(Base):
    __tablename__ = "lock_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    entity_type = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('entity_id', 'entity_type', name='uix_lock_entity'),
    )
