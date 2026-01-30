"""
Adressen Data API Routes
Provides endpoints for Adressen module (addresses from HUGWAWI).
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.core.database import get_erp_db_connection
from app.services import adressen_data_service

router = APIRouter()


@router.get("/contact-types")
async def get_contact_types():
    """
    Returns all contact types for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_contact_types(erp_connection)
        return result
    finally:
        erp_connection.close()


@router.get("/search")
async def search_addresses(
    # Search group indicator
    search_group: str = Query("kunde", description="Active search group: kunde, kontakt, adresszeile"),
    # Kunde group filters
    suchname: Optional[str] = Query(None, description="Suchname (adrbase.suchname)"),
    kdn: Optional[str] = Query(None, description="KDNr (adrbase.kdn)"),
    currency: Optional[str] = Query(None, description="Währung (adrbase.currency)"),
    is_customer: Optional[bool] = Query(None, description="Kunde Checkbox (adrbase.customer=1)"),
    is_salesprospect: Optional[bool] = Query(None, description="Interessent Checkbox (adrbase.salesprospect=1)"),
    is_distributor: Optional[bool] = Query(None, description="Lieferant Checkbox (adrbase.distributor=1)"),
    is_reminderstop: Optional[bool] = Query(None, description="Mahnstop Checkbox (adrbase.reminderstop=1)"),
    is_employee: Optional[bool] = Query(None, description="Mitarbeiter Checkbox (adrbase.employee=1)"),
    is_concern: Optional[bool] = Query(None, description="Konzern Checkbox (adrbase.concern>0)"),
    # Kontakt group filters
    contact_name: Optional[str] = Query(None, description="Kontakt Name (adrcont.suchname)"),
    phone: Optional[str] = Query(None, description="Telefon (adrcont_phone.phonenumber)"),
    email: Optional[str] = Query(None, description="Email (adrcont_email.email)"),
    contact_type_id: Optional[int] = Query(None, description="Kontakt Typ ID (adrcont.type)"),
    function: Optional[str] = Query(None, description="Funktion (adrcont.function)"),
    # Adresszeile group filters
    address: Optional[str] = Query(None, description="Adresse (adrline.line1-4, street)"),
    tax_number: Optional[str] = Query(None, description="SteuerNr (adrline.steuernum)"),
    sales_tax_id: Optional[str] = Query(None, description="Ust-Id (adrline.salestax)"),
    iban: Optional[str] = Query(None, description="IBAN (adrline_account.iban)"),
    # Pagination and sorting
    page: int = Query(1, ge=1, description="Seite"),
    page_size: int = Query(500, ge=1, le=10000, description="Einträge pro Seite"),
    sort_field: str = Query("suchname", description="Sortierfeld"),
    sort_dir: str = Query("asc", description="Sortierrichtung (asc/desc)")
):
    """
    Main search endpoint for addresses with filters based on search group.
    
    Search Groups:
    - "kunde": Searches in adrbase with customer-related filters
    - "kontakt": Searches via adrcont with contact filters (name, phone, email, type, function)
    - "adresszeile": Searches via adrline with address filters (address, tax, IBAN)
    
    Returns:
        {items: [...], total: int, page: int, page_size: int, total_pages: int}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.search_addresses(
            db_connection=erp_connection,
            search_group=search_group,
            # Kunde group
            suchname=suchname,
            kdn=kdn,
            currency=currency,
            is_customer=is_customer,
            is_salesprospect=is_salesprospect,
            is_distributor=is_distributor,
            is_reminderstop=is_reminderstop,
            is_employee=is_employee,
            is_concern=is_concern,
            # Kontakt group
            contact_name=contact_name,
            phone=phone,
            email=email,
            contact_type_id=contact_type_id,
            function=function,
            # Adresszeile group
            address=address,
            tax_number=tax_number,
            sales_tax_id=sales_tax_id,
            iban=iban,
            # Pagination
            page=page,
            page_size=page_size,
            sort_field=sort_field,
            sort_dir=sort_dir
        )
        return result
    finally:
        erp_connection.close()
