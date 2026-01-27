"""
Image Service - Universal image management for articles, BOM items, and worksteps

Handles:
- Thumbnail generation from PDF, PNG, JPG files
- BLOB storage and retrieval
- File path mapping for Docker containers
"""
import os
import io
import logging
from typing import Optional, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.entity_image import EntityImage

logger = logging.getLogger(__name__)


# Thumbnail size configurations (width, height)
THUMBNAIL_SIZES = {
    'small': (150, 150),
    'medium': (300, 300),
    'large': (600, 600),
}

# File path mappings for Docker container access
# Windows paths are mapped to container mount points
# IMPORTANT: G:\Arbeitsunterlagen maps to /mnt/files (not G:\ alone!)
# because Docker mount is: //10.233.153.11/Produktion/Arbeitsunterlagen:/mnt/files
FILE_PATH_MAPPINGS = {
    "G:\\Arbeitsunterlagen\\": "/mnt/files/",
    "G:/Arbeitsunterlagen/": "/mnt/files/",
    "\\\\10.233.153.11\\Produktion\\Arbeitsunterlagen\\": "/mnt/files/",
    "//10.233.153.11/Produktion/Arbeitsunterlagen/": "/mnt/files/",
    "C:/Thomas/Solidworks/": "/mnt/solidworks/",
    "C:\\Thomas\\Solidworks\\": "/mnt/solidworks/",
}

# Supported file types
SUPPORTED_IMAGE_TYPES = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
SUPPORTED_PDF_TYPES = {'.pdf'}
SUPPORTED_FILE_TYPES = SUPPORTED_IMAGE_TYPES | SUPPORTED_PDF_TYPES


def map_filepath_to_container(filepath: str) -> str:
    """
    Map a Windows filepath to the Docker container mount path.
    
    Args:
        filepath: Original Windows filepath (e.g., G:\\Data\\image.pdf)
    
    Returns:
        Container-accessible path (e.g., /mnt/files/Data/image.pdf)
    """
    for windows_path, container_path in FILE_PATH_MAPPINGS.items():
        if filepath.startswith(windows_path):
            return filepath.replace(windows_path, container_path, 1).replace('\\', '/')
    
    # If no mapping found, try to use as-is (for local development)
    return filepath.replace('\\', '/')


def detect_file_type(filepath: str) -> Optional[str]:
    """
    Detect file type from filepath extension.
    
    Args:
        filepath: Path to the file
    
    Returns:
        File type string (pdf, png, jpg, etc.) or None if unsupported
    """
    _, ext = os.path.splitext(filepath.lower())
    
    if ext in SUPPORTED_IMAGE_TYPES:
        return ext[1:]  # Remove leading dot
    elif ext in SUPPORTED_PDF_TYPES:
        return 'pdf'
    
    return None


def generate_thumbnail(filepath: str, size: str = 'medium') -> Tuple[Optional[bytes], int, int]:
    """
    Generate a thumbnail from an image or PDF file.
    
    Args:
        filepath: Path to the original file
        size: Thumbnail size ('small', 'medium', 'large')
    
    Returns:
        Tuple of (thumbnail_bytes, width, height) or (None, 0, 0) on failure
    """
    try:
        from PIL import Image
    except ImportError:
        logger.error("Pillow not installed. Cannot generate thumbnails.")
        return None, 0, 0
    
    max_size = THUMBNAIL_SIZES.get(size, THUMBNAIL_SIZES['medium'])
    container_path = map_filepath_to_container(filepath)
    
    # Check if file exists (try both paths)
    actual_path = None
    for path in [container_path, filepath]:
        if os.path.exists(path):
            actual_path = path
            break
    
    if not actual_path:
        logger.error(f"File not found: {filepath} (tried: {container_path})")
        return None, 0, 0
    
    file_type = detect_file_type(filepath)
    
    try:
        if file_type == 'pdf':
            return _generate_pdf_thumbnail(actual_path, max_size)
        elif file_type in ('png', 'jpg', 'jpeg', 'gif', 'webp'):
            return _generate_image_thumbnail(actual_path, max_size)
        else:
            logger.warning(f"Unsupported file type: {file_type}")
            return None, 0, 0
    except Exception as e:
        logger.error(f"Error generating thumbnail for {filepath}: {e}")
        return None, 0, 0


def _generate_image_thumbnail(filepath: str, max_size: Tuple[int, int]) -> Tuple[Optional[bytes], int, int]:
    """Generate thumbnail from an image file using Pillow."""
    from PIL import Image
    
    with Image.open(filepath) as img:
        # Convert to RGB if necessary (for PNG with alpha, etc.)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Resize maintaining aspect ratio
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save to bytes buffer as JPEG (good compression, universal support)
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85, optimize=True)
        buffer.seek(0)
        
        return buffer.getvalue(), img.width, img.height


