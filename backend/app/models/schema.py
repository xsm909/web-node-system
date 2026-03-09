from sqlalchemy import Column, String, Boolean, DateTime, JSON, UUID, ForeignKey, Index, UniqueConstraint
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
    is_system = Column(Boolean, default=False) # Only Admins can edit if true
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    records = relationship("Record", back_populates="schema")


class Record(Base):
    """Stores validated JSON data payloads."""
    __tablename__ = "records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schema_id = Column(UUID(as_uuid=True), ForeignKey('schemas.id', ondelete='CASCADE'), nullable=False, index=True)
    data = Column(JSON, nullable=False) # The validated payload
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    schema = relationship("Schema", back_populates="records")
    meta_assignments = relationship("MetaAssignment", back_populates="record", cascade="all, delete-orphan")


class MetaAssignment(Base):
    """Polymorphic binding of a Record to any system entity."""
    __tablename__ = "meta_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey('records.id', ondelete='CASCADE'), nullable=False, unique=True)
    entity_type = Column(String, nullable=False, index=True) # e.g., 'user', 'client'
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True) # ID of the target
    assigned_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False) # Admin who made the assignment
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True) # User who has rights to edit this specific data

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_meta_entity", "entity_type", "entity_id"),
    )

    # Relationships
    record = relationship("Record", back_populates="meta_assignments")


class ExternalSchemaCache(Base):
    """Caches external schemas resolved via $ref."""
    __tablename__ = "external_schemas_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(String, unique=True, nullable=False, index=True)
    content = Column(JSON, nullable=False)
    etag = Column(String, nullable=True)
    last_fetched = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
