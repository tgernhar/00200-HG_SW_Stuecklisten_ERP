# Pydantic Schemas
from app.schemas.project import Project, ProjectCreate, ProjectUpdate
from app.schemas.article import Article, ArticleCreate, ArticleUpdate, ArticleBatchUpdate
from app.schemas.bom import Bom, BomCreate
from app.schemas.import_job import ImportJobRead, ImportJobCreate
# PPS Schemas
from app.schemas.pps import (
    Todo, TodoCreate, TodoUpdate, TodoWithDetails, TodoFilter, TodoListResponse,
    TodoSegment, TodoSegmentCreate, TodoSplitRequest,
    Dependency, DependencyCreate,
    Resource, ResourceCreate, ResourceUpdate,
    Conflict, ConflictCreate, ConflictWithTodos, ConflictListResponse,
    GanttTask, GanttLink, GanttData, GanttSyncRequest, GanttSyncResponse,
    GenerateTodosRequest, GenerateTodosResponse, AvailableOrder,
    ResourceSyncRequest, ResourceSyncResponse,
    TodoType, TodoStatus, DependencyType, ConflictType, ConflictSeverity, ResourceType,
)
# CRM Schemas
from app.schemas.crm import (
    CommunicationType, LeadStatus, TaskType, TaskStatus, TagType, DocumentLinkType,
    Mailbox, MailboxCreate, MailboxUpdate, MailboxListResponse,
    Tag, TagCreate, TagUpdate, TagListResponse,
    Attachment,
    CommunicationLink, CommunicationLinkBase, CommunicationLinkCreate,
    CommunicationEntry, CommunicationEntryCreate, CommunicationEntryUpdate,
    CommunicationEntryWithDetails, CommunicationListResponse,
    Lead, LeadCreate, LeadUpdate, LeadWithDetails, LeadListResponse, LeadConvertRequest,
    Task, TaskCreate, TaskUpdate, TaskWithDetails, TaskListResponse, MyDayResponse,
    EmailTemplate, EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateListResponse,
    UserSignature, UserSignatureCreate, UserSignatureUpdate,
    EmailSendRequest, EmailSendResponse, TemplateRenderRequest, TemplateRenderResponse,
    TimelineEntry, TimelineResponse,
    SearchRequest, SearchResult, SearchResponse,
    DashboardStats, RecentActivity, DashboardResponse,
    MailboxSyncRequest, MailboxSyncResponse,
    AssignmentSuggestion, AssignmentRequest, AssignmentResponse,
    CustomerInfo, SupplierInfo, ContactInfo, CustomerSearchResponse, SupplierSearchResponse,
)

__all__ = [
    "Project", "ProjectCreate", "ProjectUpdate",
    "Article", "ArticleCreate", "ArticleUpdate", "ArticleBatchUpdate",
    "Bom", "BomCreate",
    "ImportJobRead", "ImportJobCreate",
    # PPS Schemas
    "Todo", "TodoCreate", "TodoUpdate", "TodoWithDetails", "TodoFilter", "TodoListResponse",
    "TodoSegment", "TodoSegmentCreate", "TodoSplitRequest",
    "Dependency", "DependencyCreate",
    "Resource", "ResourceCreate", "ResourceUpdate",
    "Conflict", "ConflictCreate", "ConflictWithTodos", "ConflictListResponse",
    "GanttTask", "GanttLink", "GanttData", "GanttSyncRequest", "GanttSyncResponse",
    "GenerateTodosRequest", "GenerateTodosResponse", "AvailableOrder",
    "ResourceSyncRequest", "ResourceSyncResponse",
    "TodoType", "TodoStatus", "DependencyType", "ConflictType", "ConflictSeverity", "ResourceType",
    # CRM Schemas
    "CommunicationType", "LeadStatus", "TaskType", "TaskStatus", "TagType", "DocumentLinkType",
    "Mailbox", "MailboxCreate", "MailboxUpdate", "MailboxListResponse",
    "Tag", "TagCreate", "TagUpdate", "TagListResponse",
    "Attachment",
    "CommunicationLink", "CommunicationLinkBase", "CommunicationLinkCreate",
    "CommunicationEntry", "CommunicationEntryCreate", "CommunicationEntryUpdate",
    "CommunicationEntryWithDetails", "CommunicationListResponse",
    "Lead", "LeadCreate", "LeadUpdate", "LeadWithDetails", "LeadListResponse", "LeadConvertRequest",
    "Task", "TaskCreate", "TaskUpdate", "TaskWithDetails", "TaskListResponse", "MyDayResponse",
    "EmailTemplate", "EmailTemplateCreate", "EmailTemplateUpdate", "EmailTemplateListResponse",
    "UserSignature", "UserSignatureCreate", "UserSignatureUpdate",
    "EmailSendRequest", "EmailSendResponse", "TemplateRenderRequest", "TemplateRenderResponse",
    "TimelineEntry", "TimelineResponse",
    "SearchRequest", "SearchResult", "SearchResponse",
    "DashboardStats", "RecentActivity", "DashboardResponse",
    "MailboxSyncRequest", "MailboxSyncResponse",
    "AssignmentSuggestion", "AssignmentRequest", "AssignmentResponse",
    "CustomerInfo", "SupplierInfo", "ContactInfo", "CustomerSearchResponse", "SupplierSearchResponse",
]
