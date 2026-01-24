"""
Hierarchy Remark Model
Stores remarks/comments for elements in the hierarchical order overview.
References HUGWAWI elements by level_type and hugwawi_id.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from app.core.database import Base


class HierarchyRemark(Base):
    """
    Remarks for hierarchical elements from HUGWAWI.
    
    level_type values:
    - 'order': ordertable.id
    - 'order_article': order_article.id
    - 'bom_detail': packingnote_details.id
    - 'workplan_detail': workplan_details.id
    """
    __tablename__ = "hierarchy_remarks"

    id = Column(Integer, primary_key=True, index=True)
    level_type = Column(String(20), nullable=False)
    hugwawi_id = Column(Integer, nullable=False)
    remark = Column(Text, nullable=False)
    created_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Composite index for fast lookups
    __table_args__ = (
        Index('idx_level_hugwawi', 'level_type', 'hugwawi_id'),
    )

    def __repr__(self):
        return f"<HierarchyRemark(id={self.id}, level_type='{self.level_type}', hugwawi_id={self.hugwawi_id})>"
