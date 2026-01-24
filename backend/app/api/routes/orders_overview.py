"""
Orders Overview Routes
Provides the Auftragsübersicht data from HUGWAWI
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date
from pydantic import BaseModel

from app.core.database import get_db, get_erp_db_connection

router = APIRouter()


class OrderOverviewItem(BaseModel):
    """Single order item in the overview"""
    pos: int
    au_verantwortlich: Optional[str] = None
    lt_hg_bestaetigt: Optional[date] = None
    auftrag: Optional[str] = None
    kunde: Optional[str] = None
    au_text: Optional[str] = None
    produktionsinfo: Optional[str] = None
    lt_kundenwunsch: Optional[date] = None
    technischer_kontakt: Optional[str] = None
    order_id: Optional[int] = None
    status_name: Optional[str] = None
    reference: Optional[str] = None
    has_articles: bool = False  # True if order has articles (for expand arrow)


class OrderArticleItem(BaseModel):
    """Single order article item"""
    pos: Optional[int] = None
    articlenumber: Optional[str] = None
    description: Optional[str] = None
    sparepart: Optional[str] = None
    batchsize: Optional[int] = None
    status_name: Optional[str] = None
    order_article_id: Optional[int] = None
    packingnoteid: Optional[int] = None
    has_bom: bool = False  # True if article has BOM (packingnoteid is not null)


class OrderArticlesResponse(BaseModel):
    """Response for order articles"""
    items: List[OrderArticleItem]
    total: int


class BomItem(BaseModel):
    """Single BOM (Stückliste) item"""
    pos: Optional[int] = None
    articlenumber: Optional[str] = None
    description: Optional[str] = None
    cascaded_quantity: Optional[float] = None
    mass1: Optional[float] = None
    mass2: Optional[float] = None
    lft: Optional[int] = None
    rgt: Optional[int] = None
    detail_id: Optional[int] = None
    packingnote_id: Optional[int] = None
    has_workplan: bool = False  # True if BOM item has workplan


class BomResponse(BaseModel):
    """Response for BOM items"""
    items: List[BomItem]
    total: int


class WorkplanItem(BaseModel):
    """Single workplan item"""
    workplan_detail_id: Optional[int] = None
    pos: Optional[int] = None
    workstep_name: Optional[str] = None
    machine_name: Optional[str] = None


class WorkplanResponse(BaseModel):
    """Response for workplan items"""
    items: List[WorkplanItem]
    total: int


# Valid status IDs for orders to be displayed
# 1=Offen, 3=Gestoppt, 4=Geliefert, 14=Teilgeliefert, 15=Geliefert(BOOKING), 
# 16=Email Versendet, 33=Zum liefern bereit, 37=Offen_TG30_geprüft
VALID_ORDER_STATUS_IDS = (1, 3, 4, 14, 15, 16, 33, 37)


class OrderOverviewResponse(BaseModel):
    """Response for orders overview"""
    items: List[OrderOverviewItem]
    total: int


@router.get("/orders/overview", response_model=OrderOverviewResponse)
async def get_orders_overview(
    date_from: Optional[date] = Query(None, description="Filter: Liefertermin ab"),
    date_to: Optional[date] = Query(None, description="Filter: Liefertermin bis"),
    responsible: Optional[str] = Query(None, description="Filter: AU-Verantwortlicher (loginname)"),
    customer: Optional[str] = Query(None, description="Filter: Kunde (Suchname)"),
    order_name: Optional[str] = Query(None, description="Filter: Auftragsnummer"),
    text: Optional[str] = Query(None, description="Filter: Auftragstext"),
    reference: Optional[str] = Query(None, description="Filter: Referenz"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000)
):
    """
    Get orders overview from HUGWAWI.
    
    This endpoint provides the data for the Auftragsübersicht grid,
    replacing the Excel pivot table.
    
    Columns:
    - Pos. (laufende Nummer)
    - AU-Verantwortlich (userlogin.loginname via ordertable.infoSales)
    - LT-HG-Bestätigt (ordertable.date2)
    - Auftrag (ordertable.name)
    - Kunde (adrbase.suchname via ordertable.kid)
    - AU-Text (ordertable.text)
    - Produktionsinfo (ordertable.productionText)
    - LT-Kundenwunsch (ordertable.date1)
    - Technischer K. (adrcont.suchname via ordertable.techcont)
    """
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Build the query
        # Note: MySQL 5.5 doesn't support ROW_NUMBER(), so we'll enumerate in Python
        # Filter: order_type.name = 'ORDER' AND status IN (1,3,4,14,15,16,33,37)
        # AND created > '2024-01-01' (only recent orders)
        status_placeholders = ','.join(['%s'] * len(VALID_ORDER_STATUS_IDS))
        query = f"""
            SELECT 
                ordertable.id as order_id,
                userlogin.loginname as au_verantwortlich,
                ordertable.date2 as lt_hg_bestaetigt,
                ordertable.name as auftrag,
                adrbase.suchname as kunde,
                ordertable.text as au_text,
                ordertable.productionText as produktionsinfo,
                ordertable.date1 as lt_kundenwunsch,
                adrcont.suchname as technischer_kontakt,
                order_status.name as status_name,
                ordertable.reference as reference,
                (SELECT COUNT(*) > 0 FROM order_article_ref WHERE order_article_ref.orderid = ordertable.id) as has_articles
            FROM ordertable
            LEFT JOIN adrbase ON adrbase.id = ordertable.kid
            LEFT JOIN userlogin ON userlogin.id = ordertable.infoSales
            LEFT JOIN adrcont ON adrcont.id = ordertable.techcont
            LEFT JOIN order_type ON order_type.id = ordertable.orderType
            LEFT JOIN order_status ON order_status.id = ordertable.status
            WHERE order_type.name = 'ORDER'
              AND ordertable.status IN ({status_placeholders})
              AND ordertable.created > '2024-01-01'
        """
        
        params = list(VALID_ORDER_STATUS_IDS)
        
        # Add filters
        if date_from:
            query += " AND ordertable.date2 >= %s"
            params.append(date_from)
        
        if date_to:
            query += " AND ordertable.date2 <= %s"
            params.append(date_to)
        
        if responsible:
            query += " AND userlogin.loginname LIKE %s"
            params.append(f"%{responsible}%")
        
        if customer:
            query += " AND adrbase.suchname LIKE %s"
            params.append(f"%{customer}%")
        
        if order_name:
            query += " AND ordertable.name LIKE %s"
            params.append(f"%{order_name}%")
        
        if text:
            query += " AND ordertable.text LIKE %s"
            params.append(f"%{text}%")
        
        if reference:
            query += " AND ordertable.reference LIKE %s"
            params.append(f"%{reference}%")
        
        # Order by confirmed delivery date
        query += " ORDER BY ordertable.date2 ASC"
        
        # Add pagination
        query += " LIMIT %s OFFSET %s"
        params.extend([limit, skip])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Get total count for pagination
        count_query = f"""
            SELECT COUNT(*) as total
            FROM ordertable
            LEFT JOIN adrbase ON adrbase.id = ordertable.kid
            LEFT JOIN userlogin ON userlogin.id = ordertable.infoSales
            LEFT JOIN order_type ON order_type.id = ordertable.orderType
            WHERE order_type.name = 'ORDER'
              AND ordertable.status IN ({status_placeholders})
              AND ordertable.created > '2024-01-01'
        """
        count_params = list(VALID_ORDER_STATUS_IDS)
        
        if date_from:
            count_query += " AND ordertable.date2 >= %s"
            count_params.append(date_from)
        
        if date_to:
            count_query += " AND ordertable.date2 <= %s"
            count_params.append(date_to)
        
        if responsible:
            count_query += " AND userlogin.loginname LIKE %s"
            count_params.append(f"%{responsible}%")
        
        if customer:
            count_query += " AND adrbase.suchname LIKE %s"
            count_params.append(f"%{customer}%")
        
        if order_name:
            count_query += " AND ordertable.name LIKE %s"
            count_params.append(f"%{order_name}%")
        
        if text:
            count_query += " AND ordertable.text LIKE %s"
            count_params.append(f"%{text}%")
        
        if reference:
            count_query += " AND ordertable.reference LIKE %s"
            count_params.append(f"%{reference}%")
        
        cursor.execute(count_query, count_params)
        total_result = cursor.fetchone()
        total = total_result['total'] if total_result else 0
        
        cursor.close()
        
        # Transform rows to response items with position numbers
        items = []
        for idx, row in enumerate(rows, start=skip + 1):
            items.append(OrderOverviewItem(
                pos=idx,
                au_verantwortlich=row.get('au_verantwortlich'),
                lt_hg_bestaetigt=row.get('lt_hg_bestaetigt'),
                auftrag=row.get('auftrag'),
                kunde=row.get('kunde'),
                au_text=row.get('au_text'),
                produktionsinfo=row.get('produktionsinfo'),
                lt_kundenwunsch=row.get('lt_kundenwunsch'),
                technischer_kontakt=row.get('technischer_kontakt'),
                order_id=row.get('order_id'),
                status_name=row.get('status_name'),
                reference=row.get('reference'),
                has_articles=bool(row.get('has_articles', 0))
            ))
        
        return OrderOverviewResponse(items=items, total=total)
        
    except Exception as e:
        print(f"Error fetching orders overview: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Laden der Auftragsübersicht: {str(e)}"
        )
    finally:
        if connection:
            connection.close()


@router.patch("/orders/{order_id}/production-info")
async def update_production_info(
    order_id: int,
    production_info: str = Query(..., description="New production info text")
):
    """
    Update the production info (Produktionsinfo) for an order.
    
    This updates ordertable.productionText in HUGWAWI.
    """
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor()
        
        # Update the production text
        query = """
            UPDATE ordertable 
            SET productionText = %s 
            WHERE id = %s
        """
        cursor.execute(query, (production_info, order_id))
        connection.commit()
        
        affected_rows = cursor.rowcount
        cursor.close()
        
        if affected_rows == 0:
            raise HTTPException(
                status_code=404,
                detail=f"Auftrag mit ID {order_id} nicht gefunden"
            )
        
        return {"message": "Produktionsinfo aktualisiert", "order_id": order_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating production info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Aktualisieren der Produktionsinfo: {str(e)}"
        )
    finally:
        if connection:
            connection.close()


@router.get("/orders/{order_id}/articles", response_model=OrderArticlesResponse)
async def get_order_articles(order_id: int):
    """
    Get order articles for a specific order.
    
    Returns the Auftragsartikel for the hierarchical view.
    """
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                order_article.position as pos,
                article.articlenumber,
                article.description,
                article.sparepart,
                order_article_ref.batchsize,
                article_status.name as status_name,
                order_article.id as order_article_id,
                order_article.packingnoteid
            FROM order_article_ref
            JOIN order_article ON order_article_ref.orderArticleId = order_article.id
            JOIN article ON order_article.articleid = article.id
            LEFT JOIN article_status ON order_article.articlestatus = article_status.id
            WHERE order_article_ref.orderid = %s
            ORDER BY order_article.position
        """
        
        cursor.execute(query, (order_id,))
        rows = cursor.fetchall()
        cursor.close()
        
        items = [
            OrderArticleItem(
                pos=row.get('pos'),
                articlenumber=row.get('articlenumber'),
                description=row.get('description'),
                sparepart=row.get('sparepart'),
                batchsize=row.get('batchsize'),
                status_name=row.get('status_name'),
                order_article_id=row.get('order_article_id'),
                packingnoteid=row.get('packingnoteid'),
                has_bom=row.get('packingnoteid') is not None
            )
            for row in rows
        ]
        
        return OrderArticlesResponse(items=items, total=len(items))
        
    except Exception as e:
        print(f"Error fetching order articles: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Laden der Auftragsartikel: {str(e)}"
        )
    finally:
        if connection:
            connection.close()


