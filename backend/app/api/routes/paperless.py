"""
Paperless-ngx API Routes

Provides endpoints for Paperless-ngx document management integration.
Supports document upload, search, and metadata management.
"""
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
import tempfile
import os
import logging

from app.services.paperless_service import get_paperless_service, PaperlessDocument
from app.services.auth_service import decode_access_token
from app.schemas.paperless import (
    PaperlessDocumentResponse,
    PaperlessDocumentListResponse,
    PaperlessUploadResponse,
    PaperlessCorrespondentResponse,
    PaperlessDocumentTypeResponse,
    PaperlessTagResponse,
    PaperlessCustomFieldResponse,
    PaperlessConnectionStatus,
)

router = APIRouter(prefix="/paperless", tags=["Paperless-ngx"])
logger = logging.getLogger(__name__)

# Require authentication for Paperless operations
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current user from JWT token"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token ungültig")
    
    return payload


def _document_to_response(doc: PaperlessDocument) -> PaperlessDocumentResponse:
    """Convert PaperlessDocument to response schema"""
    return PaperlessDocumentResponse(
        id=doc.id,
        title=doc.title,
        content=doc.content[:500] if doc.content else None,  # Truncate content
        created=doc.created,
        modified=doc.modified,
        added=doc.added,
        archive_serial_number=doc.archive_serial_number,
        original_file_name=doc.original_file_name,
        correspondent_id=doc.correspondent,
        correspondent_name=doc.correspondent_name,
        document_type_id=doc.document_type,
        document_type_name=doc.document_type_name,
        tags=doc.tags,
        tag_names=doc.tag_names,
        custom_fields=doc.custom_fields,
        download_url=doc.download_url,
        original_download_url=doc.original_download_url,
        thumbnail_url=doc.thumbnail_url,
    )


# =============================================================================
# Connection Test
# =============================================================================

@router.get("/status", response_model=PaperlessConnectionStatus)
async def get_connection_status(current_user: dict = Depends(get_current_user)):
    """
    Test connection to Paperless-ngx server.
    """
    from app.core.config import settings
    
    service = get_paperless_service()
    connected = service.test_connection()
    
    return PaperlessConnectionStatus(
        connected=connected,
        url=settings.PAPERLESS_URL,
        message="Verbindung erfolgreich" if connected else "Verbindung fehlgeschlagen"
    )


# =============================================================================
# Document Operations
# =============================================================================

