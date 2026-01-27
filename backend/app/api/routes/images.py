"""
Image Management API Routes

Provides endpoints for uploading, retrieving, and managing images
for articles, BOM items, and worksteps.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse, Response
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import os
import mimetypes

from app.core.database import get_db
from app.models.entity_image import EntityImage
from app.services import image_service

router = APIRouter(prefix="/images", tags=["images"])


# ============== Pydantic Models ==============

class ImageUploadRequest(BaseModel):
    """Request body for image upload"""
    entity_type: str  # "article", "bom_item", "workstep"
    entity_id: Optional[int] = None  # Reference ID (e.g., HUGWAWI article.id)
    entity_reference: Optional[str] = None  # Alternative reference (e.g., article number)
    filepath: str  # Full path to the original file
    thumbnail_size: Optional[str] = "medium"  # "small", "medium", "large"


class ImageResponse(BaseModel):
    """Response for image retrieval"""
    id: int
    entity_type: str
    entity_id: Optional[int]
    entity_reference: Optional[str]
    original_filepath: str
    original_filename: Optional[str]
    file_type: Optional[str]
    thumbnail_size: Optional[str]
    thumbnail_base64: Optional[str]
    thumbnail_width: Optional[int]
    thumbnail_height: Optional[int]
    
    class Config:
        from_attributes = True


class ImageUploadResponse(BaseModel):
    """Response for successful upload"""
    success: bool
    id: int
    entity_type: str
    entity_id: Optional[int]
    entity_reference: Optional[str]
    original_filename: Optional[str]
    thumbnail_size: Optional[str]
    thumbnail_width: Optional[int]
    thumbnail_height: Optional[int]


# ============== API Endpoints ==============

@router.post("/upload", response_model=ImageUploadResponse)
async def upload_image(
    request: ImageUploadRequest,
    db: Session = Depends(get_db)
):
    """
    Upload an image for an entity.
    
    Generates a thumbnail from the original file and stores it in the database.
    The original file is referenced by filepath and served on demand.
    
    Args:
        request: Upload request with entity type, ID/reference, and filepath
    
    Returns:
        Upload response with image ID and thumbnail info
    """
    # Validate entity identification
    if not request.entity_id and not request.entity_reference:
        raise HTTPException(
            status_code=400,
            detail="Either entity_id or entity_reference is required"
        )
    
    # Validate entity type
    valid_types = {'article', 'bom_item', 'workstep'}
    if request.entity_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity_type. Must be one of: {', '.join(valid_types)}"
        )
    
    # Validate thumbnail size
    valid_sizes = {'small', 'medium', 'large'}
    thumbnail_size = request.thumbnail_size or 'medium'
    if thumbnail_size not in valid_sizes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid thumbnail_size. Must be one of: {', '.join(valid_sizes)}"
        )
    
    # Validate file type
    file_type = image_service.detect_file_type(request.filepath)
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Supported: PDF, PNG, JPG, JPEG, GIF, WebP"
        )
    
    # Save image (generates thumbnail)
    result = image_service.save_image(
        db=db,
        entity_type=request.entity_type,
        filepath=request.filepath,
        thumbnail_size=thumbnail_size,
        entity_id=request.entity_id,
        entity_reference=request.entity_reference,
    )
    
    if not result:
        raise HTTPException(
            status_code=500,
            detail="Failed to process image. Check if file exists and is accessible."
        )
    
    return ImageUploadResponse(
        success=True,
        id=result.id,
        entity_type=result.entity_type,
        entity_id=result.entity_id,
        entity_reference=result.entity_reference,
        original_filename=result.original_filename,
        thumbnail_size=result.thumbnail_size,
        thumbnail_width=result.thumbnail_width,
        thumbnail_height=result.thumbnail_height,
    )


@router.get("/{entity_type}/{entity_id}")
async def get_image(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db)
):
    """
    Get image for an entity by type and ID.
    
    Returns thumbnail as base64 and original filepath for browser access.
    
    Args:
        entity_type: Type of entity (article, bom_item, workstep)
        entity_id: Entity ID
    
    Returns:
        Image data with thumbnail and filepath
    """
    image = image_service.get_image_by_entity(db, entity_type, entity_id)
    
    if not image:
        raise HTTPException(
            status_code=404,
            detail=f"No image found for {entity_type} with ID {entity_id}"
        )
    
    return JSONResponse(content={
        "id": image.id,
        "entity_type": image.entity_type,
        "entity_id": image.entity_id,
        "entity_reference": image.entity_reference,
        "original_filepath": image.original_filepath,
        "original_filename": image.original_filename,
        "file_type": image.file_type,
        "thumbnail_size": image.thumbnail_size,
        "thumbnail_base64": image.thumbnail_base64,
        "thumbnail_width": image.thumbnail_width,
        "thumbnail_height": image.thumbnail_height,
    })


@router.get("/by-reference/{entity_type}/{entity_reference:path}")
async def get_image_by_reference(
    entity_type: str,
    entity_reference: str,
    db: Session = Depends(get_db)
):
    """
    Get image for an entity by type and reference string.
    
    Alternative to ID-based lookup when entity_reference (e.g., article number) is used.
    
    Args:
        entity_type: Type of entity (article, bom_item, workstep)
        entity_reference: Entity reference string (e.g., article number)
    
    Returns:
        Image data with thumbnail and filepath
    """
    image = image_service.get_image_by_entity(db, entity_type, entity_reference=entity_reference)
    
    if not image:
        raise HTTPException(
            status_code=404,
            detail=f"No image found for {entity_type} with reference '{entity_reference}'"
        )
    
    return JSONResponse(content={
        "id": image.id,
        "entity_type": image.entity_type,
        "entity_id": image.entity_id,
        "entity_reference": image.entity_reference,
        "original_filepath": image.original_filepath,
        "original_filename": image.original_filename,
        "file_type": image.file_type,
        "thumbnail_size": image.thumbnail_size,
        "thumbnail_base64": image.thumbnail_base64,
        "thumbnail_width": image.thumbnail_width,
        "thumbnail_height": image.thumbnail_height,
    })


@router.get("/file")
async def get_original_file(
    path: str = Query(..., description="Original file path")
):
    """
    Serve the original file for browser viewing.
    
    Maps Windows filepath to container mount and serves with correct Content-Type.
    Used when user clicks on thumbnail to view original PDF/image.
    
    Args:
        path: Original Windows filepath
    
    Returns:
        File response with appropriate Content-Type
    """
    actual_path = image_service.get_original_file_path(path)
    
    if not actual_path:
        raise HTTPException(
            status_code=404,
            detail=f"File not found: {path}"
        )
    
    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(actual_path)
    if not mime_type:
        # Default based on extension
        ext = os.path.splitext(actual_path)[1].lower()
        mime_types = {
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
        }
        mime_type = mime_types.get(ext, 'application/octet-stream')
    
    # For PDFs, serve inline so browser displays them
    filename = os.path.basename(actual_path)
    
    return FileResponse(
        path=actual_path,
        media_type=mime_type,
        filename=filename,
        headers={
            "Content-Disposition": f"inline; filename=\"{filename}\""
        }
    )


@router.delete("/{image_id}")
async def delete_image(
    image_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete an entity image.
    
    Removes the image record from the database.
    The original file is NOT deleted (only the thumbnail and reference).
    
    Args:
        image_id: ID of the image to delete
    
    Returns:
        Success confirmation
    """
    success = image_service.delete_image(db, image_id)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Image with ID {image_id} not found"
        )
    
    return JSONResponse(content={
        "success": True,
        "deleted_id": image_id
    })


@router.get("/config/sizes")
async def get_available_sizes():
    """
    Get available thumbnail size configurations.
    
    Returns the supported sizes with their dimensions.
    
    Returns:
        Dictionary of size names to dimensions
    """
    return JSONResponse(content=image_service.get_available_sizes())
