"""
DMS (Document Management System) API Routes

Provides read-only access to HUGWAWI DMS documents.
All endpoints are GET-only since HUGWAWI DB is read-only.
Respects HUGWAWI workflow access rights based on authenticated user.
"""
from fastapi import APIRouter, HTTPException, Query, Response, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime
import os
import logging

from app.services.dms_service import get_dms_service, DMSDocument
from app.services.auth_service import decode_access_token
from app.schemas.dms import (
    DMSDocumentResponse,
    DMSDocumentListResponse,
    DMSDocumentTypeResponse,
    DMSDocumentTypeListResponse,
    DMSFolderResponse,
    DMSFolderListResponse,
    DMSFolderTreeNode,
    DMSDocumentHistoryResponse,
    DMSDocumentHistoryEntry,
    DMSDocumentNotesResponse,
    DMSDocumentNoteEntry,
)

router = APIRouter(prefix="/dms", tags=["DMS"])
logger = logging.getLogger(__name__)

# Optional security - doesn't require auth but uses it for permissions if available
security = HTTPBearer(auto_error=False)


async def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[int]:
    """
    Get user ID from JWT token if available.
    Returns None if no token or invalid token (allows unauthenticated access).
    """
    if not credentials:
        return None
    
    try:
        payload = decode_access_token(credentials.credentials)
        if payload and 'user_id' in payload:
            return payload['user_id']
    except Exception:
        pass
    
    return None


def _document_to_response(doc: DMSDocument, api_base: str = "/api/dms") -> DMSDocumentResponse:
    """Convert DMSDocument to response schema"""
    return DMSDocumentResponse(
        id=doc.id,
        description=doc.description,
        filename=doc.filename,
        path=doc.path,
        uploader_id=doc.uploader_id,
        uploader_name=doc.uploader_name,
        upload_time=doc.upload_time,
        tag=doc.tag,
        type_id=doc.type_id,
        type_name=doc.type_name,
        folder_id=doc.folder_id,
        folder_name=doc.folder_name,
        customer_id=doc.customer_id,
        lifecycle=doc.lifecycle,
        version=doc.version,
        file_exists=doc.file_exists,
        is_public=doc.is_public,
        workflow_id=doc.workflow_id,
        workflow_name=doc.workflow_name,
        download_url=f"{api_base}/documents/{doc.id}/download",
        custom_text1=doc.custom_text1,
        custom_text2=doc.custom_text2,
        custom_text3=doc.custom_text3,
        custom_text4=doc.custom_text4,
        custom_text5=doc.custom_text5,
    )


# =============================================================================
# Document Endpoints
# =============================================================================

