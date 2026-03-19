from sqlalchemy import Column, String, Boolean, DateTime, JSON, Integer, UUID, ForeignKey, Index, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from ..core.database import Base

class Schema(Base):
    """Stores JSON Schemas."""
    __tablename__ = "schemas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String, unique=True, nullable=False, index=True) # Unique identifier like 'client-profile'
    content = Column(JSON, nullable=False) # The actual JSON Schema
    category = Column(String, nullable=True, index=True) # Groups like 'Common|Info'
    meta = Column(JSON, nullable=True) # Additional metadata like {"tags": ["common", "info"]}
    is_system = Column(Boolean, default=False) # Only Admins can edit if true
    lock = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    records = relationship("Record", back_populates="schema")


class Record(Base):
    """Stores validated JSON data payloads."""
    __tablename__ = "records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schema_id = Column(UUID(as_uuid=True), ForeignKey('schemas.id', ondelete='CASCADE'), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey('records.id', ondelete='CASCADE'), nullable=True, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    entity_type = Column(String, nullable=True, index=True)
    data = Column(JSON, nullable=False) # The validated payload
    order = Column("order", Column(Integer).type, default=0, nullable=False) # Use explicit name to avoid reserved word issues in some DBs
    lock = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_records_entity", "entity_type", "entity_id"),
    )

    # Relationships
    schema = relationship("Schema", back_populates="records")
    parent = relationship("Record", remote_side=[id], back_populates="children")
    children = relationship("Record", back_populates="parent", cascade="all, delete-orphan", order_by="Record.order")




class ExternalSchemaCache(Base):
    """Caches external schemas resolved via $ref."""
    __tablename__ = "external_schemas_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(String, unique=True, nullable=False, index=True)
    content = Column(JSON, nullable=False)
    etag = Column(String, nullable=True)
    last_fetched = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
