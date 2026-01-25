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
    
    Args:
        minutes: Duration in minutes (can be float)
    
    Returns:
        Rounded duration in minutes (always multiple of 15)
    
    Examples:
        1-7 minutes -> 15 minutes
        8-22 minutes -> 15 minutes
        23-37 minutes -> 30 minutes
        67 minutes -> 75 minutes
    """
    if minutes <= 0:
        return 15  # Minimum 15 minutes
    
    # Round up to next 15-minute interval
    return int(((minutes + 14) // 15) * 15)


def resolve_erp_details_for_todos(todos: List[PPSTodo]) -> List[Dict[str, Any]]:
    """
    Resolve ERP names for a list of todos by querying HUGWAWI.
    
    Returns todo data enriched with:
    - order_name (from ordertable.name)
    - order_article_number (from article.articlenumber via order_article)
    - bom_article_number (from article.articlenumber via packingnote_details)
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
    
    # Query HUGWAWI for names
    order_names: Dict[int, str] = {}
    order_article_numbers: Dict[int, str] = {}
    bom_article_numbers: Dict[int, str] = {}
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
        
        # Get order article numbers (via article table)
        if order_article_ids:
            placeholders = ','.join(['%s'] * len(order_article_ids))
            cursor.execute(f"""
                SELECT oa.id, art.articlenumber
                FROM order_article oa
                JOIN article art ON oa.articleid = art.id
                WHERE oa.id IN ({placeholders})
            """, tuple(order_article_ids))
            for row in cursor.fetchall():
                order_article_numbers[row['id']] = row['articlenumber']
        
        # Get BOM article numbers (via packingnote_details -> article)
        if packingnote_details_ids:
            placeholders = ','.join(['%s'] * len(packingnote_details_ids))
            cursor.execute(f"""
                SELECT pd.id, art.articlenumber
                FROM packingnote_details pd
                LEFT JOIN article art ON art.id = pd.article
                WHERE pd.id IN ({placeholders})
            """, tuple(packingnote_details_ids))
            for row in cursor.fetchall():
                if row['articlenumber']:
                    bom_article_numbers[row['id']] = row['articlenumber']
        
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
            'bom_article_number': bom_article_numbers.get(todo.erp_packingnote_details_id) if todo.erp_packingnote_details_id else None,
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
              AND o.status IN (1, 3, 4, 14, 15, 16, 33, 37)
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
    include_workplan: bool = True,
) -> GenerateTodosResponse:
    """
    Generate todos from an ERP order.
    
    Creates:
    1. Order todo:
       - Type 'task' if no order articles exist
       - Type 'project' if order articles exist
    2. Order article todos (type 'task') for each article
    3. Operation todos from workplan (if include_workplan=True)
    4. Dependencies based on workplan sequence
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
        
        # 2. Get order articles first to determine order type (including department from article)
        article_query = """
            SELECT 
                oa.id as order_article_id,
                oa.position,
                oa.packingnoteid,
                art.articlenumber,
                art.description,
                art.department as department_id,
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
        
        # #region agent log
        import json
        with open(r'c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(json.dumps({"location":"pps_service.py:383","message":"Article rows loaded","data":{"article_count":len(article_rows),"first_article":article_rows[0] if article_rows else None},"timestamp":int(datetime.now().timestamp()*1000),"sessionId":"debug-session","hypothesisId":"H7"}) + '\n')
        # #endregion
        
        # All orders are 'task' type, but we'll set gantt_type differently
        # Orders with articles will have gantt_type='project' for visual grouping
        has_articles = len(article_rows) > 0
        order_type = 'task'  # Always 'task' for todo_type
        
        # Check if order todo already exists
        existing_order = db.query(PPSTodo).filter(
            PPSTodo.erp_order_id == erp_order_id,
            PPSTodo.todo_type.in_(['container_order', 'project', 'task']),
        ).first()
        
        if existing_order:
            order_container_id = existing_order.id
            # Update type if needed
            if existing_order.todo_type != order_type:
                existing_order.todo_type = order_type
                existing_order.updated_at = datetime.utcnow()
        else:
            # Create order todo with appropriate type
            order_container = PPSTodo(
                erp_order_id=erp_order_id,
                todo_type=order_type,
                title=f"{order_name} - {customer}",
                description=f"Auftrag {order_name}",
                quantity=1,
                status='new',
                delivery_date=delivery_date,
                planned_start=datetime.now().replace(second=0, microsecond=0),
                version=1,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            # Calculate planned_end from planned_start + duration
            if order_container.planned_start:
                duration = order_container.total_duration_minutes or 60
                order_container.planned_end = order_container.planned_start + timedelta(minutes=duration)
            
            db.add(order_container)
            db.flush()
            order_container_id = order_container.id
            created_todos += 1
        
        for article_row in article_rows:
            order_article_id = article_row['order_article_id']
            
            # Get department resource from cache (based on article.department)
            department_resource_id = None
            department_id = article_row.get('department_id')
            if department_id:
                dep_resource = db.query(PPSResourceCache).filter(
                    PPSResourceCache.resource_type == 'department',
                    PPSResourceCache.erp_id == department_id,
                ).first()
                if dep_resource:
                    department_resource_id = dep_resource.id
            
            # Check if article todo already exists
            existing_article = db.query(PPSTodo).filter(
                PPSTodo.erp_order_article_id == order_article_id,
                PPSTodo.todo_type.in_(['container_article', 'task']),
            ).first()
            
            if existing_article:
                article_container_id = existing_article.id
                # Update type to 'task' if needed
                if existing_article.todo_type != 'task':
                    existing_article.todo_type = 'task'
                    existing_article.updated_at = datetime.utcnow()
                # Update department if not set
                if not existing_article.assigned_department_id and department_resource_id:
                    existing_article.assigned_department_id = department_resource_id
                    existing_article.updated_at = datetime.utcnow()
            else:
                # Create article todo as 'task'
                article_title = f"Pos {article_row['position']}: {article_row['articlenumber']} - {article_row['description']}"
                article_container = PPSTodo(
                    erp_order_id=erp_order_id,
                    erp_order_article_id=order_article_id,
                    parent_todo_id=order_container_id,
                    todo_type='task',
                    title=article_title[:255],
                    quantity=article_row['quantity'] or 1,
                    status='new',
                    delivery_date=delivery_date,
                    assigned_department_id=department_resource_id,
                    planned_start=datetime.now().replace(second=0, microsecond=0),
                    version=1,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                # Calculate planned_end from planned_start + duration
                if article_container.planned_start:
                    duration = article_container.total_duration_minutes or 60
                    article_container.planned_end = article_container.planned_start + timedelta(minutes=duration)
                
                db.add(article_container)
                db.flush()
                article_container_id = article_container.id
                created_todos += 1
            
            # 3. Get workplan for this article (if requested)
            # #region agent log
            import json
            with open(r'c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps({"location":"pps_service.py:486","message":"Before workplan check","data":{"include_workplan":include_workplan,"packingnoteid":article_row.get('packingnoteid'),"article_keys":list(article_row.keys())},"timestamp":int(datetime.now().timestamp()*1000),"sessionId":"debug-session","hypothesisId":"H7"}) + '\n')
            # #endregion
            
            if include_workplan and article_row['packingnoteid']:
                packingnoteid = article_row['packingnoteid']
                
                # Get workplan details with time values (setuptime, unittime)
                # IMPORTANT: workplan.packingnoteid references packingnote_details.id (BOM item), 
                # NOT order_article.packingnoteid (which is the packingnote header ID)
                # We need to go through packingnote_relation to get all BOM items
                cursor.execute("""
                    SELECT 
                        wpd.id as detail_id,
                        wpd.pos,
                        wpd.setuptime,
                        wpd.unittime,
                        ws.id as workstep_id,
                        ws.name as workstep_name,
                        qi.id as machine_id,
                        qi.name as machine_name,
                        pd.id as packingnote_details_id,
                        pd.quantity as bom_quantity
                    FROM packingnote_relation pnr
                    JOIN packingnote_details pd ON pd.id = pnr.detail
                    JOIN workplan wp ON wp.packingnoteid = pd.id
                    JOIN workplan_relation wpr ON wpr.workplanId = wp.id
                    JOIN workplan_details wpd ON wpd.id = wpr.detail
                    LEFT JOIN qualificationitem qi ON qi.id = wpd.qualificationitem
                    LEFT JOIN qualificationitem_workstep qiws ON qiws.item = qi.id
                    LEFT JOIN workstep ws ON ws.id = qiws.workstep
                    WHERE pnr.packingNoteId = %s
                    ORDER BY pd.pos, wpd.pos
                """, (packingnoteid,))
                
                workplan_rows = cursor.fetchall()
                
                # #region agent log
                import json
                with open(r'c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log', 'a', encoding='utf-8') as f:
                    f.write(json.dumps({"location":"pps_service.py:512","message":"Workplan rows from DB","data":{"packingnoteid":packingnoteid,"row_count":len(workplan_rows),"first_row":workplan_rows[0] if workplan_rows else None},"timestamp":int(datetime.now().timestamp()*1000),"sessionId":"debug-session","hypothesisId":"H5"}) + '\n')
                # #endregion
                
                prev_operation_id = None
                
                for wp_row in workplan_rows:
                    detail_id = wp_row['detail_id']
                    
                    # Check if operation already exists
                    existing_op = db.query(PPSTodo).filter(
                        PPSTodo.erp_workplan_detail_id == detail_id,
                        PPSTodo.todo_type == 'operation',
                    ).first()
                    
                    if existing_op:
                        operation_id = existing_op.id
                        # Update department if not set
                        if not existing_op.assigned_department_id and department_resource_id:
                            existing_op.assigned_department_id = department_resource_id
                            existing_op.updated_at = datetime.utcnow()
                    else:
                        # Create operation todo
                        op_title = f"AG {wp_row['pos']}: {wp_row['workstep_name'] or 'Arbeitsgang'}"
                        if wp_row['machine_name']:
                            op_title += f" ({wp_row['machine_name']})"
                        
                        # Get time values from HUGWAWI workplan_details
                        # setuptime = Rüstzeit in Minuten
                        # unittime = Stückzeit pro Teil in Minuten
                        setup_time = wp_row.get('setuptime') or 0
                        unit_time = wp_row.get('unittime') or 0
                        # Use BOM quantity from packingnote_details, not order article quantity
                        quantity = wp_row.get('bom_quantity') or article_row['quantity'] or 1
                        
                        # #region agent log
                        import json
                        with open(r'c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log', 'a', encoding='utf-8') as f:
                            f.write(json.dumps({"location":"pps_service.py:520","message":"Time values from ERP","data":{"setup_time":setup_time,"unit_time":unit_time,"quantity":quantity,"wp_row_keys":list(wp_row.keys()),"article_row_quantity":article_row.get('quantity')},"timestamp":int(datetime.now().timestamp()*1000),"sessionId":"debug-session","hypothesisId":"H1,H2,H5"}) + '\n')
                        # #endregion
                        
                        # Calculate total duration: setup + (unit_time * quantity)
                        # If no time data available, use default of 15 minutes (rounded)
                        if setup_time == 0 and unit_time == 0:
                            total_duration = 15  # Default fallback (rounded to 15-min)
                            setup_time = 0
                            exec_time = 15
                            # #region agent log
                            with open(r'c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log', 'a', encoding='utf-8') as f:
                                f.write(json.dumps({"location":"pps_service.py:533","message":"Using fallback duration","data":{"total_duration":total_duration},"timestamp":int(datetime.now().timestamp()*1000),"sessionId":"debug-session","hypothesisId":"H1,H4"}) + '\n')
                            # #endregion
                        else:
                            exec_time = unit_time
                            # Calculate raw duration and round to 15-minute intervals (REQ-TODO-010)
                            raw_duration = setup_time + (unit_time * quantity)
                            total_duration = round_to_15_minutes(raw_duration)
                            # #region agent log
                            with open(r'c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log', 'a', encoding='utf-8') as f:
                                f.write(json.dumps({"location":"pps_service.py:542","message":"Calculated duration","data":{"raw_duration":raw_duration,"total_duration":total_duration,"formula":f"{setup_time} + ({unit_time} * {quantity})"},"timestamp":int(datetime.now().timestamp()*1000),"sessionId":"debug-session","hypothesisId":"H3,H4"}) + '\n')
                            # #endregion
                        
                        # Find or create machine resource
                        machine_resource_id = None
                        if wp_row['machine_id']:
                            machine = db.query(PPSResourceCache).filter(
                                PPSResourceCache.resource_type == 'machine',
                                PPSResourceCache.erp_id == wp_row['machine_id'],
                            ).first()
                            if machine:
                                machine_resource_id = machine.id
                        
                        # Get packingnote_details_id (BOM item) from workplan
                        packingnote_details_id = wp_row.get('packingnote_details_id')
                        
                        operation = PPSTodo(
                            erp_order_id=erp_order_id,
                            erp_order_article_id=order_article_id,
                            erp_packingnote_details_id=packingnote_details_id,
                            erp_workplan_detail_id=detail_id,
                            parent_todo_id=article_container_id,
                            todo_type='operation',
                            title=op_title[:255],
                            quantity=quantity,  # Store actual BOM quantity for transparency
                            setup_time_minutes=setup_time,  # Store setup time as-is
                            run_time_minutes=exec_time,  # Store unit time (NOT multiplied)
                            total_duration_minutes=total_duration,  # Store final calculated duration
                            is_duration_manual=True,  # CRITICAL: Prevent calculate_duration() from recalculating
                            status='new',
                            delivery_date=delivery_date,
                            assigned_department_id=department_resource_id,
                            assigned_machine_id=machine_resource_id,
                            planned_start=datetime.now().replace(second=0, microsecond=0),
                            version=1,
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow(),
                        )
                        
                        # #region agent log
                        print(f"[DEBUG] Created operation: title={op_title[:50]}, qty={quantity}, setup={setup_time}, run={exec_time}, total={total_duration}, is_manual=True")
                        # #endregion
                        
                        # Calculate planned_end from planned_start + duration
                        if operation.planned_start and operation.total_duration_minutes:
                            operation.planned_end = operation.planned_start + timedelta(minutes=operation.total_duration_minutes)
                        
                        db.add(operation)
                        db.flush()
                        
                        # #region agent log
                        print(f"[DEBUG] After flush: id={operation.id}, total_duration_minutes={operation.total_duration_minutes}, is_duration_manual={operation.is_duration_manual}")
                        # #endregion
                        
                        operation_id = operation.id
                        created_todos += 1
                    
                    # Create dependency to previous operation
                    if prev_operation_id:
                        # Check if dependency exists
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
        
        cursor.close()
        
        # Update container durations (aggregated from children)
        _update_container_durations(db, order_container_id)
        
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
