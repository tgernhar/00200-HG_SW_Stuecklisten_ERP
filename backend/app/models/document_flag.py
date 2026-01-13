"""
Document Generation Flags Model (Druck-/Generierungsflags - Block B)
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class DocumentGenerationFlag(Base):
    __tablename__ = "document_generation_flags"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False, unique=True)
    
    # Dokument-Flags (Werte: leer, "1", "x")
    pdf_drucken = Column(String(1), default="")  # B1: leer, "1", "x"
    pdf = Column(String(1), default="")  # B2: leer, "1", "x"
    pdf_bestell_pdf = Column(String(1), default="")  # B3: leer, "1", "x"
    dxf = Column(String(1), default="")  # B4: leer, "1", "x"
    bestell_dxf = Column(String(1), default="")  # B5: leer, "1", "x"
    step = Column(String(1), default="")  # B8: leer, "1", "x"
    x_t = Column(String(1), default="")  # B9: leer, "1", "x"
    stl = Column(String(1), default="")  # B10: leer, "1", "x"
    bn_ab = Column(String(1), default="")  # B12: leer, "x"
    
    # Relationships
    article = relationship("Article", back_populates="document_flags")
