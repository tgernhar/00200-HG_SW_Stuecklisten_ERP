"""
PPS Service - Main business logic for production planning

Handles:
- Todo generation from ERP orders
- Available orders query
- Todo operations
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.models.pps_todo import PPSTodo, PPSTodoDependency, PPSResourceCache
from app.schemas.pps import (
    GenerateTodosResponse, AvailableOrder, TodoType, TodoStatus
)
from app.core.database import get_erp_db_connection


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


def generate_todos_from_order(
    db: Session,
    erp_order_id: int,
    erp_order_article_ids: Optional[List[int]] = None,
    include_workplan: bool = True,
) -> GenerateTodosResponse:
    """
    Generate todos from an ERP order.
    
    Creates:
    1. Container todo for the order
    2. Container todos for each order article
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
        
        # Check if container todo already exists
        existing_container = db.query(PPSTodo).filter(
            PPSTodo.erp_order_id == erp_order_id,
            PPSTodo.todo_type == 'container_order',
        ).first()
        
        if existing_container:
            order_container_id = existing_container.id
        else:
            # Create order container todo
            order_container = PPSTodo(
                erp_order_id=erp_order_id,
                todo_type='container_order',
                title=f"{order_name} - {customer}",
                description=f"Auftrag {order_name}",
                quantity=1,
                status='new',
                delivery_date=delivery_date,
                version=1,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(order_container)
            db.flush()
            order_container_id = order_container.id
            created_todos += 1
        
        # 2. Get order articles
        article_query = """
            SELECT 
                oa.id as order_article_id,
                oa.position,
                oa.packingnoteid,
                art.articlenumber,
                art.description,
                oar.batchsize as quantity
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
        
        for article_row in article_rows:
            order_article_id = article_row['order_article_id']
            
            # Check if article container already exists
            existing_article = db.query(PPSTodo).filter(
                PPSTodo.erp_order_article_id == order_article_id,
                PPSTodo.todo_type == 'container_article',
            ).first()
            
            if existing_article:
                article_container_id = existing_article.id
            else:
                # Create article container todo
                article_title = f"Pos {article_row['position']}: {article_row['articlenumber']} - {article_row['description']}"
                article_container = PPSTodo(
                    erp_order_id=erp_order_id,
                    erp_order_article_id=order_article_id,
                    parent_todo_id=order_container_id,
                    todo_type='container_article',
                    title=article_title[:255],
                    quantity=article_row['quantity'] or 1,
                    status='new',
                    delivery_date=delivery_date,
                    version=1,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(article_container)
                db.flush()
                article_container_id = article_container.id
                created_todos += 1
            
            # 3. Get workplan for this article (if requested)
            if include_workplan and article_row['packingnoteid']:
                packingnoteid = article_row['packingnoteid']
                
                # Get workplan details
                cursor.execute("""
                    SELECT 
                        wpd.id as detail_id,
                        wpd.pos,
                        wpd.workstep as workstep_id,
                        ws.name as workstep_name,
                        qi.id as machine_id,
                        qi.name as machine_name,
                        wpd.setupTime,
                        wpd.executionTime
                    FROM workplan wp
                    JOIN workplan_relation wpr ON wpr.workplanId = wp.id
                    JOIN workplan_details wpd ON wpd.id = wpr.detail
                    LEFT JOIN workstep ws ON ws.id = wpd.workstep
                    LEFT JOIN qualificationitem qi ON qi.id = wpd.qualificationitem
                    WHERE wp.packingnoteid = %s
                    ORDER BY wpd.pos
                """, (packingnoteid,))
                
                workplan_rows = cursor.fetchall()
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
                    else:
                        # Create operation todo
                        op_title = f"AG {wp_row['pos']}: {wp_row['workstep_name'] or 'Arbeitsgang'}"
                        if wp_row['machine_name']:
                            op_title += f" ({wp_row['machine_name']})"
                        
                        # Calculate duration
                        setup_time = int(wp_row['setupTime'] or 0)
                        exec_time = int(wp_row['executionTime'] or 0)
                        quantity = article_row['quantity'] or 1
                        total_duration = setup_time + (exec_time * quantity)
                        
                        # Find or create machine resource
                        machine_resource_id = None
                        if wp_row['machine_id']:
                            machine = db.query(PPSResourceCache).filter(
                                PPSResourceCache.resource_type == 'machine',
                                PPSResourceCache.erp_id == wp_row['machine_id'],
                            ).first()
                            if machine:
                                machine_resource_id = machine.id
                        
                        operation = PPSTodo(
                            erp_order_id=erp_order_id,
                            erp_order_article_id=order_article_id,
                            erp_workplan_detail_id=detail_id,
                            parent_todo_id=article_container_id,
                            todo_type='operation',
                            title=op_title[:255],
                            quantity=quantity,
                            setup_time_minutes=setup_time,
                            run_time_minutes=exec_time,
                            total_duration_minutes=total_duration,
                            status='new',
                            delivery_date=delivery_date,
                            assigned_machine_id=machine_resource_id,
                            version=1,
                            created_at=datetime.utcnow(),
                            updated_at=datetime.utcnow(),
                        )
                        db.add(operation)
                        db.flush()
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
