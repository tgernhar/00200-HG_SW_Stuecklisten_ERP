"""
PPS (Production Planning System) Models

Contains all models for production planning:
- PPSTodo: Main planning units (operations/containers)
- PPSTodoSegment: Splits for todos
- PPSTodoDependency: Task dependencies
- PPSResourceCache: Cached resources from HUGWAWI
- PPSConflict: Detected conflicts
- PPSAuditLog: Change tracking
- PPSWorkingHours: Core working hours configuration
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text, DateTime, Date, JSON, Time
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class PPSWorkingHours(Base):
    """Weekly core working hours configuration for production planning"""
    __tablename__ = "pps_working_hours"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    day_of_week = Column(Integer, nullable=False, unique=True)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=True)  # NULL = no work on this day
    end_time = Column(Time, nullable=True)
    is_working_day = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PPSTodoTypeConfig(Base):
    """Configuration for todo types - defines standard naming, colors, hierarchy"""
    __tablename__ = "pps_todo_type_config"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    todo_type = Column(String(50), nullable=False, unique=True)  # e.g. 'container_order', 'bom_item'
    display_name = Column(String(100), nullable=False)  # German display name
    title_prefix = Column(String(50), nullable=True)  # Prefix for todo title
    title_template = Column(String(200), nullable=False)  # Template like "{prefix}{name}"
    gantt_color = Column(String(20), nullable=False)  # Hex color for Gantt
    gantt_type = Column(String(20), nullable=False, default='task')  # task, project, milestone
    hierarchy_level = Column(Integer, nullable=False)  # 1=Order, 2=Article, 3=BOM, 4=Operation
    default_duration_minutes = Column(Integer, nullable=False, default=60)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PPSResourceCache(Base):
    """Cached resources from HUGWAWI (departments, machines, employees)"""
    __tablename__ = "pps_resource_cache"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    resource_type = Column(String(20), nullable=False)  # 'department', 'machine', 'employee'
    erp_id = Column(Integer, nullable=False)  # ID from HUGWAWI
    erp_department_id = Column(Integer, nullable=True, index=True)  # qualificationitem.department (for machines)
    level = Column(Integer, nullable=True, default=3)  # qualificationitem.level (1-5, for machines)
    name = Column(String(100), nullable=False)
    capacity = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    calendar_json = Column(JSON, nullable=True)  # Working hours
    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships (back references)
    assigned_todos_department = relationship(
        "PPSTodo",
        foreign_keys="PPSTodo.assigned_department_id",
        back_populates="assigned_department"
    )
    assigned_todos_machine = relationship(
        "PPSTodo",
        foreign_keys="PPSTodo.assigned_machine_id",
        back_populates="assigned_machine"
    )
    assigned_todos_employee = relationship(
        "PPSTodo",
        foreign_keys="PPSTodo.assigned_employee_id",
        back_populates="assigned_employee"
    )


class PPSTodo(Base):
    """Main planning unit - represents an operation or container"""
    __tablename__ = "pps_todos"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # ERP references (from HUGWAWI)
    erp_order_id = Column(Integer, nullable=True, index=True)  # ordertable.id
    erp_order_article_id = Column(Integer, nullable=True)  # order_article.id
    erp_packingnote_details_id = Column(Integer, nullable=True)  # packingnote_details.id (BOM item)
    erp_workplan_detail_id = Column(Integer, nullable=True)  # workplan_details.id
    
    # Hierarchy
    parent_todo_id = Column(Integer, ForeignKey("pps_todos.id", ondelete="SET NULL"), nullable=True)
    todo_type = Column(String(20), nullable=False, index=True)  # 'container_order', 'container_article', 'operation'
    gantt_display_type = Column(String(20), nullable=True)  # 'task', 'project', 'milestone' - for Gantt chart display
    
    # Basic info
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    
    # Time calculations
    setup_time_minutes = Column(Integer, nullable=True)  # Rüstzeit
    run_time_minutes = Column(Integer, nullable=True)  # Stückzeit
    total_duration_minutes = Column(Integer, nullable=True)  # Calculated or manual
    is_duration_manual = Column(Boolean, nullable=False, default=False)
    
    # Planning
    planned_start = Column(DateTime, nullable=True, index=True)
    planned_end = Column(DateTime, nullable=True)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String(20), nullable=False, default='new', index=True)  # 'new', 'planned', 'in_progress', 'completed', 'blocked'
    block_reason = Column(String(500), nullable=True)
    priority = Column(Integer, nullable=False, default=50)  # 1=highest, 100=lowest
    delivery_date = Column(Date, nullable=True, index=True)  # From order
    
    # Resource assignment (FK to pps_resource_cache)
    assigned_department_id = Column(Integer, ForeignKey("pps_resource_cache.id", ondelete="SET NULL"), nullable=True)
    assigned_machine_id = Column(Integer, ForeignKey("pps_resource_cache.id", ondelete="SET NULL"), nullable=True)
    assigned_employee_id = Column(Integer, ForeignKey("pps_resource_cache.id", ondelete="SET NULL"), nullable=True)
    
    # Creator for "eigene" todos (employee's personal tasks)
    creator_employee_id = Column(Integer, ForeignKey("pps_resource_cache.id", ondelete="SET NULL"), nullable=True)
    
    # Optimistic locking
    version = Column(Integer, nullable=False, default=1)
    
    # Progress tracking (0.0 - 1.0)
    progress = Column(Float, nullable=False, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    parent = relationship("PPSTodo", remote_side=[id], back_populates="children")
    children = relationship("PPSTodo", back_populates="parent", cascade="all")
    
    segments = relationship("PPSTodoSegment", back_populates="todo", cascade="all, delete-orphan")
    
    # Dependencies where this todo is the predecessor
    successor_dependencies = relationship(
        "PPSTodoDependency",
        foreign_keys="PPSTodoDependency.predecessor_id",
        back_populates="predecessor",
        cascade="all, delete-orphan"
    )
    # Dependencies where this todo is the successor
    predecessor_dependencies = relationship(
        "PPSTodoDependency",
        foreign_keys="PPSTodoDependency.successor_id",
        back_populates="successor",
        cascade="all, delete-orphan"
    )
    
    conflicts = relationship("PPSConflict", foreign_keys="PPSConflict.todo_id", back_populates="todo", cascade="all, delete-orphan")
    
    # Resource relationships
    assigned_department = relationship(
        "PPSResourceCache",
        foreign_keys=[assigned_department_id],
        back_populates="assigned_todos_department"
    )
    assigned_machine = relationship(
        "PPSResourceCache",
        foreign_keys=[assigned_machine_id],
        back_populates="assigned_todos_machine"
    )
    assigned_employee = relationship(
        "PPSResourceCache",
        foreign_keys=[assigned_employee_id],
        back_populates="assigned_todos_employee"
    )
    
    def calculate_duration(self):
        """
        Calculate total duration from setup and run times.
        Returns duration rounded to 15-minute intervals (REQ-TODO-010).
        """
        if self.is_duration_manual and self.total_duration_minutes is not None:
            return self.total_duration_minutes
        
        setup = self.setup_time_minutes or 0
        run = self.run_time_minutes or 0
        qty = self.quantity or 1
        
        raw_duration = setup + (run * qty)
        
        # Round to 15-minute intervals (REQ-TODO-010, REQ-CAL-001)
        if raw_duration <= 0:
            return 15
        return int(((raw_duration + 14) // 15) * 15)
    
    def to_gantt_task(self):
        """Convert to DHTMLX Gantt task format"""
        return {
            "id": self.id,
            "text": self.title,
            "start_date": self.planned_start.strftime("%Y-%m-%d %H:%M") if self.planned_start else None,
            "duration": self.total_duration_minutes or self.calculate_duration(),
            "parent": self.parent_todo_id or 0,
            "type": "project" if self.todo_type.startswith("container") else "task",
            "progress": 1.0 if self.status == "completed" else (0.5 if self.status == "in_progress" else 0),
            "status": self.status,
            "resource_id": self.assigned_machine_id or self.assigned_employee_id,
            "has_conflict": len(self.conflicts) > 0 if self.conflicts else False,
        }


class PPSTodoSegment(Base):
    """Segment/split of a todo for interrupted work"""
    __tablename__ = "pps_todo_segments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    todo_id = Column(Integer, ForeignKey("pps_todos.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_index = Column(Integer, nullable=False)  # 0, 1, 2, ...
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    assigned_machine_id = Column(Integer, ForeignKey("pps_resource_cache.id", ondelete="SET NULL"), nullable=True)
    assigned_employee_id = Column(Integer, ForeignKey("pps_resource_cache.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    todo = relationship("PPSTodo", back_populates="segments")


class PPSTodoDependency(Base):
    """Dependency between two todos (predecessor -> successor)"""
    __tablename__ = "pps_todo_dependencies"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    predecessor_id = Column(Integer, ForeignKey("pps_todos.id", ondelete="CASCADE"), nullable=False, index=True)
    successor_id = Column(Integer, ForeignKey("pps_todos.id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_type = Column(String(20), nullable=False, default='finish_to_start')  # 'finish_to_start', 'start_to_start', 'finish_to_finish'
    lag_minutes = Column(Integer, nullable=False, default=0)  # Delay between tasks
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    predecessor = relationship(
        "PPSTodo",
        foreign_keys=[predecessor_id],
        back_populates="successor_dependencies"
    )
    successor = relationship(
        "PPSTodo",
        foreign_keys=[successor_id],
        back_populates="predecessor_dependencies"
    )
    
    def to_gantt_link(self):
        """Convert to DHTMLX Gantt link format"""
        # DHTMLX link types: 0=F2S, 1=S2S, 2=F2F, 3=S2F
        type_map = {
            'finish_to_start': 0,
            'start_to_start': 1,
            'finish_to_finish': 2,
        }
        return {
            "id": self.id,
            "source": self.predecessor_id,
            "target": self.successor_id,
            "type": type_map.get(self.dependency_type, 0),
            "lag": self.lag_minutes,
        }


class PPSConflict(Base):
    """Detected conflict for a todo"""
    __tablename__ = "pps_conflicts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conflict_type = Column(String(30), nullable=False, index=True)  # 'resource_overlap', 'calendar', 'dependency', 'delivery_date', 'qualification'
    todo_id = Column(Integer, ForeignKey("pps_todos.id", ondelete="CASCADE"), nullable=False, index=True)
    related_todo_id = Column(Integer, ForeignKey("pps_todos.id", ondelete="CASCADE"), nullable=True)
    description = Column(Text, nullable=False)
    severity = Column(String(10), nullable=False, default='warning')  # 'warning', 'error'
    resolved = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    todo = relationship("PPSTodo", foreign_keys=[todo_id], back_populates="conflicts")
    related_todo = relationship("PPSTodo", foreign_keys=[related_todo_id])


class PPSAuditLog(Base):
    """Audit log for tracking changes to todos"""
    __tablename__ = "pps_audit_log"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    todo_id = Column(Integer, nullable=True, index=True)  # nullable if todo was deleted
    user_id = Column(Integer, nullable=True)
    user_name = Column(String(50), nullable=True)
    action = Column(String(50), nullable=False, index=True)  # 'create', 'update', 'delete', 'move', 'split', 'status_change'
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class PPSUserFilterPreset(Base):
    """User-specific filter presets for PPS pages"""
    __tablename__ = "pps_user_filter_presets"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)  # userlogin.id
    name = Column(String(100), nullable=False)  # Preset display name
    page = Column(String(50), nullable=False, index=True)  # "todo_list", "planboard", etc.
    is_favorite = Column(Boolean, nullable=False, default=False)  # Auto-load on page open
    filter_config = Column(JSON, nullable=False)  # Serialized filter settings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
