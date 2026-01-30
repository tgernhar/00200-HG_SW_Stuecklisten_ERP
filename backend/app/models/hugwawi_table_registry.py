"""
HUGWAWI Table Registry Model

Tracks all HUGWAWI database tables and their usage/write permissions
for the step-by-step database migration adapter.
"""
from sqlalchemy import Column, Integer, String, Boolean, Text
from app.core.database import Base


class HugwawiTableRegistry(Base):
    """
    Registry table that lists all HUGWAWI database tables with:
    - position: Sequential number (1, 2, 3, ...)
    - table_name: Name of the HUGWAWI table
    - is_used_read: Whether this table is currently used for reading in the project
    - remarks: User remarks/notes
    - allow_write_production: Whether writing to production DB (10.233.159.44) is allowed
    """
    __tablename__ = "hugwawi_table_registry"
    
    position = Column(Integer, primary_key=True, autoincrement=True)
    table_name = Column(String(100), unique=True, nullable=False, index=True)
    is_used_read = Column(Boolean, default=False, nullable=False)
    remarks = Column(Text, nullable=True)
    allow_write_production = Column(Boolean, default=False, nullable=False)
    
    def __repr__(self):
        return f"<HugwawiTableRegistry(position={self.position}, table_name='{self.table_name}', is_used_read={self.is_used_read})>"
