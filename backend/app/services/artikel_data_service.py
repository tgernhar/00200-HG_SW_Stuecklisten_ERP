"""
Artikel Data Service Layer
Provides access to article and materialgroup data from HUGWAWI for Artikel module.
"""
from app.core.database import get_erp_db_connection
from typing import Optional, List, Dict, Any


def search_articles(
    db_connection,
    articlenumber: Optional[str] = None,
    index_filter: Optional[str] = None,
    barcode: Optional[str] = None,
    description: Optional[str] = None,
    customer: Optional[str] = None,
    din_en_iso: Optional[str] = None,
    din_checked: bool = True,
    en_checked: bool = True,
    iso_checked: bool = True,
    eniso_checked: bool = True,
    distributor_articlenumber: Optional[str] = None,
    materialgroup_search: Optional[str] = None,
    show_inactive: bool = False,
    extended_limit: bool = False,
    page: int = 1,
    page_size: int = 40,
    sort_field: str = "articlenumber",
    sort_dir: str = "asc"
) -> Dict[str, Any]:
    """
    Hauptsuchfunktion für Artikel mit allen Filtern und Pagination.
    
    Args:
        articlenumber: Suche in article.articlenumber
        index_filter: Suche in article.index
        barcode: Barcode-Suche (Prefix "001" wird entfernt, dann Suche in article.id)
        description: Suche in article.description und article.sparepart
        customer: Suche in adrbase.suchname via article.kid
        din_en_iso: Suchwert für DIN/EN/ISO/EN-ISO Spalten
        din_checked, en_checked, iso_checked, eniso_checked: Welche Spalten durchsucht werden
        distributor_articlenumber: Suche in article_distributor.distributorarticlenumber
        materialgroup_search: Suche in article_materialgroup.name und description
        show_inactive: True = alle anzeigen, False = nur article.active=1
        extended_limit: True = bis 10000, False = max 500
        page, page_size: Pagination
        sort_field, sort_dir: Sortierung
    
    Returns:
        {items: [...], total: int, page: int, page_size: int, total_pages: int}
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        # Build WHERE clause
        conditions = []
        params = []
        
        # Filter by articlenumber
        if articlenumber:
            conditions.append("a.articlenumber LIKE %s")
            params.append(f"%{articlenumber}%")
        
        # Filter by index
        if index_filter:
            conditions.append("a.`index` LIKE %s")
            params.append(f"%{index_filter}%")
        
        # Filter by barcode (remove prefix "001" and search in article.id)
        if barcode:
            # Remove prefix "001" if present
            barcode_value = barcode
            if barcode.startswith("001"):
                barcode_value = barcode[3:]
            try:
                barcode_id = int(barcode_value)
                conditions.append("a.id = %s")
                params.append(barcode_id)
            except ValueError:
                # If not a valid number, search as string
                conditions.append("CAST(a.id AS CHAR) LIKE %s")
                params.append(f"%{barcode_value}%")
        
        # Filter by description/teilenummer
        if description:
            conditions.append("(a.description LIKE %s OR a.sparepart LIKE %s)")
            params.extend([f"%{description}%", f"%{description}%"])
        
        # Filter by customer (via adrbase.suchname)
        if customer:
            conditions.append("ab.suchname LIKE %s")
            params.append(f"%{customer}%")
        
        # Filter by DIN/EN/ISO/EN-ISO
        if din_en_iso:
            din_conditions = []
            if din_checked:
                din_conditions.append("a.din LIKE %s")
                params.append(f"%{din_en_iso}%")
            if en_checked:
                din_conditions.append("a.en LIKE %s")
                params.append(f"%{din_en_iso}%")
            if iso_checked:
                din_conditions.append("a.iso LIKE %s")
                params.append(f"%{din_en_iso}%")
            if eniso_checked:
                din_conditions.append("a.eniso LIKE %s")
                params.append(f"%{din_en_iso}%")
            if din_conditions:
                conditions.append(f"({' OR '.join(din_conditions)})")
        
        # Filter by distributor articlenumber
        if distributor_articlenumber:
            conditions.append("ad.distributorarticlenumber LIKE %s")
            params.append(f"%{distributor_articlenumber}%")
        
        # Filter by materialgroup (name or description)
        if materialgroup_search:
            conditions.append("(mg.name LIKE %s OR mg.description LIKE %s)")
            params.extend([f"%{materialgroup_search}%", f"%{materialgroup_search}%"])
        
        # Filter by active status
        if not show_inactive:
            conditions.append("a.active = 1")
        
        # Build WHERE clause
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Validate sort field to prevent SQL injection
        allowed_sort_fields = {
            "articlenumber": "a.articlenumber",
            "index": "a.`index`",
            "materialgroup": "mg.name",
            "description": "a.description",
            "customer": "ab.suchname",
            "sparepart": "a.sparepart"
        }
        sort_column = allowed_sort_fields.get(sort_field, "a.articlenumber")
        sort_direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
        
        # Calculate pagination
        max_limit = 10000 if extended_limit else 500
        effective_page_size = min(page_size, max_limit)
        offset = (page - 1) * effective_page_size
        
        # Main query with SQL_CALC_FOUND_ROWS
        items_query = f"""
            SELECT SQL_CALC_FOUND_ROWS 
                a.id,
                a.articlenumber,
                a.`index`,
                a.description,
                a.sparepart,
                a.din,
                a.en,
                a.iso,
                a.eniso,
                a.active,
                a.kid,
                mg.id AS materialgroup_id,
                mg.name AS materialgroup_name,
                ab.suchname AS customer_name
            FROM article a
            LEFT JOIN article_materialgroup mg ON a.materialgroup = mg.id
            LEFT JOIN adrbase ab ON a.kid = ab.id
            LEFT JOIN article_distributor ad ON a.id = ad.articleid
            {where_clause}
            GROUP BY a.id
            ORDER BY {sort_column} {sort_direction}
            LIMIT %s OFFSET %s
        """
        
        cursor.execute(items_query, params + [effective_page_size, offset])
        items = cursor.fetchall() or []
        
        # Get total count
        cursor.execute("SELECT FOUND_ROWS() as total")
        total_result = cursor.fetchone()
        total = min(total_result["total"] if total_result else 0, max_limit)
        
        total_pages = (total + effective_page_size - 1) // effective_page_size if total > 0 else 1
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": effective_page_size,
            "total_pages": total_pages,
            "limit_applied": max_limit
        }
        
    finally:
        cursor.close()


def search_materialgroups(
    db_connection,
    name: Optional[str] = None,
    description: Optional[str] = None,
    old_materialgroup: Optional[str] = None,
    new_materialgroup: Optional[str] = None,
    show_inactive: bool = False,
    show_master_only: bool = False,
    page: int = 1,
    page_size: int = 40,
    sort_field: str = "name",
    sort_dir: str = "asc"
) -> Dict[str, Any]:
    """
    Suchfunktion für Warengruppen mit allen Filtern und Pagination.
    
    Args:
        name: Suche in article_materialgroup.name
        description: Suche in article_materialgroup.description
        old_materialgroup: Suche in article_materialgroup.oldmaterialgroupid
        new_materialgroup: Suche in article_materialgroup.articlenumberPrefix
        show_inactive: True = alle anzeigen, False = nur active=1
        show_master_only: True = nur isMasterGroup=1, False = alle
        page, page_size: Pagination
        sort_field, sort_dir: Sortierung
    
    Returns:
        {items: [...], total: int, page: int, page_size: int, total_pages: int}
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        # Build WHERE clause
        conditions = []
        params = []
        
        # Filter by name
        if name:
            conditions.append("mg.name LIKE %s")
            params.append(f"%{name}%")
        
        # Filter by description
        if description:
            conditions.append("mg.description LIKE %s")
            params.append(f"%{description}%")
        
        # Filter by old materialgroup
        if old_materialgroup:
            conditions.append("mg.oldmaterialgroupid LIKE %s")
            params.append(f"%{old_materialgroup}%")
        
        # Filter by new materialgroup (articlenumberPrefix)
        if new_materialgroup:
            conditions.append("mg.articlenumberPrefix LIKE %s")
            params.append(f"%{new_materialgroup}%")
        
        # Filter by active status
        if not show_inactive:
            conditions.append("mg.active = 1")
        
        # Filter by master group
        if show_master_only:
            conditions.append("mg.isMasterGroup = 1")
        
        # Build WHERE clause
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Validate sort field to prevent SQL injection
        allowed_sort_fields = {
            "name": "mg.name",
            "description": "mg.description",
            "old_materialgroup": "mg.oldmaterialgroupid",
            "new_materialgroup": "mg.articlenumberPrefix",
            "showarticleindex": "mg.showarticleindex"
        }
        sort_column = allowed_sort_fields.get(sort_field, "mg.name")
        sort_direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
        
        # Calculate pagination
        offset = (page - 1) * page_size
        
        # Main query
        items_query = f"""
            SELECT SQL_CALC_FOUND_ROWS 
                mg.id,
                mg.name,
                mg.description,
                mg.oldmaterialgroupid,
                mg.articlenumberPrefix,
                mg.showarticleindex,
                mg.active,
                mg.isMasterGroup,
                mg.hasgeneratedarticlenumber
            FROM article_materialgroup mg
            {where_clause}
            ORDER BY {sort_column} {sort_direction}
            LIMIT %s OFFSET %s
        """
        
        cursor.execute(items_query, params + [page_size, offset])
        items = cursor.fetchall() or []
        
        # Get total count
        cursor.execute("SELECT FOUND_ROWS() as total")
        total_result = cursor.fetchone()
        total = total_result["total"] if total_result else 0
        
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
        
    finally:
        cursor.close()
