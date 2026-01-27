"""
Entity Image Model - Universal image storage for articles, BOM items, and worksteps

Stores thumbnail previews as BLOBs in the database and references original files
via filepath. Supports multiple thumbnail sizes for different use cases.
"""
from sqlalchemy import Column, Integer, String, DateTime, LargeBinary
from sqlalchemy.sql import func
from app.core.database import Base


class EntityImage(Base):
    """Universal image storage for various entity types"""
    __tablename__ = "entity_images"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Entity identification
    entity_type = Column(String(50), nullable=False, index=True)  # "article", "bom_item", "workstep"
    entity_id = Column(Integer, nullable=True, index=True)  # Reference ID (e.g., HUGWAWI article.id)
    entity_reference = Column(String(255), nullable=True, index=True)  # Alternative reference (e.g., article number)
    
    # Original file information
    original_filepath = Column(String(500), nullable=False)  # Full path to original file
    original_filename = Column(String(255), nullable=True)  # Original filename
    file_type = Column(String(10), nullable=True)  # "pdf", "png", "jpg", "jpeg"
    
    # Thumbnail storage
    thumbnail_size = Column(String(10), nullable=True, default='medium')  # "small", "medium", "large"
    thumbnail_blob = Column(LargeBinary(length=16777215), nullable=True)  # MEDIUMBLOB for thumbnail image
    thumbnail_width = Column(Integer, nullable=True)
    thumbnail_height = Column(Integer, nullable=True)
    
    # Metadata
    uploaded_by = Column(Integer, nullable=True)  # userlogin.id
    uploaded_at = Column(DateTime, nullable=True, server_default=func.now())
    
    def __repr__(self):
        return f"<EntityImage(id={self.id}, type={self.entity_type}, entity_id={self.entity_id}, file={self.original_filename})>"
    
    @property
    def thumbnail_base64(self) -> str | None:
        """Return thumbnail as base64 encoded string for frontend display"""
        if not self.thumbnail_blob:
            return None
        import base64
        return base64.b64encode(self.thumbnail_blob).decode('utf-8')
    
    @property
    def thumbnail_data_url(self) -> str | None:
        """Return thumbnail as data URL for direct use in img src"""
        if not self.thumbnail_blob:
            return None
        import base64
        b64 = base64.b64encode(self.thumbnail_blob).decode('utf-8')
        # Determine MIME type based on thumbnail (always JPEG for consistency)
        mime_type = 'image/jpeg'
        return f"data:{mime_type};base64,{b64}"
