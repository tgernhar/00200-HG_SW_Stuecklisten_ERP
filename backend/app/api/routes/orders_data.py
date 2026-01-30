"""
Orders Data API Routes
Provides endpoints for Auftragsdaten module (ordertable from HUGWAWI).
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from datetime import date
from app.core.database import get_erp_db_connection
from app.services import orders_data_service

router = APIRouter()


@router.get("/document-types")
async def get_document_types():
    """
    Lädt alle Dokumenttypen aus billing_documenttype.
    
    Returns:
        Liste mit {id, name} für jeden Dokumenttyp
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_document_types(erp_connection)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/statuses")
async def get_statuses(
    order_type: Optional[int] = Query(None, description="Filter nach Dokumenttyp")
):
    """
    Lädt Status-Optionen aus order_status.
    
    Args:
        order_type: Optional - filtert nach ordertype
        
    Returns:
        Liste mit {id, name, color, isClosed}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_order_statuses(erp_connection, order_type)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/addresses")
async def get_addresses(
    kid: int = Query(..., description="Kunden-ID (adrbase.id)")
):
    """
    Lädt alle Adressen eines Kunden.
    
    Args:
        kid: Kunden-ID (adrbase.id)
        
    Returns:
        Liste mit {id, suchname, line1, city}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_addresses_for_customer(erp_connection, kid)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/contacts")
async def get_contacts(
    kid: int = Query(..., description="Kunden-ID (adrbase.id)")
):
    """
    Lädt alle Kontakte eines Kunden.
    
    Args:
        kid: Kunden-ID (adrbase.id)
        
    Returns:
        Liste mit {id, suchname, name, prename, function}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_contacts_for_customer(erp_connection, kid)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/backoffice-users")
async def get_backoffice_users():
    """
    Lädt alle Backoffice-Mitarbeiter (userlogin), gruppiert nach Abteilung.
    
    Returns:
        Liste mit {id, loginname, department_id, department_name}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_backoffice_users(erp_connection)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/customers")
async def search_customers(
    q: str = Query(..., description="Suchbegriff"),
    limit: int = Query(50, description="Maximale Anzahl Ergebnisse")
):
    """
    Sucht Kunden nach Name oder Kundennummer.
    
    Args:
        q: Suchbegriff (wird in suchname und kdn gesucht)
        limit: Maximale Anzahl Ergebnisse
        
    Returns:
        Liste mit {id, suchname, kdn}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.search_customers(erp_connection, q, limit)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/search")
async def search_orders(
    order_types: Optional[str] = Query(None, description="Kommagetrennte Dokumenttyp-IDs"),
    year: Optional[int] = Query(None, description="Jahr (Standard: aktuelles Jahr)"),
    name: Optional[str] = Query(None, description="Angebots-/Auftragsnummer"),
    text: Optional[str] = Query(None, description="Freitext"),
    customer: Optional[str] = Query(None, description="Kundenname oder Kundennummer"),
    address_id: Optional[int] = Query(None, description="Adress-ID (adrline.id)"),
    contact_id: Optional[int] = Query(None, description="Kontakt-ID (adrcont.id)"),
    price_min: Optional[float] = Query(None, description="Preis von"),
    price_max: Optional[float] = Query(None, description="Preis bis"),
    reference: Optional[str] = Query(None, description="Referenz"),
    date_from: Optional[date] = Query(None, description="Lieferdatum von"),
    date_to: Optional[date] = Query(None, description="Lieferdatum bis"),
    backoffice_id: Optional[int] = Query(None, description="Backoffice-Mitarbeiter-ID"),
    status_ids: Optional[str] = Query(None, description="Kommagetrennte Status-IDs"),
    page: int = Query(1, ge=1, description="Seite"),
    page_size: int = Query(40, ge=1, le=100, description="Einträge pro Seite"),
    sort_field: str = Query("created", description="Sortierfeld"),
    sort_dir: str = Query("desc", description="Sortierrichtung (asc/desc)")
):
    """
    Hauptsuche für Auftragsdaten mit allen Filtern und Pagination.
    
    Returns:
        {items: [...], total: int, page: int, page_size: int, total_pages: int}
    """
    # Parse comma-separated IDs
    order_types_list = None
    if order_types:
        try:
            order_types_list = [int(x.strip()) for x in order_types.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid order_types format")
    
    status_ids_list = None
    if status_ids:
        try:
            status_ids_list = [int(x.strip()) for x in status_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status_ids format")
    
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.search_orders(
            db_connection=erp_connection,
            order_types=order_types_list,
            year=year,
            name=name,
            text=text,
            customer=customer,
            address_id=address_id,
            contact_id=contact_id,
            price_min=price_min,
            price_max=price_max,
            reference=reference,
            date_from=date_from,
            date_to=date_to,
            backoffice_id=backoffice_id,
            status_ids=status_ids_list,
            page=page,
            page_size=page_size,
            sort_field=sort_field,
            sort_dir=sort_dir
        )
        return result
    finally:
        erp_connection.close()


@router.get("/languages")
async def get_languages():
    """
    Lädt alle verfügbaren Sprachen.
    
    Returns:
        Liste mit {shortName, name}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_languages(erp_connection)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/payment-terms")
async def get_payment_terms():
    """
    Lädt alle Zahlungsziele aus billing_creditperiod.
    
    Returns:
        Liste mit {id, text}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_payment_terms(erp_connection)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/tax-types")
async def get_tax_types():
    """
    Lädt alle Steuertypen.
    
    Returns:
        Liste mit {id, name}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_tax_types(erp_connection)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/factoring")
async def get_factoring_options():
    """
    Lädt alle Factoring-Optionen.
    
    Returns:
        Liste mit {fact, text}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_factoring_options(erp_connection)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/sales-users")
async def get_sales_users():
    """
    Lädt alle Vertriebsmitarbeiter.
    
    Returns:
        Liste mit {id, loginname, Vorname, Nachname, department_id, department_name}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_sales_users(erp_connection)
        return {"items": result}
    finally:
        erp_connection.close()


@router.get("/{order_id}")
async def get_order_detail(order_id: int):
    """
    Lädt alle Details eines Auftrags/Angebots inkl. aller Relationen.
    
    Args:
        order_id: ID des Auftrags/Angebots (ordertable.id)
        
    Returns:
        Alle Auftragsdetails mit verknüpften Daten (Kunde, Adressen, Kontakte, Status, etc.)
    """
    erp_connection = get_erp_db_connection()
    try:
        result = orders_data_service.get_order_detail(erp_connection, order_id)
        if result is None:
            raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
        return result
    finally:
        erp_connection.close()
