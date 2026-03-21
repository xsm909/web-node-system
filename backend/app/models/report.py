from sqlalchemy import Column, Integer, String, Enum, ForeignKey, Text, JSON, DateTime, Boolean, UUID, and_
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum
import uuid

class ReportTypeEnum(str, enum.Enum):
    global_type = "global"
    client = "client"

class ReportStyle(Base):
    __tablename__ = "report_styles"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=True)
    css = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)

    reports = relationship("Report", back_populates="style")

class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    type = Column(Enum(ReportTypeEnum), nullable=False, default=ReportTypeEnum.global_type)
    description = Column(Text, nullable=True)
    code = Column(Text, nullable=False)
    schema_json = Column(JSON, nullable=True, default={})
    template = Column(Text, nullable=False)
    style_id = Column(UUID(as_uuid=True), ForeignKey("report_styles.id"), nullable=True)
    meta = Column(JSON, nullable=True, default={})
    category = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    style = relationship("ReportStyle", back_populates="reports")
    parameters = relationship(
        "ObjectParameter", 
        primaryjoin="and_(ObjectParameter.object_id == Report.id, ObjectParameter.object_name == 'reports')",
        foreign_keys="ObjectParameter.object_id",
        back_populates="report", 
        cascade="all, delete-orphan"
    )
    runs = relationship("ReportRun", back_populates="report", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])

class ObjectParameter(Base):
    __tablename__ = "object_parameters"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    object_id = Column(UUID(as_uuid=True), nullable=False)
    object_name = Column(String(255), nullable=False, default="reports")
    parameter_name = Column(String(255), nullable=False)
    parameter_type = Column(String(50), nullable=False, default="text")
    default_value = Column(String(1000), nullable=True)
    source = Column(String(255), nullable=True)
    value_field = Column(String(255), nullable=True)
    label_field = Column(String(255), nullable=True)

    report = relationship(
        "Report", 
        primaryjoin="and_(Report.id == ObjectParameter.object_id, ObjectParameter.object_name == 'reports')",
        foreign_keys=[object_id], 
        back_populates="parameters",
        overlaps="parameters",
        viewonly=True
    )

class ReportRun(Base):
    __tablename__ = "report_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False)
    executed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    parameters_json = Column(JSON, nullable=True)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    result_snapshot = Column(Text, nullable=True)

    report = relationship("Report", back_populates="runs")
    executor = relationship("User", foreign_keys=[executed_by])
