"""
Stücklisten Data API Routes
Provides endpoints for Stücklisten module (BOM data from HUGWAWI).
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.core.database import get_erp_db_connection
from app.services import stuecklisten_service

router = APIRouter()


@router.get("/materialgroups/autocomplete")
async def materialgroups_autocomplete(
    search: str = Query(..., min_length=1, description="Suchbegriff für Warengruppe")
):
    """
    Autocomplete für Warengruppen.
    Sucht in article_materialgroup.name.
    
    Returns:
        List of {id, name}
    """
    erp_connection = get_erp_db_connection()
    try:
        results = stuecklisten_service.get_materialgroups_for_autocomplete(
            db_connection=erp_connection,
            search_term=search,
            limit=50
        )
        return results
    finally:
        erp_connection.close()


@router.get("/articles/autocomplete")
async def articles_autocomplete(
    search: str = Query(..., min_length=1, description="Suchbegriff für Artikelnummer"),
    materialgroup_id: Optional[int] = Query(None, description="Optional: Filter by Warengruppe ID")
):
    """
    Autocomplete für Artikelnummern.
    Sucht in article.articlenumber.
    
    Returns:
        List of {id, articlenumber, index, description}
    """
    erp_connection = get_erp_db_connection()
    try:
        results = stuecklisten_service.get_articles_for_autocomplete(
            db_connection=erp_connection,
            search_term=search,
            materialgroup_id=materialgroup_id,
            limit=50
        )
        return results
    finally:
        erp_connection.close()


@router.get("/search")
async def search_stuecklisten(
    materialgroup_id: Optional[int] = Query(None, description="Filter by Warengruppe ID"),
    articlenumber: Optional[str] = Query(None, description="Filter by Artikelnummer (LIKE search)"),
    is_sub: Optional[bool] = Query(None, description="Filter by Unterartikel (packingnote.isSub)")
):
    """
    Sucht Artikel die eine Stückliste (packingnote) haben.
    
    Filter:
    - materialgroup_id: Warengruppe (article.materialgroup)
    - articlenumber: Artikelnummer (article.articlenumber, LIKE)
    - is_sub: Unterartikel-Filter (packingnote.isSub)
    
    Returns:
        List of {article_id, article_display, description, packingnote_id, is_sub}
    """
    erp_connection = get_erp_db_connection()
    try:
        results = stuecklisten_service.search_articles_with_bom(
            db_connection=erp_connection,
            materialgroup_id=materialgroup_id,
            articlenumber=articlenumber,
            is_sub=is_sub
        )
        return results
    finally:
        erp_connection.close()


@router.get("/{packingnote_id}/content")
async def get_bom_content(
    packingnote_id: int
):
    """
    Lädt BOM-Inhalt mit Hierarchie für eine packingnote.
    
    Die Ebenen werden aus dem Nested Set (lft/rgt) berechnet:
    - Ebene 0 = Root (pos_level1)
    - Ebene 1 = pos_level2
    - Ebene 2 = pos_level3
    - Ebene 3+ = pos_level4
    
    Returns:
        List of BOM items:
        {detail_id, level, pos, pos_level1, pos_level2, pos_level3, pos_level4,
         article_display, nettoamount, factor, purchaseprice, salesfactor}
    """
    erp_connection = get_erp_db_connection()
    try:
        results = stuecklisten_service.get_bom_content(
            db_connection=erp_connection,
            packingnote_id=packingnote_id
        )
        return results
    finally:
        erp_connection.close()