def _generate_pdf_thumbnail(filepath: str, max_size: Tuple[int, int]) -> Tuple[Optional[bytes], int, int]:
    """Generate thumbnail from the first page of a PDF using pdf2image."""
    try:
        from pdf2image import convert_from_path
        from PIL import Image
    except ImportError:
        logger.error("pdf2image not installed. Cannot generate PDF thumbnails.")
        return None, 0, 0
    
    try:
        # Convert first page only, at reasonable DPI for thumbnail
        # Use lower DPI for smaller thumbnails to speed up processing
        dpi = 72 if max_size[0] <= 150 else (100 if max_size[0] <= 300 else 150)
        
        images = convert_from_path(
            filepath,
            first_page=1,
            last_page=1,
            dpi=dpi,
            fmt='jpeg'
        )
        
        if not images:
            logger.warning(f"No pages found in PDF: {filepath}")
            return None, 0, 0
        
        img = images[0]
        
        # Resize to max_size
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save to bytes buffer
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85, optimize=True)
        buffer.seek(0)
        
        return buffer.getvalue(), img.width, img.height
        
    except Exception as e:
        logger.error(f"Error converting PDF to thumbnail: {e}")
        return None, 0, 0


def get_image_by_entity(
    db: Session,
    entity_type: str,
    entity_id: Optional[int] = None,
    entity_reference: Optional[str] = None
) -> Optional[EntityImage]:
    """
    Get an entity image from the database.
    
    Args:
        db: Database session
        entity_type: Type of entity (article, bom_item, workstep)
        entity_id: Entity ID (e.g., HUGWAWI article.id)
        entity_reference: Alternative reference (e.g., article number)
    
    Returns:
        EntityImage object or None if not found
    """
    query = db.query(EntityImage).filter(EntityImage.entity_type == entity_type)
    
    if entity_id:
        query = query.filter(EntityImage.entity_id == entity_id)
    elif entity_reference:
        query = query.filter(EntityImage.entity_reference == entity_reference)
    else:
        return None
    
    return query.first()


def save_image(
    db: Session,
    entity_type: str,
    filepath: str,
    thumbnail_size: str = 'medium',
    entity_id: Optional[int] = None,
    entity_reference: Optional[str] = None,
    uploaded_by: Optional[int] = None
) -> Optional[EntityImage]:
    """
    Save an entity image to the database.
    
    Generates a thumbnail from the original file and stores it as BLOB.
    If an image already exists for this entity, it will be updated.
    
    Args:
        db: Database session
        entity_type: Type of entity (article, bom_item, workstep)
        filepath: Path to the original file
        thumbnail_size: Size of thumbnail to generate (small, medium, large)
        entity_id: Entity ID (e.g., HUGWAWI article.id)
        entity_reference: Alternative reference (e.g., article number)
        uploaded_by: User ID who uploaded the image
    
    Returns:
        EntityImage object or None on failure
    """
    # Validate inputs
    if not entity_type or not filepath:
        logger.error("entity_type and filepath are required")
        return None
    
    if not entity_id and not entity_reference:
        logger.error("Either entity_id or entity_reference is required")
        return None
    
    # Detect file type
    file_type = detect_file_type(filepath)
    if not file_type:
        logger.error(f"Unsupported file type: {filepath}")
        return None
    
    # Generate thumbnail
    thumbnail_blob, width, height = generate_thumbnail(filepath, thumbnail_size)
    
    if thumbnail_blob is None:
        logger.error(f"Failed to generate thumbnail for: {filepath}")
        return None
    
    # Extract filename from path
    original_filename = os.path.basename(filepath)
    
    # Check if image already exists for this entity
    existing = get_image_by_entity(db, entity_type, entity_id, entity_reference)
    
    if existing:
        # Update existing record
        existing.original_filepath = filepath
        existing.original_filename = original_filename
        existing.file_type = file_type
        existing.thumbnail_size = thumbnail_size
        existing.thumbnail_blob = thumbnail_blob
        existing.thumbnail_width = width
        existing.thumbnail_height = height
        existing.uploaded_by = uploaded_by
        existing.uploaded_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new record
        new_image = EntityImage(
            entity_type=entity_type,
            entity_id=entity_id,
            entity_reference=entity_reference,
            original_filepath=filepath,
            original_filename=original_filename,
            file_type=file_type,
            thumbnail_size=thumbnail_size,
            thumbnail_blob=thumbnail_blob,
            thumbnail_width=width,
            thumbnail_height=height,
            uploaded_by=uploaded_by,
        )
        db.add(new_image)
        db.commit()
        db.refresh(new_image)
        return new_image


def delete_image(db: Session, image_id: int) -> bool:
    """
    Delete an entity image from the database.
    
    Args:
        db: Database session
        image_id: ID of the image to delete
    
    Returns:
        True if deleted, False if not found
    """
    image = db.query(EntityImage).filter(EntityImage.id == image_id).first()
    
    if not image:
        return False
    
    db.delete(image)
    db.commit()
    return True


def get_original_file_path(filepath: str) -> Optional[str]:
    """
    Get the actual file path that can be used to read the original file.
    
    Tries both the container-mapped path and the original path.
    
    Args:
        filepath: Original Windows filepath
    
    Returns:
        Path that exists, or None if file not found
    """
    container_path = map_filepath_to_container(filepath)
    
    for path in [container_path, filepath]:
        if os.path.exists(path):
            return path
    
    return None


def get_available_sizes() -> Dict[str, Dict[str, int]]:
    """
    Get available thumbnail sizes configuration.
    
    Returns:
        Dictionary of size names to dimensions
    """
    return {
        name: {'width': dims[0], 'height': dims[1]}
        for name, dims in THUMBNAIL_SIZES.items()
    }
