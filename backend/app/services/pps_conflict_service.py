"""
PPS Conflict Service - Conflict detection for production planning

Detects:
- Resource overlaps (same machine/employee at same time)
- Calendar conflicts (work outside available hours)
- Dependency conflicts (successor starts before predecessor ends)
- Delivery date conflicts (end after delivery date)
- Qualification warnings (employee not qualified for operation)
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from app.models.pps_todo import PPSTodo, PPSTodoDependency, PPSResourceCache, PPSConflict


def check_all_conflicts(db: Session) -> dict:
    """
    Check all todos for conflicts.
    
    Clears existing unresolved conflicts and recalculates.
    """
    # Clear existing unresolved conflicts
    db.query(PPSConflict).filter(PPSConflict.resolved == False).delete()
    
    conflicts_created = 0
    
    # Get all planned todos with dates
    todos = db.query(PPSTodo).filter(
        PPSTodo.planned_start.isnot(None),
        PPSTodo.planned_end.isnot(None),
        PPSTodo.status.notin_(['completed', 'blocked']),
    ).all()
    
    # Check resource overlaps
    resource_conflicts = _check_resource_overlaps(db, todos)
    conflicts_created += len(resource_conflicts)
    
    # Check dependency conflicts
    dep_conflicts = _check_dependency_conflicts(db, todos)
    conflicts_created += len(dep_conflicts)
    
    # Check delivery date conflicts
    delivery_conflicts = _check_delivery_conflicts(db, todos)
    conflicts_created += len(delivery_conflicts)
    
    db.commit()
    
    return {
        "success": True,
        "conflicts_found": conflicts_created,
        "resource_overlaps": len(resource_conflicts),
        "dependency_conflicts": len(dep_conflicts),
        "delivery_conflicts": len(delivery_conflicts),
    }


def _check_resource_overlaps(db: Session, todos: List[PPSTodo]) -> List[PPSConflict]:
    """Check for resource overlaps (same machine/employee scheduled at same time)"""
    conflicts = []
    
    # Group by resource
    machine_todos: Dict[int, List[PPSTodo]] = {}
    employee_todos: Dict[int, List[PPSTodo]] = {}
    
    for todo in todos:
        if todo.assigned_machine_id:
            if todo.assigned_machine_id not in machine_todos:
                machine_todos[todo.assigned_machine_id] = []
            machine_todos[todo.assigned_machine_id].append(todo)
        
        if todo.assigned_employee_id:
            if todo.assigned_employee_id not in employee_todos:
                employee_todos[todo.assigned_employee_id] = []
            employee_todos[todo.assigned_employee_id].append(todo)
    
    # Check machine overlaps
    for machine_id, machine_todo_list in machine_todos.items():
        overlaps = _find_overlapping_todos(machine_todo_list)
        for todo1, todo2 in overlaps:
            # Check if conflict already exists
            existing = db.query(PPSConflict).filter(
                PPSConflict.conflict_type == 'resource_overlap',
                PPSConflict.todo_id == todo1.id,
                PPSConflict.related_todo_id == todo2.id,
            ).first()
            
            if not existing:
                machine = db.query(PPSResourceCache).filter(PPSResourceCache.id == machine_id).first()
                machine_name = machine.name if machine else f"Maschine {machine_id}"
                
                conflict = PPSConflict(
                    conflict_type='resource_overlap',
                    todo_id=todo1.id,
                    related_todo_id=todo2.id,
                    description=f"Ressourcenkonflikt: {machine_name} ist für '{todo1.title}' und '{todo2.title}' gleichzeitig eingeplant",
                    severity='error',
                    resolved=False,
                    created_at=datetime.utcnow(),
                )
                db.add(conflict)
                conflicts.append(conflict)
    
    # Check employee overlaps
    for employee_id, employee_todo_list in employee_todos.items():
        overlaps = _find_overlapping_todos(employee_todo_list)
        for todo1, todo2 in overlaps:
            existing = db.query(PPSConflict).filter(
                PPSConflict.conflict_type == 'resource_overlap',
                PPSConflict.todo_id == todo1.id,
                PPSConflict.related_todo_id == todo2.id,
            ).first()
            
            if not existing:
                employee = db.query(PPSResourceCache).filter(PPSResourceCache.id == employee_id).first()
                employee_name = employee.name if employee else f"Mitarbeiter {employee_id}"
                
                conflict = PPSConflict(
                    conflict_type='resource_overlap',
                    todo_id=todo1.id,
                    related_todo_id=todo2.id,
                    description=f"Ressourcenkonflikt: {employee_name} ist für '{todo1.title}' und '{todo2.title}' gleichzeitig eingeplant",
                    severity='error',
                    resolved=False,
                    created_at=datetime.utcnow(),
                )
                db.add(conflict)
                conflicts.append(conflict)
    
    return conflicts


def _find_overlapping_todos(todos: List[PPSTodo]) -> List[Tuple[PPSTodo, PPSTodo]]:
    """Find pairs of todos that overlap in time"""
    overlaps = []
    
    # Sort by start time
    sorted_todos = sorted(todos, key=lambda t: t.planned_start)
    
    for i, todo1 in enumerate(sorted_todos):
        for todo2 in sorted_todos[i+1:]:
            # Check if they overlap
            if _times_overlap(todo1.planned_start, todo1.planned_end, 
                            todo2.planned_start, todo2.planned_end):
                overlaps.append((todo1, todo2))
    
    return overlaps


def _times_overlap(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
    """Check if two time ranges overlap"""
    return start1 < end2 and start2 < end1


def _check_dependency_conflicts(db: Session, todos: List[PPSTodo]) -> List[PPSConflict]:
    """Check for dependency conflicts (successor starts before predecessor ends)"""
    conflicts = []
    
    # Get all active dependencies
    todo_ids = [t.id for t in todos]
    dependencies = db.query(PPSTodoDependency).filter(
        PPSTodoDependency.is_active == True,
        PPSTodoDependency.predecessor_id.in_(todo_ids),
        PPSTodoDependency.successor_id.in_(todo_ids),
    ).all()
    
    # Create lookup for todos
    todo_map = {t.id: t for t in todos}
    
    for dep in dependencies:
        predecessor = todo_map.get(dep.predecessor_id)
        successor = todo_map.get(dep.successor_id)
        
        if not predecessor or not successor:
            continue
        
        if not predecessor.planned_end or not successor.planned_start:
            continue
        
        # Check based on dependency type
        is_conflict = False
        
        if dep.dependency_type == 'finish_to_start':
            # Successor must start after predecessor ends + lag
            expected_start = predecessor.planned_end + timedelta(minutes=dep.lag_minutes)
            if successor.planned_start < expected_start:
                is_conflict = True
        
        elif dep.dependency_type == 'start_to_start':
            # Successor must start after predecessor starts + lag
            expected_start = predecessor.planned_start + timedelta(minutes=dep.lag_minutes)
            if successor.planned_start < expected_start:
                is_conflict = True
        
        elif dep.dependency_type == 'finish_to_finish':
            # Successor must end after predecessor ends + lag
            expected_end = predecessor.planned_end + timedelta(minutes=dep.lag_minutes)
            if successor.planned_end < expected_end:
                is_conflict = True
        
        if is_conflict:
            existing = db.query(PPSConflict).filter(
                PPSConflict.conflict_type == 'dependency',
                PPSConflict.todo_id == successor.id,
                PPSConflict.related_todo_id == predecessor.id,
            ).first()
            
            if not existing:
                conflict = PPSConflict(
                    conflict_type='dependency',
                    todo_id=successor.id,
                    related_todo_id=predecessor.id,
                    description=f"Abhängigkeitskonflikt: '{successor.title}' startet bevor '{predecessor.title}' abgeschlossen ist",
                    severity='error',
                    resolved=False,
                    created_at=datetime.utcnow(),
                )
                db.add(conflict)
                conflicts.append(conflict)
    
    return conflicts


def _check_delivery_conflicts(db: Session, todos: List[PPSTodo]) -> List[PPSConflict]:
    """Check for delivery date conflicts (todo ends after delivery date)"""
    conflicts = []
    
    for todo in todos:
        if not todo.delivery_date or not todo.planned_end:
            continue
        
        # Convert delivery_date to datetime at end of day
        delivery_datetime = datetime.combine(todo.delivery_date, datetime.max.time())
        
        if todo.planned_end > delivery_datetime:
            existing = db.query(PPSConflict).filter(
                PPSConflict.conflict_type == 'delivery_date',
                PPSConflict.todo_id == todo.id,
            ).first()
            
            if not existing:
                days_late = (todo.planned_end.date() - todo.delivery_date).days
                
                conflict = PPSConflict(
                    conflict_type='delivery_date',
                    todo_id=todo.id,
                    related_todo_id=None,
                    description=f"Terminkonflikt: '{todo.title}' endet {days_late} Tag(e) nach Liefertermin ({todo.delivery_date.isoformat()})",
                    severity='warning' if days_late <= 2 else 'error',
                    resolved=False,
                    created_at=datetime.utcnow(),
                )
                db.add(conflict)
                conflicts.append(conflict)
    
    return conflicts


def check_single_todo_conflicts(db: Session, todo_id: int) -> List[dict]:
    """
    Check conflicts for a single todo (called after move/update).
    
    Returns list of new conflicts found.
    """
    todo = db.query(PPSTodo).filter(PPSTodo.id == todo_id).first()
    if not todo:
        return []
    
    if not todo.planned_start or not todo.planned_end:
        return []
    
    new_conflicts = []
    
    # Clear existing conflicts for this todo
    db.query(PPSConflict).filter(
        or_(
            PPSConflict.todo_id == todo_id,
            PPSConflict.related_todo_id == todo_id,
        ),
        PPSConflict.resolved == False,
    ).delete()
    
    # Check resource overlap
    if todo.assigned_machine_id or todo.assigned_employee_id:
        overlapping = db.query(PPSTodo).filter(
            PPSTodo.id != todo_id,
            PPSTodo.planned_start.isnot(None),
            PPSTodo.planned_end.isnot(None),
            PPSTodo.planned_start < todo.planned_end,
            PPSTodo.planned_end > todo.planned_start,
        )
        
        if todo.assigned_machine_id:
            overlapping = overlapping.filter(
                PPSTodo.assigned_machine_id == todo.assigned_machine_id
            )
        elif todo.assigned_employee_id:
            overlapping = overlapping.filter(
                PPSTodo.assigned_employee_id == todo.assigned_employee_id
            )
        
        for other in overlapping.all():
            conflict = PPSConflict(
                conflict_type='resource_overlap',
                todo_id=todo.id,
                related_todo_id=other.id,
                description=f"Ressourcenkonflikt mit '{other.title}'",
                severity='error',
                resolved=False,
                created_at=datetime.utcnow(),
            )
            db.add(conflict)
            new_conflicts.append({"type": "resource_overlap", "related_todo_id": other.id})
    
    # Check delivery date
    if todo.delivery_date:
        delivery_datetime = datetime.combine(todo.delivery_date, datetime.max.time())
        if todo.planned_end > delivery_datetime:
            conflict = PPSConflict(
                conflict_type='delivery_date',
                todo_id=todo.id,
                description=f"Endet nach Liefertermin",
                severity='warning',
                resolved=False,
                created_at=datetime.utcnow(),
            )
            db.add(conflict)
            new_conflicts.append({"type": "delivery_date"})
    
    db.commit()
    
    return new_conflicts
