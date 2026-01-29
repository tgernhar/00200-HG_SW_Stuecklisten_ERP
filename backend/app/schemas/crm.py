"""
CRM Pydantic Schemas for API validation and serialization

Includes schemas for:
- Communication entries (email, calls, meetings, notes)
- Attachments
- Document links
- Tags
- Leads/Chances
- Tasks/Reminders
- Email templates
- Mailbox configuration
- Timeline views
- Search
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime, date, time
from decimal import Decimal
from enum import Enum


# ============== Enums ==============

class CommunicationType(str, Enum):
    EMAIL_IN = "email_in"
    EMAIL_OUT = "email_out"
    PHONE = "phone"
    MEETING = "meeting"
    NOTE = "note"
    DOCUMENT = "document"


class LeadStatus(str, Enum):
    NEW = "new"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"


class TaskType(str, Enum):
    FOLLOW_UP = "follow_up"
    CALL = "call"
    MEETING = "meeting"
    INTERNAL = "internal"
    REMINDER = "reminder"


class TaskStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TagType(str, Enum):
    INDUSTRY = "industry"
    RATING = "rating"
    REGION = "region"
    OTHER = "other"


class DocumentLinkType(str, Enum):
    INQUIRY = "inquiry"
    OFFER = "offer"
    ORDER = "order"
    PURCHASE_ORDER = "purchase_order"
    DELIVERY_NOTE = "delivery_note"
    INVOICE = "invoice"
    # Extended link types for DMS integration
    ORDER_ARTICLE = "order_article"
    BOM_ITEM = "bom_item"
    OPERATION = "operation"
    LOCAL_ARTICLE = "local_article"
    PPS_TODO = "pps_todo"


# ============== Base Schemas ==============

class CRMBaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ============== Mailbox Schemas ==============

class MailboxBase(CRMBaseSchema):
    name: str
    email_address: str
    imap_host: Optional[str] = None
    imap_port: Optional[int] = 993
    imap_use_tls: bool = True
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_use_tls: bool = True
    sync_folders: Optional[List[str]] = None
    is_active: bool = True


class MailboxCreate(MailboxBase):
    imap_username: Optional[str] = None
    imap_password: Optional[str] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None


class MailboxUpdate(CRMBaseSchema):
    name: Optional[str] = None
    email_address: Optional[str] = None
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_use_tls: Optional[bool] = None
    imap_username: Optional[str] = None
    imap_password: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_use_tls: Optional[bool] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    sync_folders: Optional[List[str]] = None
    is_active: Optional[bool] = None


class Mailbox(MailboxBase):
    id: int
    last_sync_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MailboxListResponse(CRMBaseSchema):
    items: List[Mailbox]
    total: int


# ============== Tag Schemas ==============

class TagBase(CRMBaseSchema):
    name: str
    color: Optional[str] = None
    tag_type: TagType = TagType.OTHER


class TagCreate(TagBase):
    pass


class TagUpdate(CRMBaseSchema):
    name: Optional[str] = None
    color: Optional[str] = None
    tag_type: Optional[TagType] = None


class Tag(TagBase):
    id: int
    created_at: Optional[datetime] = None


class TagListResponse(CRMBaseSchema):
    items: List[Tag]
    total: int


# ============== Attachment Schemas ==============

class AttachmentBase(CRMBaseSchema):
    filename: str
    original_filename: Optional[str] = None
    content_type: Optional[str] = None
    file_size: Optional[int] = None
    is_inline: bool = False


class Attachment(AttachmentBase):
    id: int
    communication_id: int
    storage_path: str
    checksum: Optional[str] = None
    content_id: Optional[str] = None
    created_at: Optional[datetime] = None


# ============== Communication Link Schemas ==============

class CommunicationLinkBase(CRMBaseSchema):
    link_type: DocumentLinkType
    erp_document_id: Optional[int] = None  # ID from HUGWAWI (order, offer, etc.)
    erp_document_number: Optional[str] = None
    # Extended ERP references
    erp_order_article_id: Optional[int] = None  # order_article.id
    erp_bom_item_id: Optional[int] = None  # packingnote_details.id
    erp_operation_id: Optional[int] = None  # workplan_details.id
    # Local DB references
    local_article_id: Optional[int] = None  # articles.id
    local_pps_todo_id: Optional[int] = None  # pps_todos.id


class CommunicationLinkCreate(CommunicationLinkBase):
    communication_id: int


class CommunicationLink(CommunicationLinkBase):
    id: int
    communication_id: int
    is_auto_assigned: bool = False
    assigned_by_user_id: Optional[int] = None
    assigned_at: Optional[datetime] = None


# ============== Communication Entry Schemas ==============

class CommunicationEntryBase(CRMBaseSchema):
    entry_type: CommunicationType
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    is_internal: bool = False
    communication_date: datetime


class CommunicationEntryCreate(CommunicationEntryBase):
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    recipient_emails: Optional[List[str]] = None
    cc_emails: Optional[List[str]] = None
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    erp_contact_id: Optional[int] = None
    # For document links
    document_links: Optional[List[CommunicationLinkBase]] = None


class CommunicationEntryUpdate(CRMBaseSchema):
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    is_internal: Optional[bool] = None
    is_read: Optional[bool] = None
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    erp_contact_id: Optional[int] = None


class CommunicationEntry(CommunicationEntryBase):
    id: int
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    recipient_emails: Optional[List[str]] = None
    cc_emails: Optional[List[str]] = None
    bcc_emails: Optional[List[str]] = None
    message_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    thread_id: Optional[str] = None
    mailbox_id: Optional[int] = None
    is_read: bool = False
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    erp_contact_id: Optional[int] = None
    assignment_confidence: Optional[float] = None
    is_auto_assigned: bool = False
    created_by_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Related data
    attachments: List[Attachment] = []
    links: List[CommunicationLink] = []
    attachment_count: int = 0


class CommunicationEntryWithDetails(CommunicationEntry):
    """Extended communication entry with resolved ERP details"""
    customer_name: Optional[str] = None
    supplier_name: Optional[str] = None
    contact_name: Optional[str] = None


class CommunicationListResponse(CRMBaseSchema):
    items: List[CommunicationEntry]
    total: int
    skip: int = 0
    limit: int = 50


# ============== Lead Schemas ==============

class LeadBase(CRMBaseSchema):
    title: str
    description: Optional[str] = None
    erp_customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    status: LeadStatus = LeadStatus.NEW
    expected_value: Optional[Decimal] = None
    expected_close_date: Optional[date] = None
    source: Optional[str] = None
    priority: int = 50


class LeadCreate(LeadBase):
    assigned_employee_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None


class LeadUpdate(CRMBaseSchema):
    title: Optional[str] = None
    description: Optional[str] = None
    erp_customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    status: Optional[LeadStatus] = None
    lost_reason: Optional[str] = None
    expected_value: Optional[Decimal] = None
    expected_close_date: Optional[date] = None
    assigned_employee_id: Optional[int] = None
    source: Optional[str] = None
    priority: Optional[int] = None
    tag_ids: Optional[List[int]] = None


class Lead(LeadBase):
    id: int
    lost_reason: Optional[str] = None
    assigned_employee_id: Optional[int] = None
    erp_offer_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Related
    tags: List[Tag] = []
    assigned_employee_name: Optional[str] = None


class LeadWithDetails(Lead):
    """Lead with additional computed fields"""
    task_count: int = 0
    communication_count: int = 0
    days_in_status: int = 0


class LeadListResponse(CRMBaseSchema):
    items: List[Lead]
    total: int
    by_status: dict = {}  # Count per status


class LeadConvertRequest(CRMBaseSchema):
    """Request to convert lead to ERP offer"""
    create_offer: bool = True  # If false, just mark as won


# ============== Task Schemas ==============

class TaskBase(CRMBaseSchema):
    title: str
    description: Optional[str] = None
    task_type: TaskType = TaskType.INTERNAL
    status: TaskStatus = TaskStatus.OPEN
    priority: int = 50
    due_date: Optional[date] = None
    due_time: Optional[time] = None


class TaskCreate(TaskBase):
    assigned_employee_id: Optional[int] = None
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    lead_id: Optional[int] = None
    communication_id: Optional[int] = None
    link_type: Optional[DocumentLinkType] = None
    erp_document_id: Optional[int] = None


class TaskUpdate(CRMBaseSchema):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[TaskType] = None
    status: Optional[TaskStatus] = None
    priority: Optional[int] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    assigned_employee_id: Optional[int] = None
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    lead_id: Optional[int] = None
    link_type: Optional[DocumentLinkType] = None
    erp_document_id: Optional[int] = None


class Task(TaskBase):
    id: int
    assigned_user_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    lead_id: Optional[int] = None
    communication_id: Optional[int] = None
    link_type: Optional[str] = None
    erp_document_id: Optional[int] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Computed
    is_overdue: bool = False
    assigned_employee_name: Optional[str] = None


class TaskWithDetails(Task):
    """Task with resolved reference names"""
    customer_name: Optional[str] = None
    supplier_name: Optional[str] = None
    lead_title: Optional[str] = None
    document_number: Optional[str] = None


class TaskListResponse(CRMBaseSchema):
    items: List[Task]
    total: int
    overdue_count: int = 0
    today_count: int = 0


class MyDayResponse(CRMBaseSchema):
    """Response for 'My Day' view"""
    today_tasks: List[TaskWithDetails] = []
    overdue_tasks: List[TaskWithDetails] = []
    upcoming_tasks: List[TaskWithDetails] = []
    total_open: int = 0


# ============== Email Template Schemas ==============

class EmailTemplateBase(CRMBaseSchema):
    name: str
    language: str = "de"
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    template_type: str = "general"
    is_active: bool = True


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(CRMBaseSchema):
    name: Optional[str] = None
    language: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    template_type: Optional[str] = None
    is_active: Optional[bool] = None


class EmailTemplate(EmailTemplateBase):
    id: int
    created_by_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EmailTemplateListResponse(CRMBaseSchema):
    items: List[EmailTemplate]
    total: int


# ============== User Signature Schemas ==============

class UserSignatureBase(CRMBaseSchema):
    language: str = "de"
    signature_html: Optional[str] = None
    signature_text: Optional[str] = None
    is_default: bool = True


class UserSignatureCreate(UserSignatureBase):
    user_id: int


class UserSignatureUpdate(CRMBaseSchema):
    language: Optional[str] = None
    signature_html: Optional[str] = None
    signature_text: Optional[str] = None
    is_default: Optional[bool] = None


class UserSignature(UserSignatureBase):
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============== Email Send/Compose Schemas ==============

class EmailSendRequest(CRMBaseSchema):
    """Request to send an email"""
    mailbox_id: int
    to_emails: List[str]
    cc_emails: Optional[List[str]] = None
    bcc_emails: Optional[List[str]] = None
    subject: str
    body_html: str
    body_text: Optional[str] = None
    
    # Optional references
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    lead_id: Optional[int] = None
    
    # Document links
    document_links: Optional[List[CommunicationLinkBase]] = None
    
    # Template
    template_id: Optional[int] = None
    include_signature: bool = True
    
    # Attachments (file IDs from upload)
    attachment_ids: Optional[List[int]] = None


class EmailSendResponse(CRMBaseSchema):
    success: bool
    communication_id: Optional[int] = None
    message_id: Optional[str] = None
    error: Optional[str] = None


class TemplateRenderRequest(CRMBaseSchema):
    """Request to render a template with variables"""
    template_id: int
    variables: dict = {}


class TemplateRenderResponse(CRMBaseSchema):
    subject: str
    body: str


# ============== Timeline Schemas ==============

class TimelineEntry(CRMBaseSchema):
    """Single entry in a timeline view"""
    id: int
    entry_type: str
    date: datetime
    subject: Optional[str] = None
    body_preview: Optional[str] = None
    sender: Optional[str] = None
    is_internal: bool = False
    has_attachments: bool = False
    attachment_count: int = 0
    
    # For tasks
    status: Optional[str] = None
    is_overdue: bool = False
    
    # For leads
    lead_status: Optional[str] = None
    
    # Document links
    linked_documents: List[dict] = []


class TimelineResponse(CRMBaseSchema):
    """Complete timeline for a customer or document"""
    entity_type: str  # customer, supplier, order, offer, etc.
    entity_id: int
    entity_name: Optional[str] = None
    
    entries: List[TimelineEntry] = []
    total: int = 0
    
    # Summary
    email_count: int = 0
    call_count: int = 0
    meeting_count: int = 0
    note_count: int = 0
    task_count: int = 0


# ============== Search Schemas ==============

class SearchRequest(CRMBaseSchema):
    """Search request"""
    query: str
    search_in: List[str] = ["subject", "body", "sender"]  # Fields to search
    entry_types: Optional[List[CommunicationType]] = None
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    limit: int = 50
    offset: int = 0


class SearchResult(CRMBaseSchema):
    """Single search result"""
    id: int
    entry_type: str
    subject: Optional[str] = None
    body_preview: Optional[str] = None
    sender: Optional[str] = None
    date: datetime
    customer_name: Optional[str] = None
    supplier_name: Optional[str] = None
    relevance_score: float = 0.0
    highlight: Optional[str] = None  # Highlighted match


class SearchResponse(CRMBaseSchema):
    """Search results"""
    items: List[SearchResult]
    total: int
    query: str


# ============== Dashboard Schemas ==============

class DashboardStats(CRMBaseSchema):
    """CRM Dashboard statistics"""
    # Communications
    total_communications: int = 0
    unread_emails: int = 0
    communications_today: int = 0
    communications_this_week: int = 0
    
    # Tasks
    open_tasks: int = 0
    overdue_tasks: int = 0
    tasks_due_today: int = 0
    tasks_completed_this_week: int = 0
    
    # Leads
    total_leads: int = 0
    leads_by_status: dict = {}
    pipeline_value: Decimal = Decimal("0")
    leads_won_this_month: int = 0
    leads_lost_this_month: int = 0


class RecentActivity(CRMBaseSchema):
    """Recent activity item for dashboard"""
    id: int
    activity_type: str  # communication, task, lead
    title: str
    description: Optional[str] = None
    date: datetime
    customer_name: Optional[str] = None
    user_name: Optional[str] = None


class DashboardResponse(CRMBaseSchema):
    """Complete dashboard data"""
    stats: DashboardStats
    recent_activities: List[RecentActivity] = []
    my_tasks: List[Task] = []
    my_leads: List[Lead] = []


# ============== Sync Schemas ==============

class MailboxSyncRequest(CRMBaseSchema):
    """Request to sync a mailbox"""
    mailbox_id: int
    full_sync: bool = False  # If true, ignore last_sync_uid


class MailboxSyncResponse(CRMBaseSchema):
    """Sync result"""
    success: bool
    mailbox_id: int
    new_emails: int = 0
    updated_emails: int = 0
    errors: List[str] = []
    last_sync_at: Optional[datetime] = None


# ============== Assignment Schemas ==============

class AssignmentSuggestion(CRMBaseSchema):
    """Suggested assignment for an email"""
    target_type: str  # customer, supplier
    erp_id: int
    name: str
    confidence: float  # 0.0 - 1.0
    reason: str  # Why this suggestion


class AssignmentRequest(CRMBaseSchema):
    """Request to assign communication to customer/supplier/document"""
    communication_id: int
    erp_customer_id: Optional[int] = None
    erp_supplier_id: Optional[int] = None
    document_links: Optional[List[CommunicationLinkBase]] = None


class AssignmentResponse(CRMBaseSchema):
    """Assignment result"""
    success: bool
    communication_id: int
    suggestions: List[AssignmentSuggestion] = []  # If auto-assignment uncertain


# ============== Customer/Supplier Info Schemas ==============

class CustomerInfo(CRMBaseSchema):
    """Basic customer info from HUGWAWI"""
    id: int
    customer_number: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    salesperson_id: Optional[int] = None
    salesperson_name: Optional[str] = None


class SupplierInfo(CRMBaseSchema):
    """Basic supplier info from HUGWAWI"""
    id: int
    supplier_number: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None


class ContactInfo(CRMBaseSchema):
    """Contact person info from HUGWAWI"""
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    customer_id: Optional[int] = None
    supplier_id: Optional[int] = None


class CustomerSearchResponse(CRMBaseSchema):
    """Customer search results"""
    items: List[CustomerInfo]
    total: int


class SupplierSearchResponse(CRMBaseSchema):
    """Supplier search results"""
    items: List[SupplierInfo]
    total: int
