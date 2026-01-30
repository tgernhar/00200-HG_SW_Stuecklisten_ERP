"""
Artikel Data API Routes
Provides endpoints for Artikel module (article and materialgroup from HUGWAWI).
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.core.database import get_erp_db_connection
from app.services import artikel_data_service

router = APIRouter()


@router.get("/articles/search")
async def search_articles(
    articlenumber: Optional[str] = Query(None, description="Artikel-Nr (article.articlenumber)"),
    index_filter: Optional[str] = Query(None, description="Index (article.index)"),
    barcode: Optional[str] = Query(None, description="Barcode (Prefix 001 wird entfernt, sucht in article.id)"),
    description: Optional[str] = Query(None, description="Beschreibung/Teilenummer (article.description, article.sparepart)"),
    customer: Optional[str] = Query(None, description="Kundensuche (adrbase.suchname via article.kid)"),
    din_en_iso: Optional[str] = Query(None, description="DIN/EN/ISO/EN-ISO Suchwert"),
    din_checked: bool = Query(True, description="DIN-Spalte durchsuchen"),
    en_checked: bool = Query(True, description="EN-Spalte durchsuchen"),
    iso_checked: bool = Query(True, description="ISO-Spalte durchsuchen"),
    eniso_checked: bool = Query(True, description="EN-ISO-Spalte durchsuchen"),
    distributor_articlenumber: Optional[str] = Query(None, description="Lieferanten Artikel-Nr (article_distributor.distributorarticlenumber)"),
    materialgroup_search: Optional[str] = Query(None, description="Warengruppensuche (article_materialgroup.name, description)"),
    show_inactive: bool = Query(False, description="Zeige inaktive Artikel (article.active != 1)"),
    extended_limit: bool = Query(False, description="Mehr als 500 anzeigen (bis 10000)"),
    page: int = Query(1, ge=1, description="Seite"),
    page_size: int = Query(40, ge=1, le=10000, description="Einträge pro Seite (max 10000 für Autofilter)"),
    sort_field: str = Query("articlenumber", description="Sortierfeld"),
    sort_dir: str = Query("asc", description="Sortierrichtung (asc/desc)")
):
    """
    Hauptsuche für Artikel mit allen Filtern und Pagination.
    
    Suchfelder:
    - Artikel-Nr: article.articlenumber
    - Index: article.index
    - Barcode: article.id (Prefix "001" wird automatisch entfernt)
    - Beschreibung/Teilenummer: article.description, article.sparepart
    - Kundensuche: adrbase.suchname via article.kid
    - DIN/EN/ISO/EN-ISO: article.din, article.en, article.iso, article.eniso
    - Lieferanten Artikel-Nr: article_distributor.distributorarticlenumber
    - Warengruppensuche: article_materialgroup.name, article_materialgroup.description
    
    Returns:
        {items: [...], total: int, page: int, page_size: int, total_pages: int, limit_applied: int}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = artikel_data_service.search_articles(
            db_connection=erp_connection,
            articlenumber=articlenumber,
            index_filter=index_filter,
            barcode=barcode,
            description=description,
            customer=customer,
            din_en_iso=din_en_iso,
            din_checked=din_checked,
            en_checked=en_checked,
            iso_checked=iso_checked,
            eniso_checked=eniso_checked,
            distributor_articlenumber=distributor_articlenumber,
            materialgroup_search=materialgroup_search,
            show_inactive=show_inactive,
            extended_limit=extended_limit,
            page=page,
            page_size=page_size,
            sort_field=sort_field,
            sort_dir=sort_dir
        )
        return result
    finally:
        erp_connection.close()


