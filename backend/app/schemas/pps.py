"""
PPS (Production Planning System) Schemas

Pydantic schemas for API request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from enum import Enum


# ============== Enums ==============

class TodoType(str, Enum):
    CONTAINER_ORDER = "container_order"
    CONTAINER_ARTICLE = "container_article"
    OPERATION = "operation"
    EIGENE = "eigene"  # Employee-specific personal todos
    TASK = "task"  # Generic task
    PROJECT = "project"  # Project/container


class TodoStatus(str, Enum):
    NEW = "new"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


class DependencyType(str, Enum):
    FINISH_TO_START = "finish_to_start"
    START_TO_START = "start_to_start"
    FINISH_TO_FINISH = "finish_to_finish"


class ConflictType(str, Enum):
    RESOURCE_OVERLAP = "resource_overlap"
    CALENDAR = "calendar"
    DEPENDENCY = "dependency"
    DELIVERY_DATE = "delivery_date"
    QUALIFICATION = "qualification"


class ConflictSeverity(str, Enum):
    WARNING = "warning"
    ERROR = "error"


class ResourceType(str, Enum):
    DEPARTMENT = "department"
    MACHINE = "machine"
    EMPLOYEE = "employee"


# ============== Resource Schemas ==============

class ResourceBase(BaseModel):
    resource_type: ResourceType
    erp_id: int
    erp_department_id: Optional[int] = None  # qualificationitem.department (for machines)
    level: Optional[int] = None  # qualificationitem.level (1-5, for machines)
    name: str
    capacity: int = 1
    is_active: bool = True
    calendar_json: Optional[Dict[str, Any]] = None


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None
    calendar_json: Optional[Dict[str, Any]] = None


class Resource(ResourceBase):
    id: int
    last_sync_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============== Todo Schemas ==============

class TodoBase(BaseModel):
    todo_type: TodoType
    title: str
    description: Optional[str] = None
    quantity: int = 1
    setup_time_minutes: Optional[int] = None
    run_time_minutes: Optional[int] = None
    total_duration_minutes: Optional[int] = None
    is_duration_manual: bool = False
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    status: TodoStatus = TodoStatus.NEW
    block_reason: Optional[str] = None
    priority: int = 0
    delivery_date: Optional[date] = None
    progress: float = 0.0  # 0.0 - 1.0


class TodoCreate(TodoBase):
    erp_order_id: Optional[int] = None
    erp_order_article_id: Optional[int] = None
    erp_packingnote_details_id: Optional[int] = None  # BOM item from packingnote_details
    erp_workplan_detail_id: Optional[int] = None
    parent_todo_id: Optional[int] = None
    assigned_department_id: Optional[int] = None
    assigned_machine_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None
    creator_employee_id: Optional[int] = None  # For "eigene" todos


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    setup_time_minutes: Optional[int] = None
    run_time_minutes: Optional[int] = None
    total_duration_minutes: Optional[int] = None
    is_duration_manual: Optional[bool] = None
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    status: Optional[TodoStatus] = None
    block_reason: Optional[str] = None
    priority: Optional[int] = None
    delivery_date: Optional[date] = None
    parent_todo_id: Optional[int] = None
    assigned_department_id: Optional[int] = None
    assigned_machine_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None
    gantt_display_type: Optional[str] = None  # 'task', 'project', 'milestone'
    progress: Optional[float] = None  # 0.0 - 1.0
    # For optimistic locking
    version: Optional[int] = None


class Todo(TodoBase):
    id: int
    erp_order_id: Optional[int] = None
    erp_order_article_id: Optional[int] = None
    erp_packingnote_details_id: Optional[int] = None  # BOM item from packingnote_details
    erp_workplan_detail_id: Optional[int] = None
    parent_todo_id: Optional[int] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    assigned_department_id: Optional[int] = None
    assigned_machine_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None
    creator_employee_id: Optional[int] = None  # For "eigene" todos
    version: int = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Computed fields
    has_conflicts: bool = False
    conflict_count: int = 0
    
    class Config:
        from_attributes = True


class TodoWithERPDetails(Todo):
    """Todo with resolved ERP names for display in frontend"""
    # ERP-resolved names (from HUGWAWI lookups)
    order_name: Optional[str] = None  # ordertable.name
    order_article_number: Optional[str] = None  # article.articlenumber via order_article
    order_article_path: Optional[str] = None  # article.customtext7 via order_article (folder path)
    bom_article_number: Optional[str] = None  # article.articlenumber via packingnote_details
    bom_article_path: Optional[str] = None  # article.customtext7 via packingnote_details (folder path)
    workstep_name: Optional[str] = None  # qualificationitem.name via workplan_details


class TodoWithDetails(Todo):
    """Todo with related data for detail view"""
    assigned_department: Optional[Resource] = None
    assigned_machine: Optional[Resource] = None
    assigned_employee: Optional[Resource] = None
    children: List["TodoWithDetails"] = []
    segments: List["TodoSegment"] = []
    conflicts: List["Conflict"] = []


# ============== Todo Segment Schemas ==============

class TodoSegmentBase(BaseModel):
    segment_index: int
    start_time: datetime
    end_time: datetime
    assigned_machine_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None


class TodoSegmentCreate(TodoSegmentBase):
    todo_id: int


class TodoSegment(TodoSegmentBase):
    id: int
    todo_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TodoSplitRequest(BaseModel):
    """Request to split a todo into multiple segments"""
    segments: List[TodoSegmentBase] = Field(..., min_length=2)


# ============== Dependency Schemas ==============

class DependencyBase(BaseModel):
    predecessor_id: int
    successor_id: int
    dependency_type: DependencyType = DependencyType.FINISH_TO_START
    lag_minutes: int = 0
    is_active: bool = True


class DependencyCreate(DependencyBase):
    pass


class Dependency(DependencyBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============== Conflict Schemas ==============

class ConflictBase(BaseModel):
    conflict_type: ConflictType
    todo_id: int
    related_todo_id: Optional[int] = None
    description: str
    severity: ConflictSeverity = ConflictSeverity.WARNING
    resolved: bool = False


class ConflictCreate(ConflictBase):
    pass


class Conflict(ConflictBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConflictWithTodos(Conflict):
    """Conflict with todo details for UI display"""
    todo_title: Optional[str] = None
    related_todo_title: Optional[str] = None


# ============== Audit Log Schemas ==============

class AuditLogEntry(BaseModel):
    id: int
    todo_id: Optional[int] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============== Gantt Data Schemas (DHTMLX format) ==============

class GanttTask(BaseModel):
    """DHTMLX Gantt task format"""
    id: int
    text: str
    start_date: Optional[str] = None  # "YYYY-MM-DD HH:MM"
    duration: Optional[int] = None  # in minutes
    end_date: Optional[str] = None  # alternative to duration
    parent: int = 0  # 0 = root level
    type: str = "task"  # "task", "project", "milestone"
    progress: float = 0  # 0-1
    open: bool = True  # expanded state
    # Custom fields
    status: Optional[str] = None
    resource_id: Optional[int] = None
    resource_name: Optional[str] = None
    has_conflict: bool = False
    priority: int = 0
    delivery_date: Optional[str] = None


class GanttLink(BaseModel):
    """DHTMLX Gantt link format"""
    id: int
    source: int  # predecessor_id
    target: int  # successor_id
    type: int = 0  # 0=F2S, 1=S2S, 2=F2F, 3=S2F
    lag: int = 0  # in minutes


class GanttData(BaseModel):
    """Complete Gantt data structure"""
    data: List[GanttTask]
    links: List[GanttLink]


class GanttSyncRequest(BaseModel):
    """Batch sync request from Gantt after drag/drop"""
    updated_tasks: List[Dict[str, Any]] = []
    created_tasks: List[Dict[str, Any]] = []
    deleted_task_ids: List[int] = []
    updated_links: List[Dict[str, Any]] = []
    created_links: List[Dict[str, Any]] = []
    deleted_link_ids: List[int] = []


class GanttSyncResponse(BaseModel):
    """Response after batch sync"""
    success: bool
    updated_count: int = 0
    created_count: int = 0
    deleted_count: int = 0
    errors: List[str] = []
    # Return new IDs for created items
    created_task_ids: Dict[str, int] = {}  # temp_id -> real_id
    created_link_ids: Dict[str, int] = {}


# ============== Filter/Query Schemas ==============

class TodoFilter(BaseModel):
    """Filter parameters for todo queries"""
    erp_order_id: Optional[int] = None
    status: Optional[List[TodoStatus]] = None
    todo_type: Optional[List[TodoType]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    resource_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None  # Filter by specific employee
    has_conflicts: Optional[bool] = None
    parent_todo_id: Optional[int] = None
    search: Optional[str] = None
    # Cumulative filter flags (OR logic when multiple are true)
    filter_orders: bool = False  # Filter container_order types
    filter_articles: bool = False  # Filter container_article + BOM items
    filter_operations: bool = False  # Filter operation types


class TodoListResponse(BaseModel):
    """Paginated todo list response"""
    items: List[Todo]
    total: int
    skip: int
    limit: int


class TodoListWithERPResponse(BaseModel):
    """Paginated todo list with ERP details for frontend display"""
    items: List[TodoWithERPDetails]
    total: int
    skip: int
    limit: int


class ConflictListResponse(BaseModel):
    """List of conflicts"""
    items: List[ConflictWithTodos]
    total: int
    unresolved_count: int


# ============== Generation Schemas ==============

class GenerateTodosRequest(BaseModel):
    """Request to generate todos from ERP order/article"""
    erp_order_id: int
    erp_order_article_ids: Optional[List[int]] = None  # None = all articles
    include_workplan: bool = False  # Generate operation todos from workplan (default: off)
    include_bom_items: bool = False  # Generate BOM item todos (default: off)
    workplan_level: int = 1  # Maximum level for workplan import (1-5, default: 1 = CNC machines)


class GenerateTodosResponse(BaseModel):
    """Response after generating todos"""
    success: bool
    created_todos: int
    created_dependencies: int
    order_name: Optional[str] = None
    errors: List[str] = []


class AvailableOrder(BaseModel):
    """Order available for todo generation"""
    order_id: int
    order_name: str
    customer: Optional[str] = None
    delivery_date: Optional[date] = None
    article_count: int
    has_todos: bool = False
    todo_count: int = 0


# ============== Resource Sync Schemas ==============

class ResourceSyncRequest(BaseModel):
    """Request to sync resources from HUGWAWI"""
    resource_types: Optional[List[ResourceType]] = None  # None = all types


class ResourceSyncResponse(BaseModel):
    """Response after syncing resources"""
    success: bool
    synced_count: int
    added_count: int
    updated_count: int
    deactivated_count: int
    errors: List[str] = []


# ============== Working Hours Schemas ==============

class WorkingHoursBase(BaseModel):
    """Base schema for working hours"""
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: Optional[str] = None  # "HH:MM" format
    end_time: Optional[str] = None  # "HH:MM" format
    is_working_day: bool = True


class WorkingHoursUpdate(WorkingHoursBase):
    """Schema for updating working hours"""
    pass


class WorkingHours(WorkingHoursBase):
    """Schema for working hours response"""
    id: int
    day_name: str = ""  # Computed field
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkingHoursListResponse(BaseModel):
    """Response containing all 7 days"""
    items: List[WorkingHours]


# ============== Picker Schemas (for Todo creation from ERP hierarchy) ==============

class OrderArticleOption(BaseModel):
    """Order article option for picker dialog"""
    id: int  # order_article.id
    position: Optional[str] = None
    articlenumber: str
    description: Optional[str] = None
    quantity: Optional[int] = None
    has_todo: bool = False  # Whether a todo already exists for this article


class BomItemOption(BaseModel):
    """BOM item (Stücklistenartikel) option for picker dialog"""
    id: int  # packingnote_details.id
    position: Optional[str] = None
    articlenumber: str
    description: Optional[str] = None
    quantity: Optional[float] = None
    has_todo: bool = False


class WorkstepOption(BaseModel):
    """Workstep (Arbeitsgang) option for picker dialog"""
    id: int  # workplan_details.id
    position: Optional[str] = None
    name: str
    machine_name: Optional[str] = None
    setuptime: Optional[float] = None
    unittime: Optional[float] = None
    has_todo: bool = False


class AllWorkstepOption(BaseModel):
    """Workstep from workstep table (not from workplan)"""
    id: int  # workstep.id
    name: str


class MachineOption(BaseModel):
    """Machine (qualificationitem) option linked to a workstep"""
    id: int  # qualificationitem.id
    name: str
    description: Optional[str] = None


# ============== Batch Operation Schemas ==============

class BatchUpdateItem(BaseModel):
    """Single item in batch update request"""
    id: int
    start_date: Optional[str] = None  # "YYYY-MM-DD HH:MM"
    duration: Optional[int] = None  # in minutes
    progress: Optional[float] = None  # 0.0 - 1.0


class BatchUpdateRequest(BaseModel):
    """Request to update multiple todos at once (for auto-scheduling)"""
    updates: List[BatchUpdateItem]


class BatchUpdateResponse(BaseModel):
    """Response after batch update"""
    updated: List[int]


class ShiftTodosRequest(BaseModel):
    """Request to shift multiple todos by X minutes"""
    shift_minutes: int  # Positive = forward (later), negative = backward (earlier)
    date_from: Optional[str] = None  # Only shift tasks from this date (YYYY-MM-DD)
    department_id: Optional[int] = None  # Only shift tasks in this department


class ShiftTodosResponse(BaseModel):
    """Response after shifting todos"""
    shifted_count: int


class TodoDependenciesResponse(BaseModel):
    """Response containing predecessors and successors of a todo"""
    predecessors: List[Todo]
    successors: List[Todo]


# Forward references for self-referencing models
TodoWithDetails.model_rebuild()