@router.post("/documents/upload", response_model=PaperlessUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    correspondent_id: Optional[int] = Form(None),
    document_type_id: Optional[int] = Form(None),
    tag_ids: Optional[str] = Form(None),  # Comma-separated IDs
    erp_order_id: Optional[int] = Form(None),
    erp_order_number: Optional[str] = Form(None),
    erp_article_id: Optional[int] = Form(None),
    erp_article_number: Optional[str] = Form(None),
    erp_order_article_id: Optional[int] = Form(None),
    erp_bom_item_id: Optional[int] = Form(None),
    erp_operation_id: Optional[int] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a document to Paperless-ngx.
    
    The document will be processed asynchronously by Paperless.
    ERP entity links are stored as custom fields.
    
    If no correspondent_id is provided but erp_order_id or erp_order_number is given,
    the correspondent is automatically determined from HUGWAWI (ordertable.kid -> adrbase.suchname)
    and created in Paperless if it doesn't exist.
    
    Additionally, customer_number (adrbase.kdn) and order_name (ordertable.name) are 
    automatically fetched from HUGWAWI and stored as custom fields.
    """
    from app.core.database import get_erp_db_connection
    from app.services.erp_service import get_order_paperless_info, get_order_paperless_info_by_order_name
    
    service = get_paperless_service()
    
    # Auto-resolve correspondent and additional fields from HUGWAWI
    resolved_correspondent_id = correspondent_id
    hugwawi_customer_number = None
    hugwawi_order_name = None
    
    if erp_order_id or erp_order_number:
        try:
            erp_conn = get_erp_db_connection()
            try:
                paperless_info = None
                if erp_order_id:
                    paperless_info = get_order_paperless_info(erp_order_id, erp_conn)
                elif erp_order_number:
                    paperless_info = get_order_paperless_info_by_order_name(erp_order_number, erp_conn)
                
                if paperless_info:
                    # Extract customer number and order name for custom fields
                    hugwawi_customer_number = paperless_info.get("customer_number")
                    hugwawi_order_name = paperless_info.get("order_name")
                    
                    # Find or create correspondent if not provided
                    customer_name = paperless_info.get("customer_name")
                    if resolved_correspondent_id is None and customer_name:
                        resolved_correspondent_id = service.find_or_create_correspondent(customer_name)
                        logger.info(f"Resolved correspondent '{customer_name}' to Paperless ID {resolved_correspondent_id}")
            finally:
                erp_conn.close()
        except Exception as e:
            logger.warning(f"Could not resolve data from HUGWAWI: {e}")
            # Continue without HUGWAWI data - upload should still work
    
    # Ensure custom fields exist
    field_ids = service.ensure_erp_custom_fields()
    
    # Build custom fields dict
    custom_fields = {}
    if erp_order_id and "erp_order_id" in field_ids:
        custom_fields[field_ids["erp_order_id"]] = erp_order_id
    # Use HUGWAWI order_name if available, otherwise fall back to provided erp_order_number
    order_number_value = hugwawi_order_name or erp_order_number
    if order_number_value and "erp_order_number" in field_ids:
        custom_fields[field_ids["erp_order_number"]] = order_number_value
    # Add customer number from HUGWAWI
    if hugwawi_customer_number and "erp_customer_number" in field_ids:
        custom_fields[field_ids["erp_customer_number"]] = hugwawi_customer_number
    if erp_article_id and "erp_article_id" in field_ids:
        custom_fields[field_ids["erp_article_id"]] = erp_article_id
    if erp_article_number and "erp_article_number" in field_ids:
        custom_fields[field_ids["erp_article_number"]] = erp_article_number
    if erp_order_article_id and "erp_order_article_id" in field_ids:
        custom_fields[field_ids["erp_order_article_id"]] = erp_order_article_id
    if erp_bom_item_id and "erp_bom_item_id" in field_ids:
        custom_fields[field_ids["erp_bom_item_id"]] = erp_bom_item_id
    if erp_operation_id and "erp_operation_id" in field_ids:
        custom_fields[field_ids["erp_operation_id"]] = erp_operation_id
    
    # Parse tag_ids
    parsed_tag_ids = None
    if tag_ids:
        parsed_tag_ids = [int(t.strip()) for t in tag_ids.split(",") if t.strip()]
    
    # Save uploaded file temporarily
    temp_file = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Upload to Paperless
        task_id = service.upload_document(
            file_path=temp_path,
            title=title or file.filename,
            correspondent_id=resolved_correspondent_id,
            document_type_id=document_type_id,
            tag_ids=parsed_tag_ids,
            custom_fields=custom_fields if custom_fields else None,
        )
        
        if task_id:
            return PaperlessUploadResponse(
                success=True,
                task_id=str(task_id),
                message="Dokument wird verarbeitet"
            )
        else:
            return PaperlessUploadResponse(
                success=False,
                message="Upload fehlgeschlagen"
            )
            
    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_path):
            os.unlink(temp_path)


@router.get("/documents/{document_id}", response_model=PaperlessDocumentResponse)
async def get_document(
    document_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get a Paperless document by ID"""
    service = get_paperless_service()
    doc = service.get_document(document_id)
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    return _document_to_response(doc)


@router.get("/documents", response_model=PaperlessDocumentListResponse)
async def search_documents(
    q: Optional[str] = Query(None, description="Suchbegriff"),
    correspondent_id: Optional[int] = Query(None, description="Korrespondent-ID"),
    document_type_id: Optional[int] = Query(None, description="Dokumenttyp-ID"),
    tag_ids: Optional[str] = Query(None, description="Tag-IDs (kommagetrennt)"),
    erp_order_id: Optional[int] = Query(None, description="ERP Auftrags-ID"),
    erp_article_id: Optional[int] = Query(None, description="ERP Artikel-ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """
    Search Paperless documents.
    
    Supports full-text search and filtering by metadata.
    """
    service = get_paperless_service()
    
    # Parse tag_ids
    parsed_tag_ids = None
    if tag_ids:
        parsed_tag_ids = [int(t.strip()) for t in tag_ids.split(",") if t.strip()]
    
    # Build search query for ERP fields
    search_query = q or ""
    if erp_order_id:
        search_query += f" erp_order_id:{erp_order_id}"
    if erp_article_id:
        search_query += f" erp_article_id:{erp_article_id}"
    
    documents = service.search_documents(
        query=search_query.strip() if search_query.strip() else None,
        correspondent_id=correspondent_id,
        document_type_id=document_type_id,
        tag_ids=parsed_tag_ids,
        page=page,
        page_size=page_size,
    )
    
    return PaperlessDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),  # Note: This is page count, not total
    )


# =============================================================================
# ERP Entity Document Endpoints
# =============================================================================

@router.get("/orders/{order_id}/documents", response_model=PaperlessDocumentListResponse)
async def get_order_documents(
    order_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get all Paperless documents linked to an order via custom field"""
    service = get_paperless_service()
    
    # Search by custom field
    documents = service.search_documents(query=f"erp_order_id:{order_id}")
    
    return PaperlessDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
    )


@router.get("/articles/{article_id}/documents", response_model=PaperlessDocumentListResponse)
async def get_article_documents(
    article_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get all Paperless documents linked to an article via custom field"""
    service = get_paperless_service()
    
    documents = service.search_documents(query=f"erp_article_id:{article_id}")
    
    return PaperlessDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
    )


@router.get("/order-articles/{order_article_id}/documents", response_model=PaperlessDocumentListResponse)
async def get_order_article_documents(
    order_article_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get all Paperless documents linked to an order article via custom field"""
    service = get_paperless_service()
    
    documents = service.search_documents(query=f"erp_order_article_id:{order_article_id}")
    
    return PaperlessDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
    )


@router.get("/bom-items/{bom_item_id}/documents", response_model=PaperlessDocumentListResponse)
async def get_bom_item_documents(
    bom_item_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get all Paperless documents linked to a BOM item via custom field"""
    service = get_paperless_service()
    
    documents = service.search_documents(query=f"erp_bom_item_id:{bom_item_id}")
    
    return PaperlessDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
    )


@router.get("/operations/{operation_id}/documents", response_model=PaperlessDocumentListResponse)
async def get_operation_documents(
    operation_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Get all Paperless documents linked to an operation via custom field"""
    service = get_paperless_service()
    
    documents = service.search_documents(query=f"erp_operation_id:{operation_id}")
    
    return PaperlessDocumentListResponse(
        items=[_document_to_response(doc) for doc in documents],
        total=len(documents),
    )


# =============================================================================
# Metadata Endpoints
# =============================================================================

@router.get("/correspondents", response_model=List[PaperlessCorrespondentResponse])
async def get_correspondents(current_user: dict = Depends(get_current_user)):
    """Get all Paperless correspondents (customers/suppliers)"""
    service = get_paperless_service()
    correspondents = service.get_correspondents()
    
    return [
        PaperlessCorrespondentResponse(
            id=c.id,
            name=c.name,
            document_count=c.document_count,
        )
        for c in correspondents
    ]


@router.get("/document-types", response_model=List[PaperlessDocumentTypeResponse])
async def get_document_types(current_user: dict = Depends(get_current_user)):
    """Get all Paperless document types"""
    service = get_paperless_service()
    types = service.get_document_types()
    
    return [
        PaperlessDocumentTypeResponse(
            id=t.id,
            name=t.name,
            document_count=t.document_count,
        )
        for t in types
    ]


@router.get("/tags", response_model=List[PaperlessTagResponse])
async def get_tags(current_user: dict = Depends(get_current_user)):
    """Get all Paperless tags"""
    service = get_paperless_service()
    tags = service.get_tags()
    
    return [
        PaperlessTagResponse(
            id=t.id,
            name=t.name,
            color=t.color,
            document_count=t.document_count,
        )
        for t in tags
    ]


@router.get("/custom-fields", response_model=List[PaperlessCustomFieldResponse])
async def get_custom_fields(current_user: dict = Depends(get_current_user)):
    """Get all Paperless custom field definitions"""
    service = get_paperless_service()
    fields = service.get_custom_fields()
    
    return [
        PaperlessCustomFieldResponse(
            id=f.id,
            name=f.name,
            data_type=f.data_type,
        )
        for f in fields
    ]


@router.post("/setup-erp-fields", response_model=List[PaperlessCustomFieldResponse])
async def setup_erp_custom_fields(current_user: dict = Depends(get_current_user)):
    """
    Ensure all ERP-related custom fields exist in Paperless.
    Creates them if they don't exist.
    """
    service = get_paperless_service()
    field_mapping = service.ensure_erp_custom_fields()
    
    # Return created/existing fields
    all_fields = service.get_custom_fields()
    erp_fields = [f for f in all_fields if f.name.startswith("erp_")]
    
    return [
        PaperlessCustomFieldResponse(
            id=f.id,
            name=f.name,
            data_type=f.data_type,
        )
        for f in erp_fields
    ]
