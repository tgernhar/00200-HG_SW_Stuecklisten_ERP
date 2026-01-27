"""
PPS Service - Main business logic for production planning

Handles:
- Todo generation from ERP orders
- Available orders query
- Todo operations
- ERP name resolution for todos
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from app.models.pps_todo import PPSTodo, PPSTodoDependency, PPSResourceCache
from app.schemas.pps import (
    GenerateTodosResponse, AvailableOrder, TodoType, TodoStatus, TodoWithERPDetails
)
from app.core.database import get_erp_db_connection


def round_to_15_minutes(minutes: float) -> int:
    """
    Round duration to 15-minute intervals (REQ-TODO-010, REQ-CAL-001).
    
    Uses standard rounding with 7.5-minute threshold:
    - < 7.5 minutes remainder -> round down
    - >= 7.5 minutes remainder -> round up
    
    Args:
        minutes: Duration in minutes (can be float)
    
    Returns:
        Rounded duration in minutes (always multiple of 15, minimum 15)
    
    Examples:
        0-7.4 minutes -> 15 minutes (minimum)
        7.5-22.4 minutes -> 15 minutes
        22.5-37.4 minutes -> 30 minutes
        37.5-52.4 minutes -> 45 minutes
        67 minutes -> 60 minutes (67 % 15 = 7 < 7.5, round down)
        68 minutes -> 75 minutes (68 % 15 = 8 >= 7.5, round up)
    """
    if minutes <= 0:
        return 15  # Minimum 15 minutes
    
    # Standard rounding: < 7.5 remainder -> down, >= 7.5 remainder -> up
    rounded = int(round(minutes / 15) * 15)
    
    # Ensure minimum of 15 minutes
    return max(15, rounded)


def resolve_erp_details_for_todos(todos: List[PPSTodo]) -> List[Dict[str, Any]]:
    """
    Resolve ERP names for a list of todos by querying HUGWAWI.
    
    Returns todo data enriched with:
    - order_name (from ordertable.name)
    - order_article_number (from article.articlenumber via order_article)
    - order_article_path (from article.customtext7 via order_article)
    - bom_article_number (from article.articlenumber via packingnote_details)
    - bom_article_path (from article.customtext7 via packingnote_details)
    - workstep_name (from qualificationitem.name via workplan_details)
    """
    if not todos:
        return []
    
    # Collect unique IDs to look up
    order_ids = set()
    order_article_ids = set()
    packingnote_details_ids = set()
    workplan_detail_ids = set()
    
    for todo in todos:
        if todo.erp_order_id:
            order_ids.add(todo.erp_order_id)
        if todo.erp_order_article_id:
            order_article_ids.add(todo.erp_order_article_id)
        if todo.erp_packingnote_details_id:
            packingnote_details_ids.add(todo.erp_packingnote_details_id)
        if todo.erp_workplan_detail_id:
            workplan_detail_ids.add(todo.erp_workplan_detail_id)
    
    # Query HUGWAWI for names and paths
    order_names: Dict[int, str] = {}
    order_article_numbers: Dict[int, str] = {}
    order_article_paths: Dict[int, str] = {}
    bom_article_numbers: Dict[int, str] = {}
    bom_article_paths: Dict[int, str] = {}
    workstep_names: Dict[int, str] = {}
    
    erp_conn = None
    try:
        erp_conn = get_erp_db_connection()
        cursor = erp_conn.cursor(dictionary=True)
        
        # Get order names
        if order_ids:
            placeholders = ','.join(['%s'] * len(order_ids))
            cursor.execute(f"""
                SELECT id, name FROM ordertable WHERE id IN ({placeholders})
            """, tuple(order_ids))
            for row in cursor.fetchall():
                order_names[row['id']] = row['name']
        
        # Get order article numbers and folder paths (via article table)
        if order_article_ids:
            placeholders = ','.join(['%s'] * len(order_article_ids))
            cursor.execute(f"""
                SELECT oa.id, art.articlenumber, art.customtext7 as folder_path
                FROM order_article oa
                JOIN article art ON oa.articleid = art.id
                WHERE oa.id IN ({placeholders})
            """, tuple(order_article_ids))
            for row in cursor.fetchall():
                order_article_numbers[row['id']] = row['articlenumber']
                if row['folder_path']:
                    order_article_paths[row['id']] = row['folder_path']
        
        # Get BOM article numbers and folder paths (via packingnote_details -> article)
        if packingnote_details_ids:
            placeholders = ','.join(['%s'] * len(packingnote_details_ids))
            cursor.execute(f"""
                SELECT pd.id, art.articlenumber, art.customtext7 as folder_path
                FROM packingnote_details pd
                LEFT JOIN article art ON art.id = pd.article
                WHERE pd.id IN ({placeholders})
            """, tuple(packingnote_details_ids))
            for row in cursor.fetchall():
                if row['articlenumber']:
                    bom_article_numbers[row['id']] = row['articlenumber']
                if row['folder_path']:
                    bom_article_paths[row['id']] = row['folder_path']
        
        # Get workstep names (via workplan_details -> qualificationitem)
        if workplan_detail_ids:
            placeholders = ','.join(['%s'] * len(workplan_detail_ids))
            cursor.execute(f"""
                SELECT wpd.id, qi.name as workstep_name
                FROM workplan_details wpd
                LEFT JOIN qualificationitem qi ON qi.id = wpd.qualificationitem
                WHERE wpd.id IN ({placeholders})
            """, tuple(workplan_detail_ids))
            for row in cursor.fetchall():
                if row['workstep_name']:
                    workstep_names[row['id']] = row['workstep_name']
        
        cursor.close()
        
    except Exception as e:
        # Log error but continue - we'll return todos without enriched names
        print(f"Error resolving ERP details: {e}")
    finally:
        if erp_conn:
            erp_conn.close()
    
    # Build enriched todo list
    result = []
    for todo in todos:
        todo_dict = {
            'id': todo.id,
            'todo_type': todo.todo_type,
            'title': todo.title,
            'description': todo.description,
            'quantity': todo.quantity,
            'setup_time_minutes': todo.setup_time_minutes,
            'run_time_minutes': todo.run_time_minutes,
            'total_duration_minutes': todo.total_duration_minutes,
            'is_duration_manual': todo.is_duration_manual,
            'planned_start': todo.planned_start,
            'planned_end': todo.planned_end,
            'actual_start': todo.actual_start,
            'actual_end': todo.actual_end,
            'status': todo.status,
            'block_reason': todo.block_reason,
            'priority': todo.priority,
            'delivery_date': todo.delivery_date,
            'erp_order_id': todo.erp_order_id,
            'erp_order_article_id': todo.erp_order_article_id,
            'erp_packingnote_details_id': todo.erp_packingnote_details_id,
            'erp_workplan_detail_id': todo.erp_workplan_detail_id,
            'parent_todo_id': todo.parent_todo_id,
            'assigned_department_id': todo.assigned_department_id,
            'assigned_machine_id': todo.assigned_machine_id,
            'assigned_employee_id': todo.assigned_employee_id,
            'creator_employee_id': todo.creator_employee_id,
            'version': todo.version,
            'created_at': todo.created_at,
            'updated_at': todo.updated_at,
            'has_conflicts': len(todo.conflicts) > 0 if todo.conflicts else False,
            'conflict_count': len(todo.conflicts) if todo.conflicts else 0,
            # ERP resolved names
            'order_name': order_names.get(todo.erp_order_id) if todo.erp_order_id else None,
            'order_article_number': order_article_numbers.get(todo.erp_order_article_id) if todo.erp_order_article_id else None,
            'order_article_path': order_article_paths.get(todo.erp_order_article_id) if todo.erp_order_article_id else None,
            'bom_article_number': bom_article_numbers.get(todo.erp_packingnote_details_id) if todo.erp_packingnote_details_id else None,
            'bom_article_path': bom_article_paths.get(todo.erp_packingnote_details_id) if todo.erp_packingnote_details_id else None,
            'workstep_name': workstep_names.get(todo.erp_workplan_detail_id) if todo.erp_workplan_detail_id else None,
        }
        result.append(todo_dict)
    
    return result


def get_available_orders_for_todos(
    db: Session,
    search: Optional[str] = None,
    has_todos: Optional[bool] = None,
) -> List[AvailableOrder]:
    """
    Get orders from HUGWAWI that can be used for todo generation.
    
    Returns orders with article count and todo status.
    """
    erp_conn = None
    try:
        erp_conn = get_erp_db_connection()
        cursor = erp_conn.cursor(dictionary=True)
        
        # Query orders from HUGWAWI
        query = """
            SELECT 
                o.id as order_id,
                o.name as order_name,
                a.suchname as customer,
                o.date2 as delivery_date,
                COUNT(DISTINCT oar.orderArticleId) as article_count
            FROM ordertable o
            LEFT JOIN adrbase a ON a.id = o.kid
            LEFT JOIN order_article_ref oar ON oar.orderid = o.id
            LEFT JOIN order_type ot ON ot.id = o.orderType
            WHERE ot.name = 'ORDER'
              AND o.status IN (1, 3, 4, 14, 15, 16, 26, 33, 37)
              AND o.created > '2024-01-01'
        """
        
        params = []
        if search:
            query += " AND (o.name LIKE %s OR a.suchname LIKE %s)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        query += " GROUP BY o.id, o.name, a.suchname, o.date2"
        query += " ORDER BY o.date2 ASC, o.name ASC"
        query += " LIMIT 200"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        cursor.close()
        
        # Get existing todos count per order
        todo_counts = {}
        existing_todos = db.query(
            PPSTodo.erp_order_id,
            func.count(PPSTodo.id).label('count')
        ).filter(
            PPSTodo.erp_order_id.isnot(None)
        ).group_by(PPSTodo.erp_order_id).all()
        
        for order_id, count in existing_todos:
            todo_counts[order_id] = count
        
        # Build result
        orders = []
        for row in rows:
            order_id = row['order_id']
            todo_count = todo_counts.get(order_id, 0)
            order_has_todos = todo_count > 0
            
            # Filter by has_todos if specified
            if has_todos is not None:
                if has_todos != order_has_todos:
                    continue
            
            orders.append(AvailableOrder(
                order_id=order_id,
                order_name=row['order_name'] or '',
                customer=row['customer'],
                delivery_date=row['delivery_date'],
                article_count=row['article_count'] or 0,
                has_todos=order_has_todos,
                todo_count=todo_count,
            ))
        
        return orders
        
    except Exception as e:
        raise Exception(f"Fehler beim Laden der Aufträge aus HUGWAWI: {str(e)}")
    finally:
        if erp_conn:
            erp_conn.close()


def _update_container_durations(db: Session, container_id: int) -> int:
    """
    Recursively update container todo durations from their children.
    
    Container-Todos (order, article) get their duration as the sum of children.
    Returns the total duration for this container.
    """
    container = db.query(PPSTodo).filter(PPSTodo.id == container_id).first()
    if not container:
        return 0
    
    # Get all direct children
    children = db.query(PPSTodo).filter(PPSTodo.parent_todo_id == container_id).all()
    
    if not children:
        # No children - keep existing duration or set default
        return container.total_duration_minutes or 5
    
    total_duration = 0
    for child in children:
        if child.todo_type.startswith('container'):
            # Recursively process child containers
            child_duration = _update_container_durations(db, child.id)
        else:
            # Operation - use its duration
            child_duration = child.total_duration_minutes or 5
        total_duration += child_duration
    
    # Update container duration if not manually set
    if container.todo_type.startswith('container') and not container.is_duration_manual:
        container.total_duration_minutes = total_duration or 5
        container.updated_at = datetime.utcnow()
    
    return total_duration


def generate_todos_from_order(
    db: Session,
    erp_order_id: int,
    erp_order_article_ids: Optional[List[int]] = None,
    include_workplan: bool = False,
    include_bom_items: bool = False,
    workplan_level: int = 1,
) -> GenerateTodosResponse:
    """
    Generate todos from an ERP order.
    
    Creates:
    1. Order todo (type 'task')
    2. Order article todos (type 'task') for each article
    3. BOM item todos (if include_bom_items=True) - parallel start
    4. Operation todos from workplan (if include_workplan=True) - sequential start
    5. Dependencies based on workplan sequence
    
    IMPORTANT: Duration is ALWAYS calculated from workplans, even if include_workplan=False.
    The include_workplan flag only controls whether operation todos are created.
    """
    erp_conn = None
    created_todos = 0
    created_dependencies = 0
    errors = []
    order_name = None
    
    try:
        erp_conn = get_erp_db_connection()
        cursor = erp_conn.cursor(dictionary=True)
        
        # 1. Get order info
        cursor.execute("""
            SELECT o.id, o.name, o.date2 as delivery_date, a.suchname as customer
            FROM ordertable o
            LEFT JOIN adrbase a ON a.id = o.kid
            WHERE o.id = %s
        """, (erp_order_id,))
        
        order_row = cursor.fetchone()
        if not order_row:
            return GenerateTodosResponse(
                success=False,
                created_todos=0,
                created_dependencies=0,
                errors=["Auftrag nicht gefunden"],
            )
        
        order_name = order_row['name']
        delivery_date = order_row['delivery_date']
        customer = order_row['customer'] or ''
        order_start = datetime.now().replace(second=0, microsecond=0)
        
        # 2. Get order articles (including department from article)
        article_query = """
            SELECT 
                oa.id as order_article_id,
                oa.position,
                oa.packingnoteid,
                art.articlenumber,
                art.description,
                art.department as department_id,
                art.customtext7 as folder_path,
                COALESCE(oar.batchsize, 1) as quantity
            FROM order_article_ref oar
            JOIN order_article oa ON oar.orderArticleId = oa.id
            JOIN article art ON oa.articleid = art.id
            WHERE oar.orderid = %s
        """
        
        params = [erp_order_id]
        if erp_order_article_ids:
            placeholders = ','.join(['%s'] * len(erp_order_article_ids))
            article_query += f" AND oa.id IN ({placeholders})"
            params.extend(erp_order_article_ids)
        
        article_query += " ORDER BY oa.position"
        
        cursor.execute(article_query, params)
        article_rows = cursor.fetchall()
        
        order_type = 'task'  # Always 'task' for todo_type
        
        # Calculate total order duration from ALL workplans (ALWAYS, regardless of include_workplan)
        total_order_duration = 0
        
        # Check if order todo already exists
        existing_order = db.query(PPSTodo).filter(
            PPSTodo.erp_order_id == erp_order_id,
            PPSTodo.todo_type.in_(['container_order', 'project', 'task']),
            PPSTodo.parent_todo_id.is_(None),  # Only top-level order todo
        ).first()
        
        if existing_order:
            order_container_id = existing_order.id
            if existing_order.todo_type != order_type:
                existing_order.todo_type = order_type
                existing_order.updated_at = datetime.utcnow()
        else:
            # Create order todo (duration will be updated later)
            order_container = PPSTodo(
                erp_order_id=erp_order_id,
                todo_type=order_type,
                title=f"{order_name} - {customer}",
                description=f"Auftrag {order_name}",
                quantity=1,
                status='new',
                delivery_date=delivery_date,
                planned_start=order_start,
                version=1,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(order_container)
            db.flush()
            order_container_id = order_container.id
            created_todos += 1
        
        for article_row in article_rows:
            order_article_id = article_row['order_article_id']
            packingnoteid = article_row['packingnoteid']
            
            # Get department resource from cache
            department_resource_id = None
            department_id = article_row.get('department_id')
            if department_id:
                dep_resource = db.query(PPSResourceCache).filter(
                    PPSResourceCache.resource_type == 'department',
                    PPSResourceCache.erp_id == department_id,
                ).first()
                if dep_resource:
                    department_resource_id = dep_resource.id
            
            # ALWAYS query workplan to calculate duration (regardless of include_workplan flag)
            workplan_rows = []
            total_article_duration = 0
            
            if packingnoteid:
                cursor.execute("""
                    SELECT 
                        wpd.id as detail_id,
                        wpd.pos,
                        wpd.setuptime,
                        wpd.unittime,
                        wpd.stepamount,
                        ws.id as workstep_id,
                        ws.name as workstep_name,
                        qi.id as machine_id,
                        qi.name as machine_name,
                        qi.level as machine_level,
                        pd.id as packingnote_details_id,
                        pd.quantity as bom_quantity,
                        art.articlenumber as bom_articlenumber,
                        art.customtext7 as bom_folder_path
                    FROM packingnote_relation pnr
                    JOIN packingnote_details pd ON pd.id = pnr.detail
                    JOIN workplan wp ON wp.packingnoteid = pd.id
                    JOIN workplan_relation wpr ON wpr.workplanId = wp.id
                    JOIN workplan_details wpd ON wpd.id = wpr.detail
                    LEFT JOIN article art ON art.id = pd.article
                    LEFT JOIN qualificationitem qi ON qi.id = wpd.qualificationitem
                    LEFT JOIN qualificationitem_workstep qiws ON qiws.item = qi.id
                    LEFT JOIN workstep ws ON ws.id = qiws.workstep
                    WHERE pnr.packingNoteId = %s
                    ORDER BY pd.pos, wpd.pos
                """, (packingnoteid,))
                
                workplan_rows = cursor.fetchall()
                
                # Calculate total duration from workplan
                for wp_row in workplan_rows:
                    setup_time_seconds = wp_row.get('setuptime') or 0
                    unit_time_seconds = wp_row.get('unittime') or 0
                    setup_time = setup_time_seconds / 60  # Seconds to minutes
                    unit_time = unit_time_seconds / 60
                    # Use stepamount from workplan_details if available, otherwise fall back to bom_quantity or article quantity
                    stepamount = wp_row.get('stepamount')
                    quantity = stepamount if stepamount else (wp_row.get('bom_quantity') or article_row['quantity'] or 1)
                    
                    # Duration formula: setup + (unit_time * quantity)
                    raw_duration = setup_time + (unit_time * quantity)
                    total_article_duration += raw_duration
            
            # Round the total article duration
            if total_article_duration > 0:
                total_article_duration = round_to_15_minutes(total_article_duration)
            else:
                total_article_duration = 60  # Default fallback
            
            total_order_duration += total_article_duration
            
            # Check if article todo already exists
            existing_article = db.query(PPSTodo).filter(
                PPSTodo.erp_order_article_id == order_article_id,
                PPSTodo.todo_type.in_(['container_article', 'task']),
            ).first()
            
            if existing_article:
                article_container_id = existing_article.id
                # Update duration from workplan calculation
                if not existing_article.is_duration_manual:
                    existing_article.total_duration_minutes = total_article_duration
                    existing_article.updated_at = datetime.utcnow()
                if existing_article.todo_type != 'task':
                    existing_article.todo_type = 'task'
                    existing_article.updated_at = datetime.utcnow()
                if not existing_article.assigned_department_id and department_resource_id:
                    existing_article.assigned_department_id = department_resource_id
                    existing_article.updated_at = datetime.utcnow()
            else:
                # Create article todo with calculated duration
                article_title = f"Pos {article_row['position']}: {article_row['articlenumber']} - {article_row['description']}"
                article_container = PPSTodo(
                    erp_order_id=erp_order_id,
                    erp_order_article_id=order_article_id,
                    parent_todo_id=order_container_id,
                    todo_type='task',
                    title=article_title[:255],
                    quantity=article_row['quantity'] or 1,
                    total_duration_minutes=total_article_duration,  # Duration from workplan
                    is_duration_manual=False,
                    status='new',
                    delivery_date=delivery_date,
                    assigned_department_id=department_resource_id,
                    planned_start=order_start,
                    version=1,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                article_container.planned_end = article_container.planned_start + timedelta(minutes=total_article_duration)
                
                db.add(article_container)
                db.flush()
                article_container_id = article_container.id
                created_todos += 1
            
            # Track previous operation end time for sequential scheduling
            prev_operation_end = order_start
            prev_operation_id = None
            
            # Create operation todos ONLY if include_workplan=True
            if include_workplan and workplan_rows:
                for wp_row in workplan_rows:
                    detail_id = wp_row['detail_id']
                    
                    # Filter by workplan level - only include machines with level <= workplan_level
                    machine_level = wp_row.get('machine_level') or 1
                    if machine_level > workplan_level:
                        continue  # Skip this workstep due to level filter
                    
                    # Check if operation already exists
                    existing_op = db.query(PPSTodo).filter(
                        PPSTodo.erp_workplan_detail_id == detail_id,
                        PPSTodo.todo_type == 'operation',
                    ).first()
                    
                    if existing_op:
                        operation_id = existing_op.id
                        prev_operation_end = existing_op.planned_end or prev_operation_end
                        if not existing_op.assigned_department_id and department_resource_id:
                            existing_op.assigned_department_id = department_resource_id
                            existing_op.updated_at = datetime.utcnow()
                    else:
                        # Create operation todo
                        op_title = f"AG {wp_row['pos']}: {wp_row['workstep_name'] or 'Arbeitsgang'}"
                        if wp_row['machine_name']:
                            op_title += f" ({wp_row['machine_name']})"
                        
                        # Calculate duration
                        setup_time_seconds = wp_row.get('setuptime') or 0
                        unit_time_seconds = wp_row.get('unittime') or 0
                        setup_time = setup_time_seconds / 60
                        unit_time = unit_time_seconds / 60
                        quantity = wp_row.get('bom_quantity') or article_row['quantity'] or 1
                        
                        if setup_time == 0 and unit_time == 0:
                            total_duration = 15
                            exec_time = 15
                        else:
                            exec_time = unit_time
                            raw_duration = setup_time + (unit_time * quantity)
                            total_duration = round_to_15_minutes(raw_duration)
                        
                        # Find machine resource
                        machine_resource_id = None
                        if wp_row['machine_id']:
                            machine = db.query(PPSResourceCache).filter(
                                PPSResourceCache.resource_type == 'machine',
                                PPSResourceCache.erp_id == wp_row['machine_id'],
                            ).first()
                            if machine:
                                machine_resource_id = machine.id
                        
                        packingnote_details_id = wp_row.get('packingnote_details_id')
                        
                        # SEQUENTIAL: Start at previous operation's end time
                        operation_start = prev_operation_end
                        operation_end = operation_start + timedelta(minutes=total_duration)
                        
                        operation = PPSTodo(
                            erp_order_id=erp_order_id,
                            erp_order_article_id=order_article_id,
                            erp_packingnote_details_id=packingnote_details_id,
                            erp_workplan_detail_id=detail_id,
                            parent_todo_id=article_container_id,
                            todo_type='operation',
                            title=op_title[:255],
                            quantity=quantity,
                            setup_time_minutes=setup_time,
                            run_time_minutes=exec_time,
                            total_duration_minutes=total_duration,
                            is_duration_manual=True,
                            status='new',
                            delivery_date=delivery_date,
                            assigned_department_id=department_resource_id,
                            assigned_machine_id=machine_resource_id,
                            planned_start=operation_start,
                            planned_end=operation_end,
                            version=1,
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow(),
                        )
                        
                        db.add(operation)
                        db.flush()
                        operation_id = operation.id
                        created_todos += 1
                        
                        # Update for next operation
                        prev_operation_end = operation_end
                    
                    # Create finish-to-start dependency to previous operation
                    if prev_operation_id:
                        existing_dep = db.query(PPSTodoDependency).filter(
                            PPSTodoDependency.predecessor_id == prev_operation_id,
                            PPSTodoDependency.successor_id == operation_id,
                        ).first()
                        
                        if not existing_dep:
                            dep = PPSTodoDependency(
                                predecessor_id=prev_operation_id,
                                successor_id=operation_id,
                                dependency_type='finish_to_start',
                                lag_minutes=0,
                                is_active=True,
                                created_at=datetime.utcnow(),
                            )
                            db.add(dep)
                            created_dependencies += 1
                    
                    prev_operation_id = operation_id
            
            # Create BOM item todos if include_bom_items=True (PARALLEL start)
            if include_bom_items and packingnoteid:
                # Get BOM items from packingnote_details
                cursor.execute("""
                    SELECT DISTINCT
                        pd.id as bom_item_id,
                        pd.pos,
                        pd.quantity,
                        art.articlenumber,
                        art.description,
                        art.customtext7 as folder_path
                    FROM packingnote_relation pnr
                    JOIN packingnote_details pd ON pd.id = pnr.detail
                    LEFT JOIN article art ON art.id = pd.article
                    WHERE pnr.packingNoteId = %s
                    ORDER BY pd.pos
                """, (packingnoteid,))
                
                bom_items = cursor.fetchall()
                
                for bom_item in bom_items:
                    bom_item_id = bom_item['bom_item_id']
                    
                    # Check if BOM item todo already exists
                    existing_bom = db.query(PPSTodo).filter(
                        PPSTodo.erp_packingnote_details_id == bom_item_id,
                        PPSTodo.todo_type == 'task',
                        PPSTodo.erp_workplan_detail_id.is_(None),  # Not an operation
                    ).first()
                    
                    if not existing_bom:
                        bom_title = f"BOM {bom_item['pos']}: {bom_item['articlenumber'] or 'Artikel'}"
                        if bom_item['description']:
                            bom_title += f" - {bom_item['description']}"
                        
                        # BOM items start PARALLEL at order start (no sequential dependencies)
                        bom_todo = PPSTodo(
                            erp_order_id=erp_order_id,
                            erp_order_article_id=order_article_id,
                            erp_packingnote_details_id=bom_item_id,
                            parent_todo_id=article_container_id,
                            todo_type='task',
                            title=bom_title[:255],
                            quantity=bom_item['quantity'] or 1,
                            total_duration_minutes=60,  # Default for BOM items
                            is_duration_manual=False,
                            status='new',
                            delivery_date=delivery_date,
                            assigned_department_id=department_resource_id,
                            planned_start=order_start,  # PARALLEL: All start at same time
                            version=1,
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow(),
                        )
                        bom_todo.planned_end = bom_todo.planned_start + timedelta(minutes=60)
                        
                        db.add(bom_todo)
                        db.flush()
                        created_todos += 1
        
        cursor.close()
        
        # Update order container duration
        if total_order_duration > 0:
            order_todo = db.query(PPSTodo).filter(PPSTodo.id == order_container_id).first()
            if order_todo and not order_todo.is_duration_manual:
                order_todo.total_duration_minutes = round_to_15_minutes(total_order_duration)
                order_todo.planned_end = order_todo.planned_start + timedelta(minutes=order_todo.total_duration_minutes)
                order_todo.updated_at = datetime.utcnow()
        
        db.commit()
        
        return GenerateTodosResponse(
            success=True,
            created_todos=created_todos,
            created_dependencies=created_dependencies,
            order_name=order_name,
            errors=errors,
        )
        
    except Exception as e:
        db.rollback()
        return GenerateTodosResponse(
            success=False,
            created_todos=0,
            created_dependencies=0,
            errors=[str(e)],
        )
    finally:
        if erp_conn:
            erp_conn.close()