@router.get("/materialgroups/search")
async def search_materialgroups(
    name: Optional[str] = Query(None, description="Bezeichnung (article_materialgroup.name)"),
    description: Optional[str] = Query(None, description="Beschreibung (article_materialgroup.description)"),
    old_materialgroup: Optional[str] = Query(None, description="Alte Warengruppe (article_materialgroup.oldmaterialgroupid)"),
    new_materialgroup: Optional[str] = Query(None, description="Neue Warengruppe (article_materialgroup.articlenumberPrefix)"),
    show_inactive: bool = Query(False, description="Zeige inaktive Warengruppen"),
    show_master_only: bool = Query(False, description="Zeige nur Master-Warengruppen (isMasterGroup=1)"),
    page: int = Query(1, ge=1, description="Seite"),
    page_size: int = Query(40, ge=1, le=10000, description="Einträge pro Seite (max 10000 für Autofilter)"),
    sort_field: str = Query("name", description="Sortierfeld"),
    sort_dir: str = Query("asc", description="Sortierrichtung (asc/desc)")
):
    """
    Suche für Warengruppen mit allen Filtern und Pagination.
    
    Suchfelder:
    - Bezeichnung: article_materialgroup.name
    - Beschreibung: article_materialgroup.description
    - Alte Warengruppe: article_materialgroup.oldmaterialgroupid
    - Neue Warengruppe: article_materialgroup.articlenumberPrefix
    
    Returns:
        {items: [...], total: int, page: int, page_size: int, total_pages: int}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = artikel_data_service.search_materialgroups(
            db_connection=erp_connection,
            name=name,
            description=description,
            old_materialgroup=old_materialgroup,
            new_materialgroup=new_materialgroup,
            show_inactive=show_inactive,
            show_master_only=show_master_only,
            page=page,
            page_size=page_size,
            sort_field=sort_field,
            sort_dir=sort_dir
        )
        return result
    finally:
        erp_connection.close()


# ============ Static routes BEFORE dynamic routes ============

@router.get("/departments")
async def get_departments():
    """
    Returns all departments for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = artikel_data_service.get_departments(erp_connection)
        return result
    finally:
        erp_connection.close()


@router.get("/calculation-types")
async def get_calculation_types():
    """
    Returns all calculation types (units) for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = artikel_data_service.get_calculation_types(erp_connection)
        return result
    finally:
        erp_connection.close()


@router.get("/materialgroups/dropdown")
async def get_materialgroups_for_dropdown(
    search: Optional[str] = Query(None, description="Search term for materialgroup name"),
    limit: int = Query(50, ge=1, le=200, description="Max results")
):
    """
    Returns materialgroups for dropdown/autocomplete selection.
    
    Args:
        search: Optional filter for name
        limit: Max results to return
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = artikel_data_service.get_materialgroups_for_dropdown(erp_connection, search, limit)
        return result
    finally:
        erp_connection.close()


@router.get("/customers/search")
async def search_customers(
    term: str = Query(..., description="Search term for customer suchname"),
    limit: int = Query(20, ge=1, le=100, description="Max results")
):
    """
    Searches customers (adrbase) by suchname for autocomplete.
    
    Args:
        term: Search term
        limit: Max results to return
    
    Returns:
        List of {id: int, suchname: str, kdn: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = artikel_data_service.search_customers(erp_connection, term, limit)
        return result
    finally:
        erp_connection.close()


# ============ Dynamic routes AFTER static routes ============

@router.get("/{article_id}")
async def get_article_detail(article_id: int):
    """
    Returns all detail data for a single article.
    
    Args:
        article_id: The article.id
    
    Returns:
        Complete article data with all fields and joined names
    """
    erp_connection = get_erp_db_connection()
    try:
        result = artikel_data_service.get_article_detail(erp_connection, article_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Article {article_id} not found")
        return result
    finally:
        erp_connection.close()


@router.get("/{article_id}/custom-field-labels")
async def get_custom_field_labels(article_id: int):
    """
    Returns custom field labels and configuration for the article's materialgroup.
    
    Args:
        article_id: The article.id (used to get materialgroup)
    
    Returns:
        List of field configurations with labels
    """
    erp_connection = get_erp_db_connection()
    try:
        # First get the article to find its materialgroup
        article = artikel_data_service.get_article_detail(erp_connection, article_id)
        if not article:
            raise HTTPException(status_code=404, detail=f"Article {article_id} not found")
        
        materialgroup_id = article.get('materialgroup')
        if not materialgroup_id:
            return []  # No materialgroup, no custom field labels
        
        result = artikel_data_service.get_custom_field_labels(erp_connection, materialgroup_id)
        return result
    finally:
        erp_connection.close()


@router.get("/{article_id}/calculations")
async def get_calculations_for_article(article_id: int):
    """
    Returns calculations (VK-Berechnung) for the article's materialgroup.
    
    Args:
        article_id: The article.id (used to get materialgroup)
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        # First get the article to find its materialgroup
        article = artikel_data_service.get_article_detail(erp_connection, article_id)
        if not article:
            raise HTTPException(status_code=404, detail=f"Article {article_id} not found")
        
        materialgroup_id = article.get('materialgroup')
        if not materialgroup_id:
            return []
        
        result = artikel_data_service.get_calculations_for_materialgroup(erp_connection, materialgroup_id)
        return result
    finally:
        erp_connection.close()
