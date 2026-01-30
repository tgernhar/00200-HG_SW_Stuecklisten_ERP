"""
Paperless-ngx DMS Integration Service

Provides integration with Paperless-ngx for document management.
Supports uploading documents and linking them to ERP entities via custom fields.

API Documentation: https://docs.paperless-ngx.com/api/
"""
import logging
import httpx
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# Timeout for API requests (seconds)
API_TIMEOUT = 30


@dataclass
class PaperlessDocument:
    """Paperless document data class"""
    id: int
    title: str
    content: Optional[str]
    created: Optional[datetime]
    modified: Optional[datetime]
    added: Optional[datetime]
    archive_serial_number: Optional[int]
    original_file_name: Optional[str]
    archived_file_name: Optional[str]
    correspondent: Optional[int]
    correspondent_name: Optional[str]
    document_type: Optional[int]
    document_type_name: Optional[str]
    tags: List[int]
    tag_names: List[str]
    custom_fields: Dict[str, Any]
    download_url: Optional[str] = None
    original_download_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


@dataclass
class PaperlessCorrespondent:
    """Paperless correspondent (e.g., customer/supplier)"""
    id: int
    name: str
    match: Optional[str]
    matching_algorithm: int
    is_insensitive: bool
    document_count: int


@dataclass
class PaperlessDocumentType:
    """Paperless document type"""
    id: int
    name: str
    match: Optional[str]
    matching_algorithm: int
    is_insensitive: bool
    document_count: int


@dataclass
class PaperlessTag:
    """Paperless tag"""
    id: int
    name: str
    color: Optional[str]
    match: Optional[str]
    matching_algorithm: int
    is_insensitive: bool
    document_count: int


@dataclass
class PaperlessCustomField:
    """Paperless custom field definition"""
    id: int
    name: str
    data_type: str  # string, url, date, boolean, integer, float, monetary, document_link


