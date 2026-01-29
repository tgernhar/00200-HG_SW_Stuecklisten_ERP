"""
Paperless-ngx Pydantic Schemas
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class PaperlessDocumentResponse(BaseModel):
    """Paperless document response"""
    id: int
    title: str
    content: Optional[str] = None
    created: Optional[datetime] = None
    modified: Optional[datetime] = None
    added: Optional[datetime] = None
    archive_serial_number: Optional[int] = None
    original_file_name: Optional[str] = None
    correspondent_id: Optional[int] = None
    correspondent_name: Optional[str] = None
    document_type_id: Optional[int] = None
    document_type_name: Optional[str] = None
    tags: List[int] = []
    tag_names: List[str] = []
    custom_fields: Dict[str, Any] = {}
    download_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class PaperlessDocumentListResponse(BaseModel):
    """List of Paperless documents"""
    items: List[PaperlessDocumentResponse]
    total: int


class PaperlessUploadRequest(BaseModel):
    """Request to upload a document to Paperless"""
    title: Optional[str] = None
    correspondent_id: Optional[int] = None
    document_type_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    # ERP entity links (stored as custom fields)
    erp_order_id: Optional[int] = None
    erp_order_number: Optional[str] = None
    erp_article_id: Optional[int] = None
    erp_article_number: Optional[str] = None
    erp_order_article_id: Optional[int] = None
    erp_bom_item_id: Optional[int] = None
    erp_operation_id: Optional[int] = None


class PaperlessUploadResponse(BaseModel):
    """Response after document upload"""
    success: bool
    task_id: Optional[str] = None
    message: Optional[str] = None


class PaperlessCorrespondentResponse(BaseModel):
    """Paperless correspondent"""
    id: int
    name: str
    document_count: int = 0


class PaperlessDocumentTypeResponse(BaseModel):
    """Paperless document type"""
    id: int
    name: str
    document_count: int = 0


class PaperlessTagResponse(BaseModel):
    """Paperless tag"""
    id: int
    name: str
    color: Optional[str] = None
    document_count: int = 0


class PaperlessCustomFieldResponse(BaseModel):
    """Paperless custom field definition"""
    id: int
    name: str
    data_type: str


class PaperlessConnectionStatus(BaseModel):
    """Paperless connection status"""
    connected: bool
    url: str
    message: Optional[str] = None
