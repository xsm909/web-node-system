from sqlalchemy import Column, String, Integer, JSON, UniqueConstraint
from ..core.database import Base


class DataType(Base):
    __tablename__ = "data_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(50), nullable=False, server_default='AI Task')
    type = Column(String(50), nullable=False)
    config = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint('category', 'type', name='uq_data_type_category_type'),
    )
