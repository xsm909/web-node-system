from sqlalchemy import Column, Integer, String, Text, JSON, Boolean, UUID
from ..core.database import Base
import uuid


class NodeType(Base):
    __tablename__ = "node_types"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    version = Column(String(20), nullable=False, default="1.0")
    description = Column(Text, nullable=True)
    code = Column(Text, nullable=False, default="# Write your node code here\ndef run(inputs, params):\n    return {}")
    input_schema = Column(JSON, nullable=False, default={})
    output_schema = Column(JSON, nullable=False, default={})
    parameters = Column(JSON, nullable=False, default=[])
    category = Column(String(50), nullable=True)
    is_async = Column(Boolean, default=False)
