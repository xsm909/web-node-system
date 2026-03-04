from sqlalchemy import Column, String, ForeignKey, DateTime, JSON, UUID, Index, CheckConstraint, event
from sqlalchemy.sql import func
from ..core.database import Base
import uuid


class IntermediateResult(Base):
    __tablename__ = "intermediate_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    client_id = Column(UUID(as_uuid=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    category = Column(String(50), nullable=False, default="category")
    sub_category = Column(String(50), nullable=False, default="sub_category")
    data = Column(JSON, nullable=True)
    short_description = Column(String(50), nullable=True)

    __table_args__ = (
        Index("idx_intermediate_results_session_id", "session_id"),
        Index("idx_intermediate_results_reference_id", "reference_id"),
        Index("idx_intermediate_results_client_id", "client_id"),
        CheckConstraint("char_length(category) > 0", name="ck_intermediate_results_category_nonempty"),
        CheckConstraint("char_length(sub_category) > 0", name="ck_intermediate_results_sub_category_nonempty"),
    )


@event.listens_for(IntermediateResult, "before_insert")
def set_reference_id(mapper, connection, target):
    if target.reference_id is None:
        target.reference_id = target.session_id
