"""
PPS (Production Planning System) Routes

API endpoints for production planning:
- ToDo management (CRUD)
- Gantt data (DHTMLX format)
- Resources
- Conflicts
- Todo generation from ERP
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.database import get_db
from app.models.pps_todo import (
    PPSTodo, PPSTodoSegment, PPSTodoDependency,
    PPSResourceCache, PPSConflict, PPSAuditLog
)
from app.schemas.pps import (
    Todo, TodoCreate, TodoUpdate, TodoWithDetails, TodoFilter, TodoListResponse,
    TodoSegment, TodoSegmentCreate, TodoSplitRequest,
    Dependency, DependencyCreate,
    Resource, ResourceCreate, ResourceUpdate,
    Conflict, ConflictCreate, ConflictWithTodos, ConflictListResponse,
    GanttTask, GanttLink, GanttData, GanttSyncRequest, GanttSyncResponse,
    GenerateTodosRequest, GenerateTodosResponse, AvailableOrder,
    ResourceSyncRequest, ResourceSyncResponse,
    TodoType, TodoStatus, ResourceType,
)
from app.services.pps_sync_service import (
    get_subordinate_ids, 
    get_employee_resource_ids_for_erp_ids
)

router = APIRouter(prefix="/pps", tags=["PPS"])


# ============== Helper Functions ==============

def _todo_to_response(todo: PPSTodo, include_conflicts: bool = True) -> Todo:
    """Convert SQLAlchemy model to Pydantic schema"""
    conflict_count = len(todo.conflicts) if include_conflicts and todo.conflicts else 0
    return Todo(
        id=todo.id,
        erp_order_id=todo.erp_order_id,
        erp_order_article_id=todo.erp_order_article_id,
        erp_workplan_detail_id=todo.erp_workplan_detail_id,
        parent_todo_id=todo.parent_todo_id,
        todo_type=TodoType(todo.todo_type),
        title=todo.title,
        description=todo.description,
        quantity=todo.quantity,
        setup_time_minutes=todo.setup_time_minutes,
        run_time_minutes=todo.run_time_minutes,
        total_duration_minutes=todo.total_duration_minutes,
        is_duration_manual=todo.is_duration_manual,
        planned_start=todo.planned_start,
        planned_end=todo.planned_end,
        actual_start=todo.actual_start,
        actual_end=todo.actual_end,
        status=TodoStatus(todo.status),
        block_reason=todo.block_reason,
        priority=todo.priority,
        delivery_date=todo.delivery_date,
        assigned_department_id=todo.assigned_department_id,
        assigned_machine_id=todo.assigned_machine_id,
        assigned_employee_id=todo.assigned_employee_id,
        version=todo.version,
        created_at=todo.created_at,
        updated_at=todo.updated_at,
        has_conflicts=conflict_count > 0,
        conflict_count=conflict_count,
    )


def _todo_to_gantt_task(todo: PPSTodo) -> GanttTask:
    """Convert todo to DHTMLX Gantt task format"""
    duration = todo.total_duration_minutes or todo.calculate_duration() or 60
    
    # Determine resource name
    resource_name = None
    resource_id = None
    if todo.assigned_machine:
        resource_name = todo.assigned_machine.name
        resource_id = todo.assigned_machine_id
    elif todo.assigned_employee:
        resource_name = todo.assigned_employee.name
        resource_id = todo.assigned_employee_id
    elif todo.assigned_department:
        resource_name = todo.assigned_department.name
        resource_id = todo.assigned_department_id
    
    # Calculate progress
    progress = 0.0
    if todo.status == "completed":
        progress = 1.0
    elif todo.status == "in_progress":
        progress = 0.5
    
    return GanttTask(
        id=todo.id,
        text=todo.title,
        start_date=todo.planned_start.strftime("%Y-%m-%d %H:%M") if todo.planned_start else None,
        duration=duration,
        parent=todo.parent_todo_id or 0,
        type="project" if todo.todo_type.startswith("container") else "task",
        progress=progress,
        open=True,
        status=todo.status,
        resource_id=resource_id,
        resource_name=resource_name,
        has_conflict=len(todo.conflicts) > 0 if todo.conflicts else False,
        priority=todo.priority,
        delivery_date=todo.delivery_date.isoformat() if todo.delivery_date else None,
    )


def _log_audit(db: Session, todo_id: int, action: str, old_values: dict = None, new_values: dict = None, user_name: str = None):
    """Create audit log entry"""
    log = PPSAuditLog(
        todo_id=todo_id,
        action=action,
        old_values=old_values,
        new_values=new_values,
        user_name=user_name,
        created_at=datetime.utcnow(),
    )
    db.add(log)


# ============== Todo CRUD ==============

@router.get("/todos", response_model=TodoListResponse)
async def get_todos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    erp_order_id: Optional[int] = None,
    status: Optional[str] = None,  # comma-separated
    todo_type: Optional[str] = None,  # comma-separated
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    resource_id: Optional[int] = None,
    has_conflicts: Optional[bool] = None,
    parent_todo_id: Optional[int] = None,
    search: Optional[str] = None,
    current_employee_erp_id: Optional[int] = Header(None, alias="X-Employee-ERP-ID"),
    db: Session = Depends(get_db),
):
    """Get todos with filters and pagination
    
    For "eigene" (personal) todos:
    - If current_employee_erp_id is provided, "eigene" todos are filtered
    - User sees their own "eigene" todos + those from their subordinates
    - Without this header, "eigene" todos are excluded
    """
    query = db.query(PPSTodo).options(joinedload(PPSTodo.conflicts))
    
    # Filter "eigene" todos by visibility
    if current_employee_erp_id:
        # Get subordinate ERP IDs
        subordinate_erp_ids = get_subordinate_ids(current_employee_erp_id)
        all_visible_erp_ids = [current_employee_erp_id] + subordinate_erp_ids
        
        # Get resource cache IDs for these employees
        visible_resource_ids = get_employee_resource_ids_for_erp_ids(db, all_visible_erp_ids)
        
        # Filter: non-eigene OR (eigene AND creator visible)
        query = query.filter(
            or_(
                PPSTodo.todo_type != 'eigene',
                PPSTodo.creator_employee_id.in_(visible_resource_ids) if visible_resource_ids else False,
            )
        )
    else:
        # Without employee header, exclude all "eigene" todos
        query = query.filter(PPSTodo.todo_type != 'eigene')
    
    # Apply filters
    if erp_order_id is not None:
        query = query.filter(PPSTodo.erp_order_id == erp_order_id)
    
    if status:
        status_list = [s.strip() for s in status.split(",")]
        query = query.filter(PPSTodo.status.in_(status_list))
    
    if todo_type:
        type_list = [t.strip() for t in todo_type.split(",")]
        query = query.filter(PPSTodo.todo_type.in_(type_list))
    
    if date_from:
        query = query.filter(PPSTodo.planned_start >= date_from)
    
    if date_to:
        query = query.filter(PPSTodo.planned_end <= date_to)
    
    if resource_id is not None:
        query = query.filter(
            or_(
                PPSTodo.assigned_department_id == resource_id,
                PPSTodo.assigned_machine_id == resource_id,
                PPSTodo.assigned_employee_id == resource_id,
            )
        )
    
    if parent_todo_id is not None:
        query = query.filter(PPSTodo.parent_todo_id == parent_todo_id)
    elif parent_todo_id == 0:
        query = query.filter(PPSTodo.parent_todo_id.is_(None))
    
    if search:
        query = query.filter(PPSTodo.title.ilike(f"%{search}%"))
    
    # Get total before pagination
    total = query.count()
    
    # Apply pagination and ordering
    # Note: MySQL doesn't support NULLS LAST, so we use COALESCE to put NULLs at end
    todos = query.order_by(
        func.coalesce(PPSTodo.planned_start, '9999-12-31').asc(),
        PPSTodo.priority.desc(),
        PPSTodo.id.asc()
    ).offset(skip).limit(limit).all()
    
    # Filter by has_conflicts after loading (requires relationship)
    if has_conflicts is not None:
        todos = [t for t in todos if (len(t.conflicts) > 0) == has_conflicts]
    
    items = [_todo_to_response(t) for t in todos]
    
    return TodoListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/todos/{todo_id}", response_model=TodoWithDetails)
async def get_todo(todo_id: int, db: Session = Depends(get_db)):
    """Get single todo with full details"""
    todo = db.query(PPSTodo).options(
        joinedload(PPSTodo.conflicts),
        joinedload(PPSTodo.segments),
        joinedload(PPSTodo.children),
        joinedload(PPSTodo.assigned_department),
        joinedload(PPSTodo.assigned_machine),
        joinedload(PPSTodo.assigned_employee),
    ).filter(PPSTodo.id == todo_id).first()
    
    if not todo:
        raise HTTPException(status_code=404, detail="Todo nicht gefunden")
    
    return todo


@router.post("/todos", response_model=Todo)
async def create_todo(payload: TodoCreate, db: Session = Depends(get_db)):
    """Create new todo"""
    todo = PPSTodo(
        erp_order_id=payload.erp_order_id,
        erp_order_article_id=payload.erp_order_article_id,
        erp_workplan_detail_id=payload.erp_workplan_detail_id,
        parent_todo_id=payload.parent_todo_id,
        todo_type=payload.todo_type.value,
        title=payload.title,
        description=payload.description,
        quantity=payload.quantity,
        setup_time_minutes=payload.setup_time_minutes,
        run_time_minutes=payload.run_time_minutes,
        total_duration_minutes=payload.total_duration_minutes,
        is_duration_manual=payload.is_duration_manual,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        status=payload.status.value,
        block_reason=payload.block_reason,
        priority=payload.priority,
        delivery_date=payload.delivery_date,
        assigned_department_id=payload.assigned_department_id,
        assigned_machine_id=payload.assigned_machine_id,
        assigned_employee_id=payload.assigned_employee_id,
        version=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    # Calculate duration if not manual
    if not todo.is_duration_manual:
        todo.total_duration_minutes = todo.calculate_duration()
    
    # Calculate end if start and duration are set
    if todo.planned_start and todo.total_duration_minutes and not todo.planned_end:
        todo.planned_end = todo.planned_start + timedelta(minutes=todo.total_duration_minutes)
    
    db.add(todo)
    db.commit()
    db.refresh(todo)
    
    _log_audit(db, todo.id, "create", new_values={"title": todo.title, "status": todo.status})
    db.commit()
    
    return _todo_to_response(todo, include_conflicts=False)


@router.patch("/todos/{todo_id}", response_model=Todo)
async def update_todo(todo_id: int, payload: TodoUpdate, db: Session = Depends(get_db)):
    """Update todo (including drag/drop updates)"""
    todo = db.query(PPSTodo).options(joinedload(PPSTodo.conflicts)).filter(PPSTodo.id == todo_id).first()
    
    if not todo:
        raise HTTPException(status_code=404, detail="Todo nicht gefunden")
    
    # Optimistic locking check
    if payload.version is not None and payload.version != todo.version:
        raise HTTPException(
            status_code=409,
            detail=f"Konflikt: Todo wurde von anderem Benutzer geändert (Version {todo.version} != {payload.version})"
        )
    
    # Track changes for audit
    old_values = {}
    new_values = {}
    
    update_data = payload.model_dump(exclude_unset=True, exclude={"version"})
    for field, value in update_data.items():
        if field == "status" and value:
            value = value.value if hasattr(value, "value") else value
        old_val = getattr(todo, field, None)
        if old_val != value:
            old_values[field] = str(old_val) if old_val else None
            new_values[field] = str(value) if value else None
        setattr(todo, field, value)
    
    # Recalculate duration if times changed and not manual
    if not todo.is_duration_manual and ("setup_time_minutes" in update_data or "run_time_minutes" in update_data or "quantity" in update_data):
        todo.total_duration_minutes = todo.calculate_duration()
    
    # Recalculate end if start or duration changed
    if "planned_start" in update_data or "total_duration_minutes" in update_data:
        if todo.planned_start and todo.total_duration_minutes:
            todo.planned_end = todo.planned_start + timedelta(minutes=todo.total_duration_minutes)
    
    # Increment version
    todo.version += 1
    todo.updated_at = datetime.utcnow()
    
    # Create audit log
    if old_values:
        _log_audit(db, todo.id, "update", old_values=old_values, new_values=new_values)
    
    db.commit()
    db.refresh(todo)
    
    return _todo_to_response(todo)


@router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    """Delete todo"""
    todo = db.query(PPSTodo).filter(PPSTodo.id == todo_id).first()
    
    if not todo:
        raise HTTPException(status_code=404, detail="Todo nicht gefunden")
    
    # Log before delete
    _log_audit(db, todo_id, "delete", old_values={"title": todo.title, "status": todo.status})
    
    db.delete(todo)
    db.commit()
    
    return {"success": True, "deleted_id": todo_id}


@router.post("/todos/{todo_id}/split", response_model=List[TodoSegment])
async def split_todo(todo_id: int, payload: TodoSplitRequest, db: Session = Depends(get_db)):
    """Split a todo into multiple segments"""
    todo = db.query(PPSTodo).filter(PPSTodo.id == todo_id).first()
    
    if not todo:
        raise HTTPException(status_code=404, detail="Todo nicht gefunden")
    
    # Delete existing segments
    db.query(PPSTodoSegment).filter(PPSTodoSegment.todo_id == todo_id).delete()
    
    # Create new segments
    segments = []
    for i, seg_data in enumerate(payload.segments):
        segment = PPSTodoSegment(
            todo_id=todo_id,
            segment_index=i,
            start_time=seg_data.start_time,
            end_time=seg_data.end_time,
            assigned_machine_id=seg_data.assigned_machine_id,
            assigned_employee_id=seg_data.assigned_employee_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(segment)
        segments.append(segment)
    
    # Update todo start/end to match segments
    if segments:
        todo.planned_start = min(s.start_time for s in segments)
        todo.planned_end = max(s.end_time for s in segments)
    
    _log_audit(db, todo_id, "split", new_values={"segment_count": len(segments)})
    
    db.commit()
    
    return [TodoSegment.model_validate(s) for s in segments]


# ============== Gantt Data ==============

@router.get("/gantt/data", response_model=GanttData)
async def get_gantt_data(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    erp_order_id: Optional[int] = None,
    resource_ids: Optional[str] = None,  # comma-separated
    current_employee_erp_id: Optional[int] = Header(None, alias="X-Employee-ERP-ID"),
    db: Session = Depends(get_db),
):
    """Get complete Gantt data (tasks + links) in DHTMLX format
    
    For "eigene" (personal) todos:
    - If current_employee_erp_id is provided, "eigene" todos are filtered by visibility
    - Without this header, "eigene" todos are excluded from Gantt view
    """
    query = db.query(PPSTodo).options(
        joinedload(PPSTodo.conflicts),
        joinedload(PPSTodo.assigned_machine),
        joinedload(PPSTodo.assigned_employee),
        joinedload(PPSTodo.assigned_department),
    )
    
    # Filter "eigene" todos by visibility
    if current_employee_erp_id:
        subordinate_erp_ids = get_subordinate_ids(current_employee_erp_id)
        all_visible_erp_ids = [current_employee_erp_id] + subordinate_erp_ids
        visible_resource_ids = get_employee_resource_ids_for_erp_ids(db, all_visible_erp_ids)
        
        query = query.filter(
            or_(
                PPSTodo.todo_type != 'eigene',
                PPSTodo.creator_employee_id.in_(visible_resource_ids) if visible_resource_ids else False,
            )
        )
    else:
        query = query.filter(PPSTodo.todo_type != 'eigene')
    
    # Apply filters
    if date_from:
        query = query.filter(PPSTodo.planned_end >= date_from)
    if date_to:
        query = query.filter(PPSTodo.planned_start <= date_to)
    if erp_order_id:
        query = query.filter(PPSTodo.erp_order_id == erp_order_id)
    
    if resource_ids:
        ids = [int(x) for x in resource_ids.split(",")]
        # Get all todos that match the resource filter OR their parents/children match
        # First, get direct matches
        direct_matches = db.query(PPSTodo.id).filter(
            or_(
                PPSTodo.assigned_department_id.in_(ids),
                PPSTodo.assigned_machine_id.in_(ids),
                PPSTodo.assigned_employee_id.in_(ids),
            )
        ).all()
        direct_match_ids = [m[0] for m in direct_matches]
        
        # Also get parent IDs of matching todos (to include container_order)
        parent_ids = db.query(PPSTodo.parent_todo_id).filter(
            PPSTodo.id.in_(direct_match_ids),
            PPSTodo.parent_todo_id.isnot(None)
        ).all()
        parent_ids = [p[0] for p in parent_ids if p[0]]
        
        # Get grandparent IDs (container_order for container_article)
        grandparent_ids = db.query(PPSTodo.parent_todo_id).filter(
            PPSTodo.id.in_(parent_ids),
            PPSTodo.parent_todo_id.isnot(None)
        ).all()
        grandparent_ids = [g[0] for g in grandparent_ids if g[0]]
        
        # Combine all IDs
        all_ids = set(direct_match_ids + parent_ids + grandparent_ids)
        
        query = query.filter(PPSTodo.id.in_(all_ids))
    
    # Sort by priority (1=highest first), then by planned_start
    # Note: MySQL doesn't support NULLS LAST, so we use COALESCE to put NULLs at end
    todos = query.order_by(
        PPSTodo.priority.asc(),  # Priority 1 first
        func.coalesce(PPSTodo.planned_start, '9999-12-31').asc()
    ).all()
    
    # Convert to Gantt tasks
    tasks = [_todo_to_gantt_task(t) for t in todos]
    
    # Get all dependencies for these todos
    todo_ids = [t.id for t in todos]
    dependencies = db.query(PPSTodoDependency).filter(
        and_(
            PPSTodoDependency.predecessor_id.in_(todo_ids),
            PPSTodoDependency.successor_id.in_(todo_ids),
            PPSTodoDependency.is_active == True,
        )
    ).all()
    
    # Convert to Gantt links
    links = [GanttLink(**d.to_gantt_link()) for d in dependencies]
    
    return GanttData(data=tasks, links=links)


@router.post("/gantt/sync", response_model=GanttSyncResponse)
async def sync_gantt_data(payload: GanttSyncRequest, db: Session = Depends(get_db)):
    """Batch sync after Gantt drag/drop operations"""
    errors = []
    updated_count = 0
    created_count = 0
    deleted_count = 0
    created_task_ids = {}
    created_link_ids = {}
    
    # Process deleted tasks
    for task_id in payload.deleted_task_ids:
        todo = db.query(PPSTodo).filter(PPSTodo.id == task_id).first()
        if todo:
            _log_audit(db, task_id, "delete", old_values={"title": todo.title})
            db.delete(todo)
            deleted_count += 1
    
    # Process updated tasks
    for task_data in payload.updated_tasks:
        try:
            task_id = task_data.get("id")
            todo = db.query(PPSTodo).filter(PPSTodo.id == task_id).first()
            if not todo:
                errors.append(f"Todo {task_id} nicht gefunden")
                continue
            
            # Parse start_date from Gantt format
            if "start_date" in task_data and task_data["start_date"]:
                try:
                    todo.planned_start = datetime.strptime(task_data["start_date"], "%Y-%m-%d %H:%M")
                except ValueError:
                    try:
                        todo.planned_start = datetime.strptime(task_data["start_date"], "%d-%m-%Y %H:%M")
                    except ValueError:
                        pass
            
            # Duration in minutes
            if "duration" in task_data:
                todo.total_duration_minutes = int(task_data["duration"])
                todo.is_duration_manual = True
            
            # Always recalculate planned_end if we have start and duration
            if todo.planned_start and todo.total_duration_minutes:
                todo.planned_end = todo.planned_start + timedelta(minutes=todo.total_duration_minutes)
            
            # Parent
            if "parent" in task_data:
                parent_id = task_data["parent"]
                todo.parent_todo_id = parent_id if parent_id and parent_id != 0 else None
            
            # Resource
            if "resource_id" in task_data:
                res_id = task_data["resource_id"]
                if res_id:
                    resource = db.query(PPSResourceCache).filter(PPSResourceCache.id == res_id).first()
                    if resource:
                        if resource.resource_type == "machine":
                            todo.assigned_machine_id = res_id
                        elif resource.resource_type == "employee":
                            todo.assigned_employee_id = res_id
                        elif resource.resource_type == "department":
                            todo.assigned_department_id = res_id
            
            # Text/Title
            if "text" in task_data and task_data["text"]:
                todo.title = task_data["text"]
            
            # Priority
            if "priority" in task_data:
                try:
                    prio_val = task_data["priority"]
                    if prio_val is not None and prio_val != "":
                        todo.priority = int(prio_val)
                    # Empty string or None keeps existing value
                except (ValueError, TypeError):
                    pass  # Keep existing value on parse error
            
            todo.version += 1
            todo.updated_at = datetime.utcnow()
            updated_count += 1
            
        except Exception as e:
            errors.append(f"Fehler bei Task {task_data.get('id')}: {str(e)}")
    
    # Process created tasks (new tasks from Gantt)
    for task_data in payload.created_tasks:
        try:
            temp_id = task_data.get("id")  # Temporary ID from frontend
            
            todo = PPSTodo(
                title=task_data.get("text", "Neues Todo"),
                todo_type="operation",
                status="new",
                quantity=1,
                version=1,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            
            if "start_date" in task_data and task_data["start_date"]:
                try:
                    todo.planned_start = datetime.strptime(task_data["start_date"], "%Y-%m-%d %H:%M")
                except ValueError:
                    pass
            
            if "duration" in task_data:
                todo.total_duration_minutes = int(task_data["duration"])
                if todo.planned_start:
                    todo.planned_end = todo.planned_start + timedelta(minutes=todo.total_duration_minutes)
            
            if "parent" in task_data and task_data["parent"]:
                todo.parent_todo_id = int(task_data["parent"]) if task_data["parent"] != 0 else None
            
            db.add(todo)
            db.flush()  # Get the real ID
            
            created_task_ids[str(temp_id)] = todo.id
            created_count += 1
            
        except Exception as e:
            errors.append(f"Fehler bei neuem Task: {str(e)}")
    
    # Process deleted links
    for link_id in payload.deleted_link_ids:
        dep = db.query(PPSTodoDependency).filter(PPSTodoDependency.id == link_id).first()
        if dep:
            db.delete(dep)
    
    # Process created links
    for link_data in payload.created_links:
        try:
            temp_id = link_data.get("id")
            source = link_data.get("source")
            target = link_data.get("target")
            
            # Resolve temporary IDs
            if str(source) in created_task_ids:
                source = created_task_ids[str(source)]
            if str(target) in created_task_ids:
                target = created_task_ids[str(target)]
            
            dep = PPSTodoDependency(
                predecessor_id=int(source),
                successor_id=int(target),
                dependency_type="finish_to_start",
                lag_minutes=link_data.get("lag", 0),
                is_active=True,
                created_at=datetime.utcnow(),
            )
            db.add(dep)
            db.flush()
            
            created_link_ids[str(temp_id)] = dep.id
            
        except Exception as e:
            errors.append(f"Fehler bei Link: {str(e)}")
    
    db.commit()
    
    return GanttSyncResponse(
        success=len(errors) == 0,
        updated_count=updated_count,
        created_count=created_count,
        deleted_count=deleted_count,
        errors=errors,
        created_task_ids=created_task_ids,
        created_link_ids=created_link_ids,
    )


# ============== Resources ==============

@router.get("/resources", response_model=List[Resource])
async def get_resources(
    resource_type: Optional[str] = None,
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db),
):
    """Get cached resources"""
    query = db.query(PPSResourceCache)
    
    if resource_type:
        query = query.filter(PPSResourceCache.resource_type == resource_type)
    if is_active is not None:
        query = query.filter(PPSResourceCache.is_active == is_active)
    
    resources = query.order_by(
        PPSResourceCache.resource_type,
        PPSResourceCache.name
    ).all()
    
    return [Resource.model_validate(r) for r in resources]


@router.get("/resources/{resource_id}", response_model=Resource)
async def get_resource(resource_id: int, db: Session = Depends(get_db)):
    """Get single resource"""
    resource = db.query(PPSResourceCache).filter(PPSResourceCache.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Ressource nicht gefunden")
    return Resource.model_validate(resource)


@router.post("/resources/sync", response_model=ResourceSyncResponse)
async def sync_resources(payload: ResourceSyncRequest, db: Session = Depends(get_db)):
    """Sync resources from HUGWAWI"""
    # This will be implemented by the sync service
    from app.services.pps_sync_service import sync_resources_from_hugwawi
    
    try:
        result = sync_resources_from_hugwawi(db, payload.resource_types)
        return result
    except Exception as e:
        return ResourceSyncResponse(
            success=False,
            synced_count=0,
            added_count=0,
            updated_count=0,
            deactivated_count=0,
            errors=[str(e)],
        )


# ============== Dependencies ==============

@router.get("/dependencies", response_model=List[Dependency])
async def get_dependencies(
    todo_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get dependencies (optionally filtered by todo)"""
    query = db.query(PPSTodoDependency)
    
    if todo_id:
        query = query.filter(
            or_(
                PPSTodoDependency.predecessor_id == todo_id,
                PPSTodoDependency.successor_id == todo_id,
            )
        )
    
    deps = query.all()
    return [Dependency.model_validate(d) for d in deps]


