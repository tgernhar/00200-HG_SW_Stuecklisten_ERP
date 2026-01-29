"""
DMS Service - HUGWAWI Document Management System Integration

Provides read-only access to HUGWAWI DMS documents and their relationships
to orders, articles, BOM items, and operations.

Respects HUGWAWI workflow access rights based on user's support group.
"""
import logging
from typing import List, Optional, Dict, Any, Set
from datetime import datetime
from dataclasses import dataclass, field
from app.core.database import get_erp_db_connection

logger = logging.getLogger(__name__)


@dataclass
class DMSAccessRight:
    """Access right for a workflow/lifecycle combination"""
    workflow_id: int
    supportgroup_id: int
    lifecycle: int
    can_read: bool
    can_write: bool


@dataclass  
class DMSUserPermissions:
    """User permissions based on their support groups"""
    user_id: int
    supportgroup_ids: Set[int] = field(default_factory=set)
    # Cache of readable workflow/lifecycle combinations
    readable_combinations: Set[tuple] = field(default_factory=set)  # (workflow_id, lifecycle)


@dataclass
class DMSDocument:
    """DMS Document data class"""
    id: int
    description: Optional[str]
    filename: Optional[str]
    path: Optional[str]
    uploader_id: Optional[int]
    uploader_name: Optional[str]
    upload_time: Optional[datetime]
    tag: Optional[str]
    type_id: Optional[int]
    type_name: Optional[str]
    folder_id: Optional[int]
    folder_name: Optional[str]
    customer_id: Optional[int]
    lifecycle: Optional[int]
    version: Optional[int]
    file_exists: bool
    is_public: bool
    workflow_id: Optional[int]
    workflow_name: Optional[str]
    # Custom fields
    custom_text1: Optional[str] = None
    custom_text2: Optional[str] = None
    custom_text3: Optional[str] = None
    custom_text4: Optional[str] = None
    custom_text5: Optional[str] = None


@dataclass
class DMSDocumentType:
    """DMS Document Type data class"""
    id: int
    name: str
    path_extension: Optional[str]
    folder: Optional[str]
    hash_tag: Optional[str]
    for_order_attachments: bool


@dataclass
class DMSFolder:
    """DMS Folder data class"""
    id: int
    name: str
    parent_folder_id: Optional[int]
    search_name: Optional[str]


