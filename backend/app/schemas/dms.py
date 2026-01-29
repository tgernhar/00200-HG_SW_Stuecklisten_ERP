"""
DMS (Document Management System) Schemas

Pydantic schemas for DMS API responses.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DMSDocumentResponse(BaseModel):
    """DMS Document response schema"""
    id: int
    description: Optional[str] = None
    filename: Optional[str] = None
    path: Optional[str] = None
    uploader_id: Optional[int] = None
    uploader_name: Optional[str] = None
    upload_time: Optional[datetime] = None
    tag: Optional[str] = None
    type_id: Optional[int] = None
    type_name: Optional[str] = None
    folder_id: Optional[int] = None
    folder_name: Optional[str] = None
    customer_id: Optional[int] = None
    lifecycle: Optional[int] = None
    version: int = 0
    file_exists: bool = False
    is_public: bool = False
    workflow_id: Optional[int] = None
    workflow_name: Optional[str] = None
    download_url: Optional[str] = None
    # Custom fields
    custom_text1: Optional[str] = None
    custom_text2: Optional[str] = None
    custom_text3: Optional[str] = None
    custom_text4: Optional[str] = None
    custom_text5: Optional[str] = None
    
    class Config:
        from_attributes = True


class DMSDocumentListResponse(BaseModel):
    """List of DMS documents with pagination"""
    items: List[DMSDocumentResponse]
    total: int
    limit: int
    offset: int


class DMSDocumentTypeResponse(BaseModel):
    """DMS Document Type response schema"""
    id: int
    name: str
    path_extension: Optional[str] = None
    folder: Optional[str] = None
    hash_tag: Optional[str] = None
    for_order_attachments: bool = True
    
    class Config:
        from_attributes = True


class DMSDocumentTypeListResponse(BaseModel):
    """List of document types"""
    items: List[DMSDocumentTypeResponse]
    total: int


class DMSFolderResponse(BaseModel):
    """DMS Folder response schema"""
    id: int
    name: str
    parent_folder_id: Optional[int] = None
    search_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class DMSFolderTreeNode(BaseModel):
    """Folder tree node"""
    id: int
    name: str
    children: List['DMSFolderTreeNode'] = []


# Enable self-referencing
DMSFolderTreeNode.model_rebuild()


class DMSFolderListResponse(BaseModel):
    """List of folders"""
    items: List[DMSFolderResponse]
    total: int


class DMSDocumentHistoryEntry(BaseModel):
    """Document history entry"""
    id: int
    document_id: int
    version_date: Optional[datetime] = None
    uploader_id: Optional[int] = None
    uploader_name: Optional[str] = None
    version: int
    path: Optional[str] = None


class DMSDocumentHistoryResponse(BaseModel):
    """Document history response"""
    document_id: int
    entries: List[DMSDocumentHistoryEntry]


class DMSDocumentNoteEntry(BaseModel):
    """Document note entry"""
    id: int
    document_id: int
    text: Optional[str] = None
    type: Optional[int] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    created: Optional[datetime] = None


class DMSDocumentNotesResponse(BaseModel):
    """Document notes response"""
    document_id: int
    notes: List[DMSDocumentNoteEntry]


class DMSSearchRequest(BaseModel):
    """Search request parameters"""
    search_term: Optional[str] = None
    document_type_id: Optional[int] = None
    folder_id: Optional[int] = None
    customer_id: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    limit: int = 100
    offset: int = 0
