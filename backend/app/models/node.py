from sqlalchemy import Column, Integer, String, Text, JSON, Boolean
from ..core.database import Base


class NodeType(Base):
    __tablename__ = "node_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    version = Column(String(20), nullable=False, default="1.0")
    description = Column(Text, nullable=True)
    code = Column(Text, nullable=False, default="# Write your node code here\ndef run(inputs, params):\n    return {}")
    input_schema = Column(JSON, nullable=False, default={})
    output_schema = Column(JSON, nullable=False, default={})
    parameters = Column(JSON, nullable=False, default=[])
    category = Column(String(50), nullable=True)
    is_async = Column(Boolean, default=False)