class DMSService:
    """
    Service for accessing HUGWAWI DMS (Document Management System).
    All operations are READ-ONLY.
    Respects HUGWAWI workflow access rights.
    """
    
    def __init__(self, user_id: Optional[int] = None):
        """
        Initialize DMS Service.
        
        Args:
            user_id: The HUGWAWI userlogin.id for permission checks.
                     If None, permission checks are skipped (admin mode).
        """
        self._user_id = user_id
        self._permissions_cache: Optional[DMSUserPermissions] = None
    
    def _get_connection(self):
        """Get ERP database connection"""
        return get_erp_db_connection()
    
    # =========================================================================
    # Permission Methods
    # =========================================================================
    
    def get_user_supportgroups(self, user_id: int) -> Set[int]:
        """
        Get all support groups a user belongs to.
        Users can belong to multiple support groups.
        """
        query = """
            SELECT supportgroup_id 
            FROM userlogin_supportgroup 
            WHERE userlogin_id = %s
        """
        try:
            results = self._execute_query(query, (user_id,))
            return {row['supportgroup_id'] for row in results}
        except Exception as e:
            # Table might not exist or user has no groups
            logger.warning(f"Could not get support groups for user {user_id}: {e}")
            return set()
    
    def get_readable_workflow_combinations(self, supportgroup_ids: Set[int]) -> Set[tuple]:
        """
        Get all (workflow_id, lifecycle) combinations that a user can read
        based on their support groups.
        
        Returns set of tuples: (workflow_id, lifecycle)
        """
        if not supportgroup_ids:
            return set()
        
        placeholders = ','.join(['%s'] * len(supportgroup_ids))
        query = f"""
            SELECT DISTINCT workflow, lifecycle
            FROM dms_workflow_accessrights
            WHERE supportgroup IN ({placeholders})
              AND isread = 1
        """
        try:
            results = self._execute_query(query, tuple(supportgroup_ids))
            return {(row['workflow'], row['lifecycle']) for row in results}
        except Exception as e:
            logger.warning(f"Could not get workflow access rights: {e}")
            return set()
    
    def _get_user_permissions(self) -> Optional[DMSUserPermissions]:
        """
        Get or build cached permissions for the current user.
        Returns None if no user_id is set (admin mode).
        """
        if self._user_id is None:
            return None
        
        if self._permissions_cache is None:
            supportgroups = self.get_user_supportgroups(self._user_id)
            readable = self.get_readable_workflow_combinations(supportgroups)
            
            self._permissions_cache = DMSUserPermissions(
                user_id=self._user_id,
                supportgroup_ids=supportgroups,
                readable_combinations=readable
            )
        
        return self._permissions_cache
    
    def can_read_document(self, document: DMSDocument) -> bool:
        """
        Check if the current user can read a document based on workflow permissions.
        
        Rules:
        1. If no user_id is set (admin mode), always return True
        2. If document is public (is_public=True), always return True
        3. If document has no workflow, allow read (no restrictions)
        4. Otherwise, check workflow_accessrights table
        """
        # Admin mode - no restrictions
        if self._user_id is None:
            return True
        
        # Public documents are always readable
        if document.is_public:
            return True
        
        # Documents without workflow have no restrictions
        if document.workflow_id is None:
            return True
        
        # Check workflow permissions
        perms = self._get_user_permissions()
        if perms is None:
            return True
        
        # Check if (workflow, lifecycle) combination is readable
        doc_lifecycle = document.lifecycle or 0
        return (document.workflow_id, doc_lifecycle) in perms.readable_combinations
    
    def filter_readable_documents(self, documents: List[DMSDocument]) -> List[DMSDocument]:
        """Filter a list of documents to only those the user can read."""
        return [doc for doc in documents if self.can_read_document(doc)]
    
    def _permission_filter_clause(self) -> str:
        """
        Generate SQL WHERE clause for permission filtering.
        Returns empty string if no user is set (admin mode).
        """
        if self._user_id is None:
            return ""
        
        perms = self._get_user_permissions()
        if perms is None:
            return ""
        
        # Build OR conditions for each readable combination
        if not perms.readable_combinations:
            # User has no read permissions - only show public docs or docs without workflow
            return " AND (d.public = 1 OR d.workflow IS NULL)"
        
        conditions = []
        conditions.append("d.public = 1")  # Always allow public
        conditions.append("d.workflow IS NULL")  # Allow docs without workflow
        
        for workflow_id, lifecycle in perms.readable_combinations:
            conditions.append(f"(d.workflow = {workflow_id} AND IFNULL(d.lifecycle, 0) = {lifecycle})")
        
        return f" AND ({' OR '.join(conditions)})"
    
    def _row_to_document(self, row: Dict[str, Any]) -> DMSDocument:
        """Convert database row to DMSDocument"""
        return DMSDocument(
            id=row.get('id'),
            description=row.get('description'),
            filename=row.get('filename'),
            path=row.get('path'),
            uploader_id=row.get('uploader'),
            uploader_name=row.get('uploader_name'),
            upload_time=row.get('uploadtime'),
            tag=row.get('tag'),
            type_id=row.get('type'),
            type_name=row.get('type_name'),
            folder_id=row.get('folder'),
            folder_name=row.get('folder_name'),
            customer_id=row.get('kid'),
            lifecycle=row.get('lifecycle'),
            version=row.get('version') or 0,
            file_exists=bool(row.get('fileexists')),
            is_public=bool(row.get('public')),
            workflow_id=row.get('workflow'),
            workflow_name=row.get('workflow_name'),
            custom_text1=row.get('customtext1'),
            custom_text2=row.get('customtext2'),
            custom_text3=row.get('customtext3'),
            custom_text4=row.get('customtext4'),
            custom_text5=row.get('customtext5'),
        )
    
    def _execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Execute a query and return results as list of dicts"""
        conn = None
        cursor = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, params or ())
            results = cursor.fetchall()
            return results
        except Exception as e:
            logger.error(f"DMS query error: {e}")
            raise
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
    
    def _base_document_query(self) -> str:
        """Base SELECT query for documents with JOINs"""
        return """
            SELECT 
                d.id,
                d.description,
                d.filename,
                d.path,
                d.uploader,
                u.name as uploader_name,
                d.uploadtime,
                d.tag,
                d.type,
                dt.name as type_name,
                d.folder,
                f.name as folder_name,
                d.kid,
                d.lifecycle,
                d.version,
                d.fileexists,
                d.public,
                d.workflow,
                w.name as workflow_name,
                d.customtext1,
                d.customtext2,
                d.customtext3,
                d.customtext4,
                d.customtext5
            FROM dms_document d
            LEFT JOIN dms_documenttype dt ON d.type = dt.id
            LEFT JOIN dms_folder f ON d.folder = f.id
            LEFT JOIN dms_workflow w ON d.workflow = w.id
            LEFT JOIN userlogin u ON d.uploader = u.id
        """
    
    # =========================================================================
    # Document Retrieval Methods (with permission filtering)
    # =========================================================================
    
    def get_document_by_id(self, document_id: int) -> Optional[DMSDocument]:
        """
        Get a single document by ID.
        Returns None if document doesn't exist or user has no read permission.
        """
        perm_filter = self._permission_filter_clause()
        query = self._base_document_query() + f" WHERE d.id = %s{perm_filter}"
        results = self._execute_query(query, (document_id,))
        if results:
            doc = self._row_to_document(results[0])
            # Double-check permission (belt and suspenders)
            if self.can_read_document(doc):
                return doc
        return None
    
    def get_documents_for_order(self, order_id: int) -> List[DMSDocument]:
        """
        Get all documents linked to an order (ordertable.id).
        Uses dms_order link table. Respects workflow permissions.
        """
        perm_filter = self._permission_filter_clause()
        query = self._base_document_query() + f"""
            INNER JOIN dms_order do ON d.id = do.dmsId
            WHERE do.orderid = %s{perm_filter}
            ORDER BY d.uploadtime DESC
        """
        results = self._execute_query(query, (order_id,))
        return [self._row_to_document(row) for row in results]
    
    def get_documents_for_article(self, article_id: int) -> List[DMSDocument]:
        """
        Get all documents linked to an article (article.id).
        Uses dms_article link table. Respects workflow permissions.
        """
        perm_filter = self._permission_filter_clause()
        query = self._base_document_query() + f"""
            INNER JOIN dms_article da ON d.id = da.dmsId
            WHERE da.articleId = %s{perm_filter}
            ORDER BY d.uploadtime DESC
        """
        results = self._execute_query(query, (article_id,))
        return [self._row_to_document(row) for row in results]
    
    def get_documents_for_order_article(self, order_article_id: int) -> List[DMSDocument]:
        """
        Get all documents linked to an order article (order_article.id).
        Uses dms_order_article link table (NEW). Respects workflow permissions.
        """
        perm_filter = self._permission_filter_clause()
        query = self._base_document_query() + f"""
            INNER JOIN dms_order_article doa ON d.id = doa.dmsId
            WHERE doa.order_article_id = %s{perm_filter}
            ORDER BY d.uploadtime DESC
        """
        results = self._execute_query(query, (order_article_id,))
        return [self._row_to_document(row) for row in results]
    
    def get_documents_for_bom_item(self, packingnote_details_id: int) -> List[DMSDocument]:
        """
        Get all documents linked to a BOM item (packingnote_details.id).
        Uses dms_packingnote_details link table (NEW). Respects workflow permissions.
        """
        perm_filter = self._permission_filter_clause()
        query = self._base_document_query() + f"""
            INNER JOIN dms_packingnote_details dpd ON d.id = dpd.dmsId
            WHERE dpd.packingnote_details_id = %s{perm_filter}
            ORDER BY d.uploadtime DESC
        """
        results = self._execute_query(query, (packingnote_details_id,))
        return [self._row_to_document(row) for row in results]
    
    def get_documents_for_operation(self, workplan_details_id: int) -> List[DMSDocument]:
        """
        Get all documents linked to an operation (workplan_details.id).
        Uses dms_workplan_details link table (NEW). Respects workflow permissions.
        """
        perm_filter = self._permission_filter_clause()
        query = self._base_document_query() + f"""
            INNER JOIN dms_workplan_details dwd ON d.id = dwd.dmsId
            WHERE dwd.workplan_details_id = %s{perm_filter}
            ORDER BY d.uploadtime DESC
        """
        results = self._execute_query(query, (workplan_details_id,))
        return [self._row_to_document(row) for row in results]
    
    def get_documents_for_customer(self, customer_id: int) -> List[DMSDocument]:
        """
        Get all documents linked to a customer via kid field.
        Respects workflow permissions.
        """
        perm_filter = self._permission_filter_clause()
        query = self._base_document_query() + f"""
            WHERE d.kid = %s{perm_filter}
            ORDER BY d.uploadtime DESC
        """
        results = self._execute_query(query, (customer_id,))
        return [self._row_to_document(row) for row in results]
    
    # =========================================================================
    # Search Methods
    # =========================================================================
    
    def search_documents(
        self,
        search_term: Optional[str] = None,
        document_type_id: Optional[int] = None,
        folder_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[DMSDocument]:
        """
        Search documents with various filters.
        Respects workflow permissions.
        """
        query = self._base_document_query()
        conditions = []
        params = []
        
        # Add permission filter
        perm_filter = self._permission_filter_clause()
        if perm_filter:
            # Remove leading " AND " since we handle WHERE clause separately
            perm_condition = perm_filter.replace(" AND ", "", 1)
            conditions.append(perm_condition)
        
        if search_term:
            conditions.append("""
                (d.description LIKE %s 
                 OR d.filename LIKE %s 
                 OR d.tag LIKE %s
                 OR d.customtext1 LIKE %s
                 OR d.customtext5 LIKE %s)
            """)
            pattern = f"%{search_term}%"
            params.extend([pattern, pattern, pattern, pattern, pattern])
        
        if document_type_id:
            conditions.append("d.type = %s")
            params.append(document_type_id)
        
        if folder_id:
            conditions.append("d.folder = %s")
            params.append(folder_id)
        
        if customer_id:
            conditions.append("d.kid = %s")
            params.append(customer_id)
        
        if date_from:
            conditions.append("d.uploadtime >= %s")
            params.append(date_from)
        
        if date_to:
            conditions.append("d.uploadtime <= %s")
            params.append(date_to)
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY d.uploadtime DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        results = self._execute_query(query, tuple(params))
        return [self._row_to_document(row) for row in results]
    
    def count_documents(
        self,
        search_term: Optional[str] = None,
        document_type_id: Optional[int] = None,
        folder_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> int:
        """
        Count documents matching filters.
        Respects workflow permissions.
        """
        query = "SELECT COUNT(*) as cnt FROM dms_document d"
        conditions = []
        params = []
        
        # Add permission filter
        perm_filter = self._permission_filter_clause()
        if perm_filter:
            perm_condition = perm_filter.replace(" AND ", "", 1)
            conditions.append(perm_condition)
        
        if search_term:
            conditions.append("""
                (d.description LIKE %s 
                 OR d.filename LIKE %s 
                 OR d.tag LIKE %s)
            """)
            pattern = f"%{search_term}%"
            params.extend([pattern, pattern, pattern])
        
        if document_type_id:
            conditions.append("d.type = %s")
            params.append(document_type_id)
        
        if folder_id:
            conditions.append("d.folder = %s")
            params.append(folder_id)
        
        if customer_id:
            conditions.append("d.kid = %s")
            params.append(customer_id)
        
        if date_from:
            conditions.append("d.uploadtime >= %s")
            params.append(date_from)
        
        if date_to:
            conditions.append("d.uploadtime <= %s")
            params.append(date_to)
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        results = self._execute_query(query, tuple(params))
        return results[0]['cnt'] if results else 0
    
    # =========================================================================
    # Document Type & Folder Methods
    # =========================================================================
    
    def get_document_types(self) -> List[DMSDocumentType]:
        """Get all document types"""
        query = """
            SELECT id, name, pathextension, folder, hashTag, forOrderAttachments
            FROM dms_documenttype
            ORDER BY name
        """
        results = self._execute_query(query)
        return [
            DMSDocumentType(
                id=row['id'],
                name=row['name'],
                path_extension=row.get('pathextension'),
                folder=row.get('folder'),
                hash_tag=row.get('hashTag'),
                for_order_attachments=bool(row.get('forOrderAttachments', 1))
            )
            for row in results
        ]
    
    def get_folders(self, parent_id: Optional[int] = None) -> List[DMSFolder]:
        """Get folders, optionally filtered by parent"""
        if parent_id is not None:
            query = """
                SELECT id, name, parentfolder, searchname
                FROM dms_folder
                WHERE parentfolder = %s
                ORDER BY name
            """
            results = self._execute_query(query, (parent_id,))
        else:
            query = """
                SELECT id, name, parentfolder, searchname
                FROM dms_folder
                ORDER BY name
            """
            results = self._execute_query(query)
        
        return [
            DMSFolder(
                id=row['id'],
                name=row['name'],
                parent_folder_id=row.get('parentfolder'),
                search_name=row.get('searchname')
            )
            for row in results
        ]
    
    def get_folder_tree(self) -> List[Dict[str, Any]]:
        """Get folder tree structure"""
        folders = self.get_folders()
        
        # Build tree
        folder_map = {f.id: {'id': f.id, 'name': f.name, 'children': []} for f in folders}
        root_folders = []
        
        for folder in folders:
            if folder.parent_folder_id and folder.parent_folder_id in folder_map:
                folder_map[folder.parent_folder_id]['children'].append(folder_map[folder.id])
            else:
                root_folders.append(folder_map[folder.id])
        
        return root_folders
    
    # =========================================================================
    # Document History & Notes
    # =========================================================================
    
    def get_document_history(self, document_id: int) -> List[Dict[str, Any]]:
        """Get version history for a document"""
        query = """
            SELECT 
                h.id,
                h.document,
                h.versiondate,
                h.uploader,
                u.name as uploader_name,
                h.version,
                h.path
            FROM dms_document_history h
            LEFT JOIN userlogin u ON h.uploader = u.id
            WHERE h.document = %s
            ORDER BY h.version DESC
        """
        results = self._execute_query(query, (document_id,))
        return [
            {
                'id': row['id'],
                'document_id': row['document'],
                'version_date': row['versiondate'],
                'uploader_id': row['uploader'],
                'uploader_name': row.get('uploader_name'),
                'version': row['version'],
                'path': row['path']
            }
            for row in results
        ]
    
    def get_document_notes(self, document_id: int) -> List[Dict[str, Any]]:
        """Get notes for a document"""
        query = """
            SELECT 
                n.id,
                n.document,
                n.text,
                n.type,
                n.user,
                u.name as user_name,
                n.created
            FROM dms_document_note n
            LEFT JOIN userlogin u ON n.user = u.id
            WHERE n.document = %s
            ORDER BY n.created DESC
        """
        results = self._execute_query(query, (document_id,))
        return [
            {
                'id': row['id'],
                'document_id': row['document'],
                'text': row['text'],
                'type': row['type'],
                'user_id': row['user'],
                'user_name': row.get('user_name'),
                'created': row['created']
            }
            for row in results
        ]
    
    # =========================================================================
    # File Path Generation
    # =========================================================================
    
    def get_document_file_path(self, document_id: int) -> Optional[str]:
        """
        Get the full file path for a document.
        Combines dms_config.dmsdocuments with document path/filename.
        """
        # Get document
        doc = self.get_document_by_id(document_id)
        if not doc:
            return None
        
        # Get config for base path
        query = "SELECT dmsdocuments FROM dms_config LIMIT 1"
        results = self._execute_query(query)
        
        base_path = ""
        if results and results[0].get('dmsdocuments'):
            base_path = results[0]['dmsdocuments']
        
        # Construct full path
        if doc.path and doc.filename:
            return f"{base_path}/{doc.path}/{doc.filename}".replace("//", "/")
        elif doc.filename:
            return f"{base_path}/{doc.filename}".replace("//", "/")
        
        return None
    
    def get_download_url(self, document_id: int, base_url: str = "/api/dms") -> str:
        """Generate download URL for a document"""
        return f"{base_url}/documents/{document_id}/download"


def get_dms_service(user_id: Optional[int] = None) -> DMSService:
    """
    Get DMS service instance with optional user permission context.
    
    Args:
        user_id: The HUGWAWI userlogin.id for permission checks.
                 If None, no permission filtering is applied (admin mode).
    
    Note: This creates a new instance per call when user_id is provided
    to ensure proper permission context. For read-only operations without
    permission checks, you can pass None.
    """
    return DMSService(user_id=user_id)