@router.get("/order-articles/{order_article_id}/bom", response_model=BomResponse)
async def get_order_article_bom(order_article_id: int):
    """
    Get BOM (Stückliste) for a specific order article.
    
    Returns the packingnote details with nested set structure (lft/rgt).
    """
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                packingnote_details.pos,
                article.articlenumber,
                article.description,
                packingnote_details.cascadedQuantity as cascaded_quantity,
                packingnote_details.mass1,
                packingnote_details.mass2,
                packingnote_relation.lft,
                packingnote_relation.rgt,
                packingnote_details.id as detail_id,
                order_article.packingnoteid as packingnote_id,
                (SELECT COUNT(*) > 0 FROM workplan WHERE workplan.packingnoteid = packingnote_details.id) as has_workplan
            FROM order_article
            JOIN packingnote_relation ON packingnote_relation.packingNoteId = order_article.packingnoteid
            JOIN packingnote_details ON packingnote_details.id = packingnote_relation.detail
            LEFT JOIN article ON article.id = packingnote_details.article
            WHERE order_article.id = %s
            ORDER BY packingnote_relation.lft
        """
        
        cursor.execute(query, (order_article_id,))
        rows = cursor.fetchall()
        cursor.close()
        
        items = [
            BomItem(
                pos=row.get('pos'),
                articlenumber=row.get('articlenumber'),
                description=row.get('description'),
                cascaded_quantity=row.get('cascaded_quantity'),
                mass1=row.get('mass1'),
                mass2=row.get('mass2'),
                lft=row.get('lft'),
                rgt=row.get('rgt'),
                detail_id=row.get('detail_id'),
                packingnote_id=row.get('packingnote_id'),
                has_workplan=bool(row.get('has_workplan', 0))
            )
            for row in rows
        ]
        
        return BomResponse(items=items, total=len(items))
        
    except Exception as e:
        print(f"Error fetching BOM: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Laden der Stückliste: {str(e)}"
        )
    finally:
        if connection:
            connection.close()


@router.get("/packingnote-details/{detail_id}/workplan", response_model=WorkplanResponse)
async def get_workplan(detail_id: int):
    """
    Get workplan (Arbeitsplan) for a specific packingnote detail (Stücklistenposition).
    
    The workplan is connected via: packingnote_relation.detail = workplan.packingnoteid
    Each BOM position can have its own workplan.
    
    Returns the workplan details with worksteps and machines.
    """
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                workplan_details.id as workplan_detail_id,
                workplan_details.pos,
                workstep.name as workstep_name,
                qualificationitem.name as machine_name
            FROM workplan
            JOIN workplan_relation ON workplan_relation.workplanId = workplan.id
            JOIN workplan_details ON workplan_details.id = workplan_relation.detail
            LEFT JOIN qualificationitem ON qualificationitem.id = workplan_details.qualificationitem
            LEFT JOIN qualificationitem_workstep ON qualificationitem_workstep.item = qualificationitem.id
            LEFT JOIN workstep ON workstep.id = qualificationitem_workstep.workstep
            WHERE workplan.packingnoteid = %s
            ORDER BY workplan_details.pos
        """
        
        cursor.execute(query, (detail_id,))
        rows = cursor.fetchall()
        cursor.close()
        
        items = [
            WorkplanItem(
                workplan_detail_id=row.get('workplan_detail_id'),
                pos=row.get('pos'),
                workstep_name=row.get('workstep_name'),
                machine_name=row.get('machine_name')
            )
            for row in rows
        ]
        
        return WorkplanResponse(items=items, total=len(items))
        
    except Exception as e:
        print(f"Error fetching workplan: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Laden des Arbeitsplans: {str(e)}"
        )
    finally:
        if connection:
            connection.close()
