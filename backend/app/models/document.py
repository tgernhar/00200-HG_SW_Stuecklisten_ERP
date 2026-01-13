"""
Document Model (Dokumentstatus - Block B)
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    
    document_type = Column(String(50), nullable=False)  # PDF, Bestell_PDF, DXF, Bestell_DXF, SW_Part_ASM, SW_DRW, STEP, X_T, STL, ESP
    file_path = Column(String(500))
    exists = Column(Boolean, default=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    article = relationship("Article", back_populates="documents")
