"""
PPS Sync Service - Synchronization with HUGWAWI

Handles:
- Resource sync (departments, machines, employees)
- Time tracking sync (IST-Rückmeldung)
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.models.pps_todo import PPSTodo, PPSResourceCache
from app.schemas.pps import ResourceSyncResponse, ResourceType, TodoStatus
from app.core.database import get_erp_db_connection


def sync_resources_from_hugwawi(
    db: Session,
    resource_types: Optional[List[ResourceType]] = None,
) -> ResourceSyncResponse:
    """
    Sync resources (departments, machines, employees) from HUGWAWI.
    
    - Adds new resources
    - Updates existing resources
    - Deactivates removed resources
    """
    erp_conn = None
    added_count = 0
    updated_count = 0
    deactivated_count = 0
    synced_count = 0
    errors = []
    
    # Default to all types
    if not resource_types:
        resource_types = [ResourceType.DEPARTMENT, ResourceType.MACHINE, ResourceType.EMPLOYEE]
    
    try:
        erp_conn = get_erp_db_connection()
        cursor = erp_conn.cursor(dictionary=True)
        
        # Sync departments
        if ResourceType.DEPARTMENT in resource_types:
            result = _sync_departments(db, cursor)
            added_count += result['added']
            updated_count += result['updated']
            deactivated_count += result['deactivated']
            synced_count += result['synced']
        
        # Sync machines (qualificationitem)
        if ResourceType.MACHINE in resource_types:
            result = _sync_machines(db, cursor)
            added_count += result['added']
            updated_count += result['updated']
            deactivated_count += result['deactivated']
            synced_count += result['synced']
        
        # Sync employees
        if ResourceType.EMPLOYEE in resource_types:
            result = _sync_employees(db, cursor)
            added_count += result['added']
            updated_count += result['updated']
            deactivated_count += result['deactivated']
            synced_count += result['synced']
        
        cursor.close()
        db.commit()
        
        return ResourceSyncResponse(
            success=True,
            synced_count=synced_count,
            added_count=added_count,
            updated_count=updated_count,
            deactivated_count=deactivated_count,
            errors=errors,
        )
        
    except Exception as e:
        db.rollback()
        return ResourceSyncResponse(
            success=False,
            synced_count=0,
            added_count=0,
            updated_count=0,
            deactivated_count=0,
            errors=[str(e)],
        )
    finally:
        if erp_conn:
            erp_conn.close()


def _sync_departments(db: Session, cursor) -> dict:
    """Sync departments from HUGWAWI"""
    added = 0
    updated = 0
    deactivated = 0
    
    # Query departments (simple query - HUGWAWI department table has no deleted column)
    cursor.execute("""
        SELECT id, name 
        FROM department 
        ORDER BY name
    """)
    
    erp_ids = set()
    for row in cursor.fetchall():
        erp_id = row['id']
        name = row['name']
        erp_ids.add(erp_id)
        
        # Find existing
        existing = db.query(PPSResourceCache).filter(
            PPSResourceCache.resource_type == 'department',
            PPSResourceCache.erp_id == erp_id,
        ).first()
        
        if existing:
            if existing.name != name or not existing.is_active:
                existing.name = name
                existing.is_active = True
                existing.last_sync_at = datetime.utcnow()
                existing.updated_at = datetime.utcnow()
                updated += 1
        else:
            resource = PPSResourceCache(
                resource_type='department',
                erp_id=erp_id,
                name=name,
                capacity=10,  # Pool capacity
                is_active=True,
                last_sync_at=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(resource)
            added += 1
    
    # Deactivate removed departments
    removed = db.query(PPSResourceCache).filter(
        PPSResourceCache.resource_type == 'department',
        PPSResourceCache.erp_id.notin_(erp_ids),
        PPSResourceCache.is_active == True,
    ).all()
    
    for r in removed:
        r.is_active = False
        r.updated_at = datetime.utcnow()
        deactivated += 1
    
    return {'added': added, 'updated': updated, 'deactivated': deactivated, 'synced': len(erp_ids)}


def _sync_machines(db: Session, cursor) -> dict:
    """Sync machines (qualificationitem) from HUGWAWI"""
    added = 0
    updated = 0
    deactivated = 0
    
    # Query machines
    cursor.execute("""
        SELECT id, name, description 
        FROM qualificationitem 
        ORDER BY name
    """)
    
    erp_ids = set()
    for row in cursor.fetchall():
        erp_id = row['id']
        name = row['name']
        erp_ids.add(erp_id)
        
        existing = db.query(PPSResourceCache).filter(
            PPSResourceCache.resource_type == 'machine',
            PPSResourceCache.erp_id == erp_id,
        ).first()
        
        if existing:
            if existing.name != name or not existing.is_active:
                existing.name = name
                existing.is_active = True
                existing.last_sync_at = datetime.utcnow()
                existing.updated_at = datetime.utcnow()
                updated += 1
        else:
            resource = PPSResourceCache(
                resource_type='machine',
                erp_id=erp_id,
                name=name,
                capacity=1,  # Single machine
                is_active=True,
                last_sync_at=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(resource)
            added += 1
    
    # Deactivate removed machines
    removed = db.query(PPSResourceCache).filter(
        PPSResourceCache.resource_type == 'machine',
        PPSResourceCache.erp_id.notin_(erp_ids),
        PPSResourceCache.is_active == True,
    ).all()
    
    for r in removed:
        r.is_active = False
        r.updated_at = datetime.utcnow()
        deactivated += 1
    
    return {'added': added, 'updated': updated, 'deactivated': deactivated, 'synced': len(erp_ids)}


def _sync_employees(db: Session, cursor) -> dict:
    """Sync employees from HUGWAWI userlogin"""
    added = 0
    updated = 0
    deactivated = 0
    
    # Query active employees
    cursor.execute("""
        SELECT id, loginname, Vorname, Nachname 
        FROM userlogin 
        WHERE (blocked = 0 OR blocked IS NULL)
        ORDER BY Nachname, Vorname
    """)
    
    erp_ids = set()
    for row in cursor.fetchall():
        erp_id = row['id']
        vorname = row['Vorname'] or ''
        nachname = row['Nachname'] or ''
        loginname = row['loginname'] or ''
        
        # Build display name
        if vorname and nachname:
            name = f"{nachname}, {vorname}"
        elif nachname:
            name = nachname
        elif vorname:
            name = vorname
        else:
            name = loginname
        
        erp_ids.add(erp_id)
        
        existing = db.query(PPSResourceCache).filter(
            PPSResourceCache.resource_type == 'employee',
            PPSResourceCache.erp_id == erp_id,
        ).first()
        
        if existing:
            if existing.name != name or not existing.is_active:
                existing.name = name
                existing.is_active = True
                existing.last_sync_at = datetime.utcnow()
                existing.updated_at = datetime.utcnow()
                updated += 1
        else:
            resource = PPSResourceCache(
                resource_type='employee',
                erp_id=erp_id,
                name=name,
                capacity=1,  # Single person
                is_active=True,
                last_sync_at=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(resource)
            added += 1
    
    # Deactivate removed/blocked employees
    removed = db.query(PPSResourceCache).filter(
        PPSResourceCache.resource_type == 'employee',
        PPSResourceCache.erp_id.notin_(erp_ids),
        PPSResourceCache.is_active == True,
    ).all()
    
    for r in removed:
        r.is_active = False
        r.updated_at = datetime.utcnow()
        deactivated += 1
    
    return {'added': added, 'updated': updated, 'deactivated': deactivated, 'synced': len(erp_ids)}


def sync_time_tracking(db: Session) -> dict:
    """
    Sync time tracking data from HUGWAWI to update todo status.
    
    Maps HUGWAWI time bookings (Zeitbuchungen) to todos and updates
    actual_start, actual_end, and status.
    """
    erp_conn = None
    updated_count = 0
    errors = []
    
    try:
        erp_conn = get_erp_db_connection()
        cursor = erp_conn.cursor(dictionary=True)
        
        # Get todos that need status updates
        todos_with_workplan = db.query(PPSTodo).filter(
            PPSTodo.erp_workplan_detail_id.isnot(None),
            PPSTodo.status.in_(['new', 'planned', 'in_progress']),
        ).all()
        
        for todo in todos_with_workplan:
            # Query time bookings for this workplan detail
            # Note: This query depends on HUGWAWI's time tracking schema
            # Adjust based on actual table structure
            cursor.execute("""
                SELECT 
                    MIN(startTime) as first_start,
                    MAX(endTime) as last_end,
                    SUM(TIMESTAMPDIFF(MINUTE, startTime, endTime)) as total_minutes,
                    COUNT(*) as booking_count,
                    MAX(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as is_completed
                FROM time_booking
                WHERE workplan_detail_id = %s
                  AND startTime IS NOT NULL
            """, (todo.erp_workplan_detail_id,))
            
            row = cursor.fetchone()
            
            if row and row['booking_count'] and row['booking_count'] > 0:
                # Update actual times
                if row['first_start']:
                    todo.actual_start = row['first_start']
                if row['last_end']:
                    todo.actual_end = row['last_end']
                
                # Update status based on bookings
                if row['is_completed']:
                    todo.status = 'completed'
                elif row['first_start']:
                    todo.status = 'in_progress'
                
                todo.updated_at = datetime.utcnow()
                updated_count += 1
        
        cursor.close()
        db.commit()
        
        return {
            "success": True,
            "updated_count": updated_count,
            "errors": errors,
        }
        
    except Exception as e:
        db.rollback()
        # Time booking table might not exist or have different schema
        # This is expected in some installations
        return {
            "success": False,
            "updated_count": 0,
            "errors": [f"Zeitbuchungen konnten nicht synchronisiert werden: {str(e)}"],
        }
    finally:
        if erp_conn:
            erp_conn.close()
