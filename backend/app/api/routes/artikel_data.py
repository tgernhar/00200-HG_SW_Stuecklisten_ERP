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
    page_size: int = Query(40, ge=1, le=100, description="Einträge pro Seite"),
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
    page_size: int = Query(40, ge=1, le=100, description="Einträge pro Seite"),
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
