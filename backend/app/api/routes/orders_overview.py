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
        query = """
            SELECT 
                ordertable.id as order_id,
                userlogin.loginname as au_verantwortlich,
                ordertable.date2 as lt_hg_bestaetigt,
                ordertable.name as auftrag,
                adrbase.suchname as kunde,
                ordertable.text as au_text,
                ordertable.productionText as produktionsinfo,
                ordertable.date1 as lt_kundenwunsch,
                adrcont.suchname as technischer_kontakt
            FROM ordertable
            LEFT JOIN adrbase ON adrbase.id = ordertable.kid
            LEFT JOIN userlogin ON userlogin.id = ordertable.infoSales
            LEFT JOIN adrcont ON adrcont.id = ordertable.techcont
            WHERE ordertable.status < 100
        """
        
        params = []
        
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
        
        # Order by confirmed delivery date
        query += " ORDER BY ordertable.date2 ASC"
        
        # Add pagination
        query += " LIMIT %s OFFSET %s"
        params.extend([limit, skip])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Get total count for pagination
        count_query = """
            SELECT COUNT(*) as total
            FROM ordertable
            LEFT JOIN adrbase ON adrbase.id = ordertable.kid
            LEFT JOIN userlogin ON userlogin.id = ordertable.infoSales
            WHERE ordertable.status < 100
        """
        count_params = []
        
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
                order_id=row.get('order_id')
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
