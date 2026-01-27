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


# Pydantic models for status options (must be defined before use)
class OrderStatusOption(BaseModel):
    """Single status option for the filter dropdown"""
    id: int
    name: str
    is_default: bool = False


class OrderStatusOptionsResponse(BaseModel):
    """Response for status options"""
    items: List[OrderStatusOption]


@router.get("/orders/status-options", response_model=OrderStatusOptionsResponse)
async def get_order_status_options():
    """
    Get available order statuses for the filter dropdown.
    
    Returns all statuses that are used for orders, with is_default=True
    for the default filter selection.
    """
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Get all statuses used by orders with order_type='ORDER'
        query = """
            SELECT DISTINCT order_status.id, order_status.name
            FROM order_status
            WHERE order_status.id IN (
                SELECT DISTINCT ordertable.status
                FROM ordertable
                JOIN order_type ON order_type.id = ordertable.orderType
                WHERE order_type.name = 'ORDER'
                  AND ordertable.created > '2024-01-01'
            )
            ORDER BY order_status.name
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        
        items = [
            OrderStatusOption(
                id=row['id'],
                name=row['name'] or f"Status {row['id']}",
                is_default=row['id'] in VALID_ORDER_STATUS_IDS
            )
            for row in rows
        ]
        
        return OrderStatusOptionsResponse(items=items)
        
    except Exception as e:
        print(f"Error fetching status options: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Laden der Status-Optionen: {str(e)}"
        )
    finally:
        if connection:
            connection.close()


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
    # Deep filter match info for auto-expand
    match_level: Optional[str] = None  # 'order_article', 'bom_detail', 'workplan_detail'
    matched_article_ids: Optional[List[int]] = None  # order_article IDs that matched


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
    einzelmass: Optional[float] = None
    gesamtmenge: Optional[float] = None
    einheit: Optional[str] = None
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


# Valid status IDs for orders to be displayed (defaults)
# 1=Offen, 3=Gestoppt, 4=Geliefert, 14=Teilgeliefert, 15=Geliefert(BOOKING), 
# 16=Email Versendet, 26=Teilrechnung gestellt, 33=Zum liefern bereit, 37=Offen_TG30_geprüft
VALID_ORDER_STATUS_IDS = (1, 3, 4, 14, 15, 16, 26, 33, 37)


class OrderOverviewResponse(BaseModel):
    """Response for orders overview"""
    items: List[OrderOverviewItem]
    total: int


class DeepSearchResultItem(BaseModel):
    """Single item in deep search results table"""
    order_name: str
    order_article_number: str
    bom_article_number: Optional[str] = None
    bom_article_description: Optional[str] = None
    bom_quantity: Optional[float] = None
    einzelmass: Optional[float] = None
    gesamtmenge: Optional[float] = None
    einheit: Optional[str] = None
    match_source: str  # 'order_article', 'bom_detail', 'workplan_detail'
    order_id: int
    order_article_id: int
    bom_detail_id: Optional[int] = None


class DeepSearchResultsResponse(BaseModel):
    """Response for deep search results"""
    items: List[DeepSearchResultItem]
    total: int


@router.get("/orders/deep-search-results", response_model=DeepSearchResultsResponse)
async def get_deep_search_results(
    article_search: Optional[str] = Query(None, description="Suche in Artikelnummern/Bezeichnungen"),
    workstep_search: Optional[str] = Query(None, description="Suche in Arbeitsgängen"),
    status_ids: Optional[str] = Query(None, description="Status-IDs (kommagetrennt)")
):
    """
    Get flat results table for deep search filters.
    
    Returns a flat list of all matching BOM positions with their context
    (order name, order article number, etc.) for display in a results table.
    """
    # At least one search parameter required
    if not article_search and not workstep_search:
        return DeepSearchResultsResponse(items=[], total=0)
    
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Parse status_ids or use defaults
        if status_ids:
            try:
                active_status_ids = tuple(int(s.strip()) for s in status_ids.split(',') if s.strip())
                if not active_status_ids:
                    active_status_ids = VALID_ORDER_STATUS_IDS
            except ValueError:
                raise HTTPException(status_code=400, detail="Ungültiges Format für status_ids")
        else:
            active_status_ids = VALID_ORDER_STATUS_IDS
        
        status_placeholders = ','.join(['%s'] * len(active_status_ids))
        results = []
        
        # Search in BOM (packingnote_details) level
        if article_search:
            article_pattern = f"%{article_search}%"
            
            # Query for BOM-level matches
            bom_query = f"""
                SELECT DISTINCT
                    ordertable.name as order_name,
                    ordertable.id as order_id,
                    article_oa.articlenumber as order_article_number,
                    order_article.id as order_article_id,
                    article_bom.articlenumber as bom_article_number,
                    article_bom.description as bom_article_description,
                    packingnote_details.cascadedQuantity as bom_quantity,
                    packingnote_details.einzelmass,
                    (packingnote_details.einzelmass * packingnote_details.cascadedQuantity) as gesamtmenge,
                    calculation.name as einheit,
                    packingnote_details.id as bom_detail_id
                FROM ordertable
                JOIN order_type ON order_type.id = ordertable.orderType
                JOIN order_article_ref ON order_article_ref.orderid = ordertable.id
                JOIN order_article ON order_article_ref.orderArticleId = order_article.id
                JOIN article AS article_oa ON order_article.articleid = article_oa.id
                JOIN packingnote_relation ON packingnote_relation.packingNoteId = order_article.packingnoteid
                JOIN packingnote_details ON packingnote_details.id = packingnote_relation.detail
                LEFT JOIN article AS article_bom ON article_bom.id = packingnote_details.article
                LEFT JOIN calculation ON calculation.id = packingnote_details.calculation
                WHERE order_type.name = 'ORDER'
                  AND ordertable.status IN ({status_placeholders})
                  AND ordertable.created > '2024-01-01'
                  AND (article_bom.articlenumber LIKE %s OR article_bom.description LIKE %s)
                ORDER BY ordertable.name, order_article.position, packingnote_details.pos
                LIMIT 500
            """
            
            cursor.execute(bom_query, list(active_status_ids) + [article_pattern, article_pattern])
            bom_rows = cursor.fetchall()
            
            for row in bom_rows:
                results.append(DeepSearchResultItem(
                    order_name=row['order_name'] or '',
                    order_article_number=row['order_article_number'] or '',
                    bom_article_number=row.get('bom_article_number'),
                    bom_article_description=row.get('bom_article_description'),
                    bom_quantity=row.get('bom_quantity'),
                    einzelmass=row.get('einzelmass'),
                    gesamtmenge=row.get('gesamtmenge'),
                    einheit=row.get('einheit'),
                    match_source='bom_detail',
                    order_id=row['order_id'],
                    order_article_id=row['order_article_id'],
                    bom_detail_id=row.get('bom_detail_id')
                ))
        
        # Search in workstep level
        if workstep_search:
            workstep_pattern = f"%{workstep_search}%"
            
            workstep_query = f"""
                SELECT DISTINCT
                    ordertable.name as order_name,
                    ordertable.id as order_id,
                    article_oa.articlenumber as order_article_number,
                    order_article.id as order_article_id,
                    article_bom.articlenumber as bom_article_number,
                    article_bom.description as bom_article_description,
                    packingnote_details.cascadedQuantity as bom_quantity,
                    packingnote_details.einzelmass,
                    (packingnote_details.einzelmass * packingnote_details.cascadedQuantity) as gesamtmenge,
                    calculation.name as einheit,
                    packingnote_details.id as bom_detail_id,
                    workstep.name as workstep_name
                FROM ordertable
                JOIN order_type ON order_type.id = ordertable.orderType
                JOIN order_article_ref ON order_article_ref.orderid = ordertable.id
                JOIN order_article ON order_article_ref.orderArticleId = order_article.id
                JOIN article AS article_oa ON order_article.articleid = article_oa.id
                JOIN packingnote_relation ON packingnote_relation.packingNoteId = order_article.packingnoteid
                JOIN packingnote_details ON packingnote_details.id = packingnote_relation.detail
                LEFT JOIN article AS article_bom ON article_bom.id = packingnote_details.article
                LEFT JOIN calculation ON calculation.id = packingnote_details.calculation
                JOIN workplan ON workplan.packingnoteid = packingnote_details.id
                JOIN workplan_relation ON workplan_relation.workplanId = workplan.id
                JOIN workplan_details ON workplan_details.id = workplan_relation.detail
                LEFT JOIN qualificationitem ON qualificationitem.id = workplan_details.qualificationitem
                LEFT JOIN qualificationitem_workstep ON qualificationitem_workstep.item = qualificationitem.id
                LEFT JOIN workstep ON workstep.id = qualificationitem_workstep.workstep
                WHERE order_type.name = 'ORDER'
                  AND ordertable.status IN ({status_placeholders})
                  AND ordertable.created > '2024-01-01'
                  AND workstep.name LIKE %s
                ORDER BY ordertable.name, order_article.position, packingnote_details.pos
                LIMIT 500
            """
            
            cursor.execute(workstep_query, list(active_status_ids) + [workstep_pattern])
            workstep_rows = cursor.fetchall()
            
            # Add workstep results, avoiding duplicates
            existing_keys = {(r.order_id, r.order_article_id, r.bom_detail_id) for r in results}
            
            for row in workstep_rows:
                key = (row['order_id'], row['order_article_id'], row.get('bom_detail_id'))
                if key not in existing_keys:
                    results.append(DeepSearchResultItem(
                        order_name=row['order_name'] or '',
                        order_article_number=row['order_article_number'] or '',
                        bom_article_number=row.get('bom_article_number'),
                        bom_article_description=row.get('bom_article_description'),
                        bom_quantity=row.get('bom_quantity'),
                        einzelmass=row.get('einzelmass'),
                        gesamtmenge=row.get('gesamtmenge'),
                        einheit=row.get('einheit'),
                        match_source='workplan_detail',
                        order_id=row['order_id'],
                        order_article_id=row['order_article_id'],
                        bom_detail_id=row.get('bom_detail_id')
                    ))
                    existing_keys.add(key)
        
        cursor.close()
        
        return DeepSearchResultsResponse(items=results, total=len(results))
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in deep search: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler bei der Deep-Suche: {str(e)}"
        )
    finally:
        if connection:
            connection.close()


@router.get("/orders/overview", response_model=OrderOverviewResponse)
async def get_orders_overview(
    date_from: Optional[date] = Query(None, description="Filter: Liefertermin ab"),
    date_to: Optional[date] = Query(None, description="Filter: Liefertermin bis"),
    responsible: Optional[str] = Query(None, description="Filter: AU-Verantwortlicher (loginname)"),
    customer: Optional[str] = Query(None, description="Filter: Kunde (Suchname)"),
    order_name: Optional[str] = Query(None, description="Filter: Auftragsnummer"),
    text: Optional[str] = Query(None, description="Filter: Auftragstext"),
    reference: Optional[str] = Query(None, description="Filter: Referenz"),
    status_ids: Optional[str] = Query(None, description="Filter: Status-IDs (kommagetrennt, z.B. '1,3,4')"),
    article_search: Optional[str] = Query(None, description="Deep-Filter: Suche in Artikelnummern/Bezeichnungen"),
    workstep_search: Optional[str] = Query(None, description="Deep-Filter: Suche in Arbeitsgängen"),
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
        
        # Parse status_ids parameter or use defaults
        if status_ids:
            try:
                active_status_ids = tuple(int(s.strip()) for s in status_ids.split(',') if s.strip())
                if not active_status_ids:
                    active_status_ids = VALID_ORDER_STATUS_IDS
            except ValueError:
                raise HTTPException(status_code=400, detail="Ungültiges Format für status_ids")
        else:
            active_status_ids = VALID_ORDER_STATUS_IDS
        
        # Build the query
        # Note: MySQL 5.5 doesn't support ROW_NUMBER(), so we'll enumerate in Python
        # Filter: order_type.name = 'ORDER' AND status IN (selected_status_ids)
        # AND created > '2024-01-01' (only recent orders)
        status_placeholders = ','.join(['%s'] * len(active_status_ids))
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
        
        params = list(active_status_ids)
        
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
        
        # Deep-Filter: article_search (searches in order_article and packingnote_details level)
        if article_search:
            article_search_pattern = f"%{article_search}%"
            query += """ AND (
                EXISTS (
                    SELECT 1 FROM order_article_ref oar
                    JOIN order_article oa ON oar.orderArticleId = oa.id
                    JOIN article a ON oa.articleid = a.id
                    WHERE oar.orderid = ordertable.id
                      AND (a.articlenumber LIKE %s OR a.description LIKE %s)
                )
                OR EXISTS (
                    SELECT 1 FROM order_article_ref oar
                    JOIN order_article oa ON oar.orderArticleId = oa.id
                    JOIN packingnote_relation pnr ON pnr.packingNoteId = oa.packingnoteid
                    JOIN packingnote_details pd ON pd.id = pnr.detail
                    LEFT JOIN article a ON a.id = pd.article
                    WHERE oar.orderid = ordertable.id
                      AND (a.articlenumber LIKE %s OR a.description LIKE %s)
                )
            )"""
            params.extend([article_search_pattern, article_search_pattern, 
                          article_search_pattern, article_search_pattern])
        
        # Deep-Filter: workstep_search (searches in workstep level)
        if workstep_search:
            workstep_search_pattern = f"%{workstep_search}%"
            query += """ AND EXISTS (
                SELECT 1 FROM order_article_ref oar
                JOIN order_article oa ON oar.orderArticleId = oa.id
                JOIN packingnote_relation pnr ON pnr.packingNoteId = oa.packingnoteid
                JOIN packingnote_details pd ON pd.id = pnr.detail
                JOIN workplan wp ON wp.packingnoteid = pd.id
                JOIN workplan_relation wpr ON wpr.workplanId = wp.id
                JOIN workplan_details wpd ON wpd.id = wpr.detail
                LEFT JOIN qualificationitem qi ON qi.id = wpd.qualificationitem
                LEFT JOIN qualificationitem_workstep qiws ON qiws.item = qi.id
                LEFT JOIN workstep ws ON ws.id = qiws.workstep
                WHERE oar.orderid = ordertable.id
                  AND ws.name LIKE %s
            )"""
            params.append(workstep_search_pattern)
        
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
        count_params = list(active_status_ids)
        
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
        
        # Deep-Filter: article_search for count
        if article_search:
            article_search_pattern = f"%{article_search}%"
            count_query += """ AND (
                EXISTS (
                    SELECT 1 FROM order_article_ref oar
                    JOIN order_article oa ON oar.orderArticleId = oa.id
                    JOIN article a ON oa.articleid = a.id
                    WHERE oar.orderid = ordertable.id
                      AND (a.articlenumber LIKE %s OR a.description LIKE %s)
                )
                OR EXISTS (
                    SELECT 1 FROM order_article_ref oar
                    JOIN order_article oa ON oar.orderArticleId = oa.id
                    JOIN packingnote_relation pnr ON pnr.packingNoteId = oa.packingnoteid
                    JOIN packingnote_details pd ON pd.id = pnr.detail
                    LEFT JOIN article a ON a.id = pd.article
                    WHERE oar.orderid = ordertable.id
                      AND (a.articlenumber LIKE %s OR a.description LIKE %s)
                )
            )"""
            count_params.extend([article_search_pattern, article_search_pattern, 
                                article_search_pattern, article_search_pattern])
        
        # Deep-Filter: workstep_search for count
        if workstep_search:
            workstep_search_pattern = f"%{workstep_search}%"
            count_query += """ AND EXISTS (
                SELECT 1 FROM order_article_ref oar
                JOIN order_article oa ON oar.orderArticleId = oa.id
                JOIN packingnote_relation pnr ON pnr.packingNoteId = oa.packingnoteid
                JOIN packingnote_details pd ON pd.id = pnr.detail
                JOIN workplan wp ON wp.packingnoteid = pd.id
                JOIN workplan_relation wpr ON wpr.workplanId = wp.id
                JOIN workplan_details wpd ON wpd.id = wpr.detail
                LEFT JOIN qualificationitem qi ON qi.id = wpd.qualificationitem
                LEFT JOIN qualificationitem_workstep qiws ON qiws.item = qi.id
                LEFT JOIN workstep ws ON ws.id = qiws.workstep
                WHERE oar.orderid = ordertable.id
                  AND ws.name LIKE %s
            )"""
            count_params.append(workstep_search_pattern)
        
        cursor.execute(count_query, count_params)
        total_result = cursor.fetchone()
        total = total_result['total'] if total_result else 0
        
        # If deep filters are active, calculate match_level and matched_article_ids
        match_info = {}
        if article_search or workstep_search:
            order_ids = [row.get('order_id') for row in rows if row.get('order_id')]
            if order_ids:
                # Determine match level and matched article IDs for each order
                for order_id in order_ids:
                    match_level = None
                    matched_ids = []
                    
                    # Check workstep level first (deepest)
                    if workstep_search:
                        workstep_pattern = f"%{workstep_search}%"
                        cursor.execute("""
                            SELECT DISTINCT oa.id as order_article_id
                            FROM order_article_ref oar
                            JOIN order_article oa ON oar.orderArticleId = oa.id
                            JOIN packingnote_relation pnr ON pnr.packingNoteId = oa.packingnoteid
                            JOIN packingnote_details pd ON pd.id = pnr.detail
                            JOIN workplan wp ON wp.packingnoteid = pd.id
                            JOIN workplan_relation wpr ON wpr.workplanId = wp.id
                            JOIN workplan_details wpd ON wpd.id = wpr.detail
                            LEFT JOIN qualificationitem qi ON qi.id = wpd.qualificationitem
                            LEFT JOIN qualificationitem_workstep qiws ON qiws.item = qi.id
                            LEFT JOIN workstep ws ON ws.id = qiws.workstep
                            WHERE oar.orderid = %s AND ws.name LIKE %s
                        """, (order_id, workstep_pattern))
                        workstep_matches = cursor.fetchall()
                        if workstep_matches:
                            match_level = 'workplan_detail'
                            matched_ids = [r['order_article_id'] for r in workstep_matches]
                    
                    # Check BOM level
                    if article_search:
                        article_pattern = f"%{article_search}%"
                        # Check order_article level
                        cursor.execute("""
                            SELECT DISTINCT oa.id as order_article_id
                            FROM order_article_ref oar
                            JOIN order_article oa ON oar.orderArticleId = oa.id
                            JOIN article a ON oa.articleid = a.id
                            WHERE oar.orderid = %s
                              AND (a.articlenumber LIKE %s OR a.description LIKE %s)
                        """, (order_id, article_pattern, article_pattern))
                        article_matches = cursor.fetchall()
                        if article_matches:
                            if not match_level:
                                match_level = 'order_article'
                            matched_ids = list(set(matched_ids + [r['order_article_id'] for r in article_matches]))
                        
                        # Check packingnote_details (BOM) level
                        cursor.execute("""
                            SELECT DISTINCT oa.id as order_article_id
                            FROM order_article_ref oar
                            JOIN order_article oa ON oar.orderArticleId = oa.id
                            JOIN packingnote_relation pnr ON pnr.packingNoteId = oa.packingnoteid
                            JOIN packingnote_details pd ON pd.id = pnr.detail
                            LEFT JOIN article a ON a.id = pd.article
                            WHERE oar.orderid = %s
                              AND (a.articlenumber LIKE %s OR a.description LIKE %s)
                        """, (order_id, article_pattern, article_pattern))
                        bom_matches = cursor.fetchall()
                        if bom_matches:
                            if not match_level or match_level == 'order_article':
                                match_level = 'bom_detail'
                            matched_ids = list(set(matched_ids + [r['order_article_id'] for r in bom_matches]))
                    
                    if match_level:
                        match_info[order_id] = {
                            'match_level': match_level,
                            'matched_article_ids': matched_ids
                        }
        
        cursor.close()
        
        # Transform rows to response items with position numbers
        items = []
        for idx, row in enumerate(rows, start=skip + 1):
            order_id = row.get('order_id')
            info = match_info.get(order_id, {})
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
                order_id=order_id,
                status_name=row.get('status_name'),
                reference=row.get('reference'),
                has_articles=bool(row.get('has_articles', 0)),
                match_level=info.get('match_level'),
                matched_article_ids=info.get('matched_article_ids')
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
                packingnote_details.einzelmass,
                (packingnote_details.einzelmass * packingnote_details.cascadedQuantity) as gesamtmenge,
                calculation.name as einheit,
                packingnote_relation.lft,
                packingnote_relation.rgt,
                packingnote_details.id as detail_id,
                order_article.packingnoteid as packingnote_id,
                (SELECT COUNT(*) > 0 FROM workplan WHERE workplan.packingnoteid = packingnote_details.id) as has_workplan
            FROM order_article
            JOIN packingnote_relation ON packingnote_relation.packingNoteId = order_article.packingnoteid
            JOIN packingnote_details ON packingnote_details.id = packingnote_relation.detail
            LEFT JOIN article ON article.id = packingnote_details.article
            LEFT JOIN calculation ON calculation.id = packingnote_details.calculation
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
                einzelmass=row.get('einzelmass'),
                gesamtmenge=row.get('gesamtmenge'),
                einheit=row.get('einheit'),
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