class PaperlessService:
    """
    Service for interacting with Paperless-ngx API.
    
    Supports:
    - Document upload with metadata
    - Document search and retrieval
    - Custom fields for ERP entity linking
    - Correspondents (customers/suppliers)
    - Document types and tags
    """
    
    def __init__(self):
        self._base_url = settings.PAPERLESS_URL.rstrip('/')
        self._token: Optional[str] = None
        self._client: Optional[httpx.Client] = None
    
    def _get_client(self) -> httpx.Client:
        """Get or create HTTP client with authentication"""
        if self._client is None:
            self._client = httpx.Client(
                base_url=self._base_url,
                timeout=API_TIMEOUT,
                headers=self._get_auth_headers()
            )
        return self._client
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        headers = {
            "Accept": "application/json",
        }
        
        # Prefer token authentication
        if settings.PAPERLESS_TOKEN:
            headers["Authorization"] = f"Token {settings.PAPERLESS_TOKEN}"
        elif self._token:
            headers["Authorization"] = f"Token {self._token}"
        
        return headers
    
    def authenticate(self) -> bool:
        """
        Authenticate with username/password to get API token.
        Only needed if PAPERLESS_TOKEN is not set.
        
        Returns True if authentication successful.
        """
        if settings.PAPERLESS_TOKEN:
            logger.info("Using pre-configured Paperless API token")
            return True
        
        if not settings.PAPERLESS_USERNAME or not settings.PAPERLESS_PASSWORD:
            logger.error("Paperless credentials not configured")
            return False
        
        try:
            response = httpx.post(
                f"{self._base_url}/api/token/",
                data={
                    "username": settings.PAPERLESS_USERNAME,
                    "password": settings.PAPERLESS_PASSWORD,
                },
                timeout=API_TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                self._token = data.get("token")
                logger.info("Paperless authentication successful")
                return True
            else:
                logger.error(f"Paperless authentication failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Paperless authentication error: {e}")
            return False
    
    def _api_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        files: Optional[Dict] = None,
        data: Optional[Dict] = None
    ) -> Optional[Dict[str, Any]]:
        """Make API request to Paperless"""
        try:
            client = self._get_client()
            
            if method.upper() == "GET":
                response = client.get(endpoint, params=params)
            elif method.upper() == "POST":
                if files:
                    # Multipart form data for file upload
                    response = client.post(endpoint, data=data, files=files)
                else:
                    response = client.post(endpoint, json=json_data)
            elif method.upper() == "PATCH":
                response = client.patch(endpoint, json=json_data)
            elif method.upper() == "DELETE":
                response = client.delete(endpoint)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            if response.status_code in (200, 201):
                return response.json()
            elif response.status_code == 204:
                return {}
            else:
                logger.error(f"Paperless API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Paperless API request error: {e}")
            return None
    
    # =========================================================================
    # Document Operations
    # =========================================================================
    
    def upload_document(
        self,
        file_path: str,
        title: Optional[str] = None,
        correspondent_id: Optional[int] = None,
        document_type_id: Optional[int] = None,
        tag_ids: Optional[List[int]] = None,
        created: Optional[datetime] = None,
        custom_fields: Optional[Dict[str, Any]] = None,
        archive_serial_number: Optional[int] = None,
    ) -> Optional[int]:
        """
        Upload a document to Paperless-ngx.
        
        Args:
            file_path: Path to the file to upload
            title: Document title (optional, Paperless extracts from content)
            correspondent_id: ID of correspondent (customer/supplier)
            document_type_id: ID of document type
            tag_ids: List of tag IDs
            created: Document creation date
            custom_fields: Dict of custom field values
            archive_serial_number: Archive serial number (ASN)
            
        Returns:
            Document ID if successful, None otherwise
        """
        path = Path(file_path)
        if not path.exists():
            logger.error(f"File not found: {file_path}")
            return None
        
        # Prepare form data
        data = {}
        if title:
            data["title"] = title
        if correspondent_id:
            data["correspondent"] = str(correspondent_id)
        if document_type_id:
            data["document_type"] = str(document_type_id)
        if tag_ids:
            data["tags"] = ",".join(str(t) for t in tag_ids)
        if created:
            data["created"] = created.strftime("%Y-%m-%d")
        if archive_serial_number:
            data["archive_serial_number"] = str(archive_serial_number)
        
        # Custom fields are sent as JSON object mapping field IDs to values
        # Format: {"field_id": value, ...} e.g. {"5": 40004, "6": "AU-2026-00032"}
        if custom_fields:
            import json
            # Ensure keys are strings for JSON serialization
            data["custom_fields"] = json.dumps(
                {str(k): v for k, v in custom_fields.items()}
            )
        
        # Open file for upload
        with open(path, "rb") as f:
            files = {"document": (path.name, f, "application/octet-stream")}
            result = self._api_request("POST", "/api/documents/post_document/", data=data, files=files)
        
        if result:
            # Upload successful - document will be processed asynchronously
            # Paperless may return either a dict with task_id or directly a string (UUID)
            if isinstance(result, str):
                # Direct string response (UUID) - this is the task_id
                logger.info(f"Document uploaded, task_id: {result}")
                return result
            elif isinstance(result, dict) and "task_id" in result:
                logger.info(f"Document uploaded, task_id: {result['task_id']}")
                return result.get("task_id")
        
        return None
    
    def get_document(self, document_id: int) -> Optional[PaperlessDocument]:
        """Get a document by ID"""
        result = self._api_request("GET", f"/api/documents/{document_id}/")
        if result:
            return self._dict_to_document(result)
        return None
    
    def search_documents(
        self,
        query: Optional[str] = None,
        correspondent_id: Optional[int] = None,
        document_type_id: Optional[int] = None,
        tag_ids: Optional[List[int]] = None,
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
        ordering: str = "-created",
        page: int = 1,
        page_size: int = 25,
    ) -> List[PaperlessDocument]:
        """
        Search documents with filters.
        
        Args:
            query: Full-text search query
            correspondent_id: Filter by correspondent
            document_type_id: Filter by document type
            tag_ids: Filter by tags (all must match)
            created_after: Filter by created date (ISO format, e.g. 2024-01-01)
            created_before: Filter by created date (ISO format, e.g. 2024-12-31)
            ordering: Sort order (prefix with - for descending)
            page: Page number
            page_size: Results per page
        """
        params = {
            "ordering": ordering,
            "page": page,
            "page_size": page_size,
        }
        
        if query:
            params["search"] = query  # Paperless-ngx uses 'search' for fulltext search, not 'query'
        if correspondent_id:
            params["correspondent__id"] = correspondent_id
        if document_type_id:
            params["document_type__id"] = document_type_id
        if tag_ids:
            params["tags__id__all"] = ",".join(str(t) for t in tag_ids)
        if created_after:
            params["created__date__gte"] = created_after
        if created_before:
            params["created__date__lte"] = created_before
        
        result = self._api_request("GET", "/api/documents/", params=params)
        if result and "results" in result:
            return [self._dict_to_document(d) for d in result["results"]]
        return []
    
    def update_document(
        self,
        document_id: int,
        title: Optional[str] = None,
        correspondent_id: Optional[int] = None,
        document_type_id: Optional[int] = None,
        tag_ids: Optional[List[int]] = None,
        custom_fields: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update document metadata"""
        data = {}
        if title is not None:
            data["title"] = title
        if correspondent_id is not None:
            data["correspondent"] = correspondent_id
        if document_type_id is not None:
            data["document_type"] = document_type_id
        if tag_ids is not None:
            data["tags"] = tag_ids
        if custom_fields is not None:
            data["custom_fields"] = [
                {"field": k, "value": v} for k, v in custom_fields.items()
            ]
        
        result = self._api_request("PATCH", f"/api/documents/{document_id}/", json_data=data)
        return result is not None
    
    def get_document_download_url(self, document_id: int, original: bool = False) -> str:
        """Get download URL for a document"""
        if original:
            return f"{self._base_url}/api/documents/{document_id}/download/"
        return f"{self._base_url}/api/documents/{document_id}/preview/"
    
    def get_document_thumbnail_url(self, document_id: int) -> str:
        """Get thumbnail URL for a document"""
        return f"{self._base_url}/api/documents/{document_id}/thumb/"
    
    def _dict_to_document(self, data: Dict[str, Any]) -> PaperlessDocument:
        """Convert API response dict to PaperlessDocument"""
        return PaperlessDocument(
            id=data.get("id"),
            title=data.get("title"),
            content=data.get("content"),
            created=self._parse_datetime(data.get("created")),
            modified=self._parse_datetime(data.get("modified")),
            added=self._parse_datetime(data.get("added")),
            archive_serial_number=data.get("archive_serial_number"),
            original_file_name=data.get("original_file_name"),
            archived_file_name=data.get("archived_file_name"),
            correspondent=data.get("correspondent"),
            correspondent_name=data.get("correspondent__name"),
            document_type=data.get("document_type"),
            document_type_name=data.get("document_type__name"),
            tags=data.get("tags", []),
            tag_names=data.get("tags__name", []) if isinstance(data.get("tags__name"), list) else [],
            custom_fields=self._parse_custom_fields(data.get("custom_fields", [])),
            download_url=self.get_document_download_url(data["id"]) if data.get("id") else None,
            original_download_url=self.get_document_download_url(data["id"], original=True) if data.get("id") else None,
            thumbnail_url=self.get_document_thumbnail_url(data["id"]) if data.get("id") else None,
        )
    
    # =========================================================================
    # Correspondents (Customers/Suppliers)
    # =========================================================================
    
    def get_correspondents(self) -> List[PaperlessCorrespondent]:
        """Get all correspondents"""
        result = self._api_request("GET", "/api/correspondents/")
        if result and "results" in result:
            return [
                PaperlessCorrespondent(
                    id=c["id"],
                    name=c["name"],
                    match=c.get("match"),
                    matching_algorithm=c.get("matching_algorithm", 0),
                    is_insensitive=c.get("is_insensitive", False),
                    document_count=c.get("document_count", 0),
                )
                for c in result["results"]
            ]
        return []
    
    def create_correspondent(self, name: str, match: Optional[str] = None) -> Optional[int]:
        """Create a new correspondent"""
        data = {"name": name}
        if match:
            data["match"] = match
        
        result = self._api_request("POST", "/api/correspondents/", json_data=data)
        if result:
            return result.get("id")
        return None
    
    def find_or_create_correspondent(self, name: str) -> Optional[int]:
        """Find correspondent by name or create if not exists"""
        # Trim whitespace for comparison
        name_trimmed = name.strip()
        correspondents = self.get_correspondents()
        for c in correspondents:
            if c.name.strip().lower() == name_trimmed.lower():
                return c.id
        # Create with trimmed name to avoid trailing whitespace issues
        return self.create_correspondent(name_trimmed)
    
    # =========================================================================
    # Document Types
    # =========================================================================
    
    def get_document_types(self) -> List[PaperlessDocumentType]:
        """Get all document types"""
        result = self._api_request("GET", "/api/document_types/")
        if result and "results" in result:
            return [
                PaperlessDocumentType(
                    id=t["id"],
                    name=t["name"],
                    match=t.get("match"),
                    matching_algorithm=t.get("matching_algorithm", 0),
                    is_insensitive=t.get("is_insensitive", False),
                    document_count=t.get("document_count", 0),
                )
                for t in result["results"]
            ]
        return []
    
    def create_document_type(self, name: str, match: Optional[str] = None) -> Optional[int]:
        """Create a new document type"""
        data = {"name": name}
        if match:
            data["match"] = match
        
        result = self._api_request("POST", "/api/document_types/", json_data=data)
        if result:
            return result.get("id")
        return None
    
    # =========================================================================
    # Tags
    # =========================================================================
    
    def get_tags(self) -> List[PaperlessTag]:
        """Get all tags"""
        result = self._api_request("GET", "/api/tags/")
        if result and "results" in result:
            return [
                PaperlessTag(
                    id=t["id"],
                    name=t["name"],
                    color=t.get("color"),
                    match=t.get("match"),
                    matching_algorithm=t.get("matching_algorithm", 0),
                    is_insensitive=t.get("is_insensitive", False),
                    document_count=t.get("document_count", 0),
                )
                for t in result["results"]
            ]
        return []
    
    def create_tag(self, name: str, color: Optional[str] = None) -> Optional[int]:
        """Create a new tag"""
        data = {"name": name}
        if color:
            data["color"] = color
        
        result = self._api_request("POST", "/api/tags/", json_data=data)
        if result:
            return result.get("id")
        return None
    
    def find_or_create_tag(self, name: str, color: Optional[str] = None) -> Optional[int]:
        """Find tag by name or create if not exists"""
        tags = self.get_tags()
        for t in tags:
            if t.name.lower() == name.lower():
                return t.id
        return self.create_tag(name, color)
    
    # =========================================================================
    # Custom Fields
    # =========================================================================
    
    def get_custom_fields(self) -> List[PaperlessCustomField]:
        """Get all custom field definitions"""
        result = self._api_request("GET", "/api/custom_fields/")
        if result and "results" in result:
            return [
                PaperlessCustomField(
                    id=f["id"],
                    name=f["name"],
                    data_type=f["data_type"],
                )
                for f in result["results"]
            ]
        return []
    
    def create_custom_field(self, name: str, data_type: str = "string") -> Optional[int]:
        """
        Create a new custom field.
        
        data_type: string, url, date, boolean, integer, float, monetary, document_link
        """
        data = {
            "name": name,
            "data_type": data_type,
        }
        
        result = self._api_request("POST", "/api/custom_fields/", json_data=data)
        if result:
            return result.get("id")
        return None
    
    def ensure_erp_custom_fields(self) -> Dict[str, int]:
        """
        Ensure ERP-related custom fields exist in Paperless.
        Returns dict mapping field name to field ID.
        
        Creates these fields if they don't exist:
        - erp_order_id: Order ID (integer)
        - erp_order_number: Order number (string)
        - erp_customer_number: Customer number / Kundennummer (string)
        - erp_article_id: Article ID (integer)
        - erp_article_number: Article number (string)
        - erp_order_article_id: Order article ID (integer)
        - erp_bom_item_id: BOM item ID (integer)
        - erp_operation_id: Operation/workstep ID (integer)
        """
        required_fields = {
            "erp_order_id": "integer",
            "erp_order_number": "string",
            "erp_customer_number": "string",
            "erp_article_id": "integer",
            "erp_article_number": "string",
            "erp_order_article_id": "integer",
            "erp_bom_item_id": "integer",
            "erp_operation_id": "integer",
        }
        
        existing = {f.name: f.id for f in self.get_custom_fields()}
        result = {}
        
        for name, data_type in required_fields.items():
            if name in existing:
                result[name] = existing[name]
            else:
                field_id = self.create_custom_field(name, data_type)
                if field_id:
                    result[name] = field_id
                    logger.info(f"Created Paperless custom field: {name}")
        
        return result
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    @staticmethod
    def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
        """Parse datetime string from API"""
        if not value:
            return None
        try:
            # Paperless uses ISO format
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    
    @staticmethod
    def _parse_custom_fields(fields: List[Dict]) -> Dict[str, Any]:
        """Parse custom fields list to dict"""
        result = {}
        for f in fields:
            if "field" in f and "value" in f:
                # field can be ID or name depending on context
                key = f.get("field__name", f.get("field"))
                result[key] = f["value"]
        return result
    
    def test_connection(self) -> bool:
        """Test connection to Paperless-ngx"""
        try:
            if not settings.PAPERLESS_TOKEN:
                if not self.authenticate():
                    return False
            
            # Try to get document types as a simple test
            result = self._api_request("GET", "/api/document_types/")
            return result is not None
            
        except Exception as e:
            logger.error(f"Paperless connection test failed: {e}")
            return False


# Service instance getter
_paperless_service: Optional[PaperlessService] = None


def get_paperless_service() -> PaperlessService:
    """Get Paperless service instance"""
    global _paperless_service
    if _paperless_service is None:
        _paperless_service = PaperlessService()
    return _paperless_service
