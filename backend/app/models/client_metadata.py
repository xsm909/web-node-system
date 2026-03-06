from sqlalchemy import Column, String, DateTime, Index, JSON, UUID, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from ..core.database import Base
import uuid

class ClientMetadata(Base):
    __tablename__ = "client_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    data_type_id = Column(Integer, ForeignKey('data_types.id'), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    meta_data = Column("metadata", JSON, server_default='{"multiline": false}')

    __table_args__ = (
        Index("idx_client_metadata_owner_id", "owner_id"),
        Index("idx_client_metadata_data_type_id", "data_type_id"),
        Index("idx_client_metadata_created_by", "created_by"),
        UniqueConstraint("owner_id", "data_type_id", name="uq_client_metadata_owner_datatype"),
    )