@router.get("/documents/{document_id}", response_model=DMSDocumentResponse)
async def get_document(
    document_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get a single DMS document by ID.
    Respects workflow permissions based on authenticated user.
    """
    service = get_dms_service(user_id=user_id)
    doc = service.get_document_by_id(document_id)
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden oder keine Berechtigung")
    
    return _document_to_response(doc)


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Download a DMS document file.
    
    Note: This endpoint proxies the file from the HUGWAWI file storage.
    The actual file path is resolved from dms_config.dmsdocuments.
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    
    # Get document (permission check happens here)
    doc = service.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden oder keine Berechtigung")
    
    # Get file path
    file_path = service.get_document_file_path(document_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Dateipfad nicht verfügbar")
    
    # Check if file exists
    # Note: In Docker, this might need path mapping similar to document_service.py
    if not os.path.exists(file_path):
        # Try to map Windows path to container path if running in Docker
        file_path_container = _to_container_path(file_path)
        if file_path_container and os.path.exists(file_path_container):
            file_path = file_path_container
        else:
            raise HTTPException(
                status_code=404, 
                detail=f"Datei nicht gefunden: {doc.filename}"
            )
    
    # Determine media type
    filename = doc.filename or "document"
    media_type = _get_media_type(filename)
    
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename,
        content_disposition_type="attachment"
    )


@router.get("/documents/{document_id}/history", response_model=DMSDocumentHistoryResponse)
async def get_document_history(
    document_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get version history for a document.
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    
    # Verify document exists and user has permission
    doc = service.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden oder keine Berechtigung")
    
    history = service.get_document_history(document_id)
    
    return DMSDocumentHistoryResponse(
        document_id=document_id,
        entries=[
            DMSDocumentHistoryEntry(
                id=h['id'],
                document_id=h['document_id'],
                version_date=h['version_date'],
                uploader_id=h['uploader_id'],
                uploader_name=h['uploader_name'],
                version=h['version'],
                path=h['path']
            )
            for h in history
        ]
    )


@router.get("/documents/{document_id}/notes", response_model=DMSDocumentNotesResponse)
async def get_document_notes(
    document_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get notes for a document.
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    
    # Verify document exists and user has permission
    doc = service.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden oder keine Berechtigung")
    
    notes = service.get_document_notes(document_id)
    
    return DMSDocumentNotesResponse(
        document_id=document_id,
        notes=[
            DMSDocumentNoteEntry(
                id=n['id'],
                document_id=n['document_id'],
                text=n['text'],
                type=n['type'],
                user_id=n['user_id'],
                user_name=n['user_name'],
                created=n['created']
            )
            for n in notes
        ]
    )


# =============================================================================
# Search Endpoint
# =============================================================================

@router.get("/search", response_model=DMSDocumentListResponse)
async def search_documents(
    q: Optional[str] = Query(None, description="Suchbegriff"),
    document_type_id: Optional[int] = Query(None, description="Dokumenttyp-ID"),
    folder_id: Optional[int] = Query(None, description="Ordner-ID"),
    customer_id: Optional[int] = Query(None, description="Kunden-ID"),
    date_from: Optional[datetime] = Query(None, description="Von Datum"),
    date_to: Optional[datetime] = Query(None, description="Bis Datum"),
    limit: int = Query(100, ge=1, le=500, description="Max. Ergebnisse"),
    offset: int = Query(0, ge=0, description="Offset für Pagination"),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    """
    Search DMS documents with various filters.
    Respects workflow permissions based on authenticated user.
    """
    service = get_dms_service(user_id=user_id)
    
    documents = service.search_documents(
        search_term=q,
        document_type_id=document_type_id,
        folder_id=folder_id,
        customer_id=customer_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset
    )
    
    total = service.count_documents(
        search_term=q,
        document_type_id=document_type_id,
        folder_id=folder_id,
        customer_id=customer_id,
        date_from=date_from,
        date_to=date_to
    )
    
    return DMSDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=total,
        limit=limit,
        offset=offset
    )


# =============================================================================
# Order Documents
# =============================================================================

@router.get("/orders/{order_id}/documents", response_model=DMSDocumentListResponse)
async def get_order_documents(
    order_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get all documents linked to an order (ordertable.id).
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    documents = service.get_documents_for_order(order_id)
    
    return DMSDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
        limit=len(documents),
        offset=0
    )


# =============================================================================
# Article Documents
# =============================================================================

@router.get("/articles/{article_id}/documents", response_model=DMSDocumentListResponse)
async def get_article_documents(
    article_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get all documents linked to an article (article.id - ERP Stammartikel).
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    documents = service.get_documents_for_article(article_id)
    
    return DMSDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
        limit=len(documents),
        offset=0
    )


# =============================================================================
# Order Article Documents
# =============================================================================

@router.get("/order-articles/{order_article_id}/documents", response_model=DMSDocumentListResponse)
async def get_order_article_documents(
    order_article_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get all documents linked to an order article (order_article.id).
    Requires dms_order_article table in HUGWAWI.
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    documents = service.get_documents_for_order_article(order_article_id)
    
    return DMSDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
        limit=len(documents),
        offset=0
    )


# =============================================================================
# BOM Item Documents
# =============================================================================

@router.get("/bom-items/{packingnote_details_id}/documents", response_model=DMSDocumentListResponse)
async def get_bom_item_documents(
    packingnote_details_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get all documents linked to a BOM item (packingnote_details.id).
    Requires dms_packingnote_details table in HUGWAWI.
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    documents = service.get_documents_for_bom_item(packingnote_details_id)
    
    return DMSDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
        limit=len(documents),
        offset=0
    )


# =============================================================================
# Operation Documents
# =============================================================================

@router.get("/operations/{workplan_details_id}/documents", response_model=DMSDocumentListResponse)
async def get_operation_documents(
    workplan_details_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get all documents linked to an operation/workplan item (workplan_details.id).
    Requires dms_workplan_details table in HUGWAWI.
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    documents = service.get_documents_for_operation(workplan_details_id)
    
    return DMSDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
        limit=len(documents),
        offset=0
    )


# =============================================================================
# Customer Documents
# =============================================================================

@router.get("/customers/{customer_id}/documents", response_model=DMSDocumentListResponse)
async def get_customer_documents(
    customer_id: int,
    user_id: Optional[int] = Depends(get_optional_user_id)
):
    """
    Get all documents linked to a customer via kid field.
    Respects workflow permissions.
    """
    service = get_dms_service(user_id=user_id)
    documents = service.get_documents_for_customer(customer_id)
    
    return DMSDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
        limit=len(documents),
        offset=0
    )


# =============================================================================
# Document Types
# =============================================================================

@router.get("/types", response_model=DMSDocumentTypeListResponse)
async def get_document_types():
    """
    Get all DMS document types.
    """
    service = get_dms_service()
    types = service.get_document_types()
    
    return DMSDocumentTypeListResponse(
        items=[
            DMSDocumentTypeResponse(
                id=t.id,
                name=t.name,
                path_extension=t.path_extension,
                folder=t.folder,
                hash_tag=t.hash_tag,
                for_order_attachments=t.for_order_attachments
            )
            for t in types
        ],
        total=len(types)
    )


# =============================================================================
# Folders
# =============================================================================

@router.get("/folders", response_model=DMSFolderListResponse)
async def get_folders(parent_id: Optional[int] = Query(None, description="Parent folder ID")):
    """
    Get DMS folders, optionally filtered by parent folder.
    """
    service = get_dms_service()
    folders = service.get_folders(parent_id)
    
    return DMSFolderListResponse(
        items=[
            DMSFolderResponse(
                id=f.id,
                name=f.name,
                parent_folder_id=f.parent_folder_id,
                search_name=f.search_name
            )
            for f in folders
        ],
        total=len(folders)
    )


@router.get("/folders/tree", response_model=List[DMSFolderTreeNode])
async def get_folder_tree():
    """
    Get DMS folder tree structure.
    """
    service = get_dms_service()
    tree = service.get_folder_tree()
    
    def convert_node(node: dict) -> DMSFolderTreeNode:
        return DMSFolderTreeNode(
            id=node['id'],
            name=node['name'],
            children=[convert_node(c) for c in node.get('children', [])]
        )
    
    return [convert_node(n) for n in tree]


# =============================================================================
# Helper Functions
# =============================================================================

def _to_container_path(p: str) -> Optional[str]:
    """
    Map Windows path to Docker container mount path.
    Similar to document_service.py mapping.
    """
    if not p:
        return None
    p2 = p.replace("\\", "/")
    # Add mapping rules based on your HUGWAWI DMS file storage location
    # Example: C:/DMS/ -> /mnt/dms/
    prefix_mappings = [
        ("C:/Thomas/Solidworks/", "/mnt/solidworks/"),
        ("G:/DMS/", "/mnt/dms/"),
        # Add more mappings as needed
    ]
    for win_prefix, container_prefix in prefix_mappings:
        if p2.lower().startswith(win_prefix.lower()):
            return container_prefix + p2[len(win_prefix):]
    return None


def _get_media_type(filename: str) -> str:
    """Get media type based on file extension"""
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    
    media_types = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'tif': 'image/tiff',
        'tiff': 'image/tiff',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'xml': 'application/xml',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'dwg': 'application/acad',
        'dxf': 'application/dxf',
        'stp': 'application/step',
        'step': 'application/step',
        'igs': 'application/iges',
        'iges': 'application/iges',
    }
    
    return media_types.get(ext, 'application/octet-stream')