@router.post("/dependencies", response_model=Dependency)
async def create_dependency(payload: DependencyCreate, db: Session = Depends(get_db)):
    """Create dependency between todos"""
    # Check if todos exist
    predecessor = db.query(PPSTodo).filter(PPSTodo.id == payload.predecessor_id).first()
    successor = db.query(PPSTodo).filter(PPSTodo.id == payload.successor_id).first()
    
    if not predecessor or not successor:
        raise HTTPException(status_code=404, detail="Todo nicht gefunden")
    
    # Check for existing dependency
    existing = db.query(PPSTodoDependency).filter(
        PPSTodoDependency.predecessor_id == payload.predecessor_id,
        PPSTodoDependency.successor_id == payload.successor_id,
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="Abhängigkeit existiert bereits")
    
    dep = PPSTodoDependency(
        predecessor_id=payload.predecessor_id,
        successor_id=payload.successor_id,
        dependency_type=payload.dependency_type.value,
        lag_minutes=payload.lag_minutes,
        is_active=payload.is_active,
        created_at=datetime.utcnow(),
    )
    
    db.add(dep)
    db.commit()
    db.refresh(dep)
    
    return Dependency.model_validate(dep)


@router.delete("/dependencies/{dependency_id}")
async def delete_dependency(dependency_id: int, db: Session = Depends(get_db)):
    """Delete dependency"""
    dep = db.query(PPSTodoDependency).filter(PPSTodoDependency.id == dependency_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Abhängigkeit nicht gefunden")
    
    db.delete(dep)
    db.commit()
    
    return {"success": True, "deleted_id": dependency_id}


# ============== Conflicts ==============

@router.get("/conflicts", response_model=ConflictListResponse)
async def get_conflicts(
    resolved: Optional[bool] = False,
    conflict_type: Optional[str] = None,
    todo_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get conflicts"""
    query = db.query(PPSConflict).options(
        joinedload(PPSConflict.todo),
        joinedload(PPSConflict.related_todo),
    )
    
    if resolved is not None:
        query = query.filter(PPSConflict.resolved == resolved)
    if conflict_type:
        query = query.filter(PPSConflict.conflict_type == conflict_type)
    if todo_id:
        query = query.filter(
            or_(
                PPSConflict.todo_id == todo_id,
                PPSConflict.related_todo_id == todo_id,
            )
        )
    
    conflicts = query.order_by(PPSConflict.created_at.desc()).all()
    
    items = []
    for c in conflicts:
        item = ConflictWithTodos(
            id=c.id,
            conflict_type=c.conflict_type,
            todo_id=c.todo_id,
            related_todo_id=c.related_todo_id,
            description=c.description,
            severity=c.severity,
            resolved=c.resolved,
            created_at=c.created_at,
            todo_title=c.todo.title if c.todo else None,
            related_todo_title=c.related_todo.title if c.related_todo else None,
        )
        items.append(item)
    
    unresolved_count = sum(1 for c in conflicts if not c.resolved)
    
    return ConflictListResponse(
        items=items,
        total=len(items),
        unresolved_count=unresolved_count,
    )


@router.post("/conflicts/check")
async def check_conflicts(db: Session = Depends(get_db)):
    """Recalculate all conflicts"""
    from app.services.pps_conflict_service import check_all_conflicts
    
    try:
        result = check_all_conflicts(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler bei Konfliktprüfung: {str(e)}")


@router.patch("/conflicts/{conflict_id}/resolve")
async def resolve_conflict(conflict_id: int, db: Session = Depends(get_db)):
    """Mark conflict as resolved"""
    conflict = db.query(PPSConflict).filter(PPSConflict.id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Konflikt nicht gefunden")
    
    conflict.resolved = True
    db.commit()
    
    return {"success": True, "conflict_id": conflict_id}


# ============== Todo Generation ==============

@router.get("/orders/available", response_model=List[AvailableOrder])
async def get_available_orders(
    search: Optional[str] = None,
    has_todos: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """Get orders available for todo generation"""
    from app.services.pps_service import get_available_orders_for_todos
    
    try:
        orders = get_available_orders_for_todos(db, search, has_todos)
        return orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Laden der Aufträge: {str(e)}")


@router.post("/generate-todos", response_model=GenerateTodosResponse)
async def generate_todos(payload: GenerateTodosRequest, db: Session = Depends(get_db)):
    """Generate todos from ERP order"""
    from app.services.pps_service import generate_todos_from_order
    
    try:
        result = generate_todos_from_order(
            db,
            payload.erp_order_id,
            payload.erp_order_article_ids,
            payload.include_workplan,
        )
        return result
    except Exception as e:
        return GenerateTodosResponse(
            success=False,
            created_todos=0,
            created_dependencies=0,
            errors=[str(e)],
        )


# ============== Audit Log ==============

@router.get("/audit-log", response_model=List[dict])
async def get_audit_log(
    todo_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get audit log entries"""
    query = db.query(PPSAuditLog)
    
    if todo_id:
        query = query.filter(PPSAuditLog.todo_id == todo_id)
    if action:
        query = query.filter(PPSAuditLog.action == action)
    
    entries = query.order_by(PPSAuditLog.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": e.id,
            "todo_id": e.todo_id,
            "user_name": e.user_name,
            "action": e.action,
            "old_values": e.old_values,
            "new_values": e.new_values,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]
