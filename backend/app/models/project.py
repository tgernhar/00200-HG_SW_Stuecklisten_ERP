"""
Project Model
"""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    artikel_nr = Column(String(100), unique=True, index=True, nullable=False)
    au_nr = Column(String(100), index=True, nullable=True)
    project_path = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    articles = relationship("Article", back_populates="project", cascade="all, delete-orphan")
    boms = relationship("Bom", back_populates="project", cascade="all, delete-orphan")
