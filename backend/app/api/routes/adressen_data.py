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


@router.get("/salutations")
async def get_salutations():
    """
    Returns all salutations for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_salutations(erp_connection)
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


@router.get("/payment-terms")
async def get_payment_terms():
    """
    Returns all payment terms for dropdown selection.
    
    Returns:
        List of {id: int, days: int, text: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_payment_terms(erp_connection)
        return result
    finally:
        erp_connection.close()


@router.get("/packing-conditions")
async def get_packing_conditions():
    """
    Returns all packing conditions for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_packing_conditions(erp_connection)
        return result
    finally:
        erp_connection.close()


@router.get("/countries")
async def get_countries():
    """
    Returns all countries for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_countries(erp_connection)
        return result
    finally:
        erp_connection.close()


@router.get("/factoring")
async def get_factoring_options():
    """
    Returns all factoring options for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_factoring_options(erp_connection)
        return result
    finally:
        erp_connection.close()


# Dynamic routes with path parameters MUST come after static routes
@router.get("/{address_id}")
async def get_address_detail(address_id: int):
    """
    Returns all detail data for a single address.
    
    Args:
        address_id: The adrbase.id
    
    Returns:
        Address detail object with all fields
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_address_detail(erp_connection, address_id)
        if result is None:
            raise HTTPException(status_code=404, detail=f"Adresse mit ID {address_id} nicht gefunden")
        return result
    finally:
        erp_connection.close()


@router.get("/{address_id}/contacts")
async def get_address_contacts(address_id: int):
    """
    Returns all contacts for an address with phone numbers, emails, type, and function.
    
    Args:
        address_id: The adrbase.id
    
    Returns:
        List of contact objects
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_address_contacts(erp_connection, address_id)
        return result
    finally:
        erp_connection.close()


@router.get("/{address_id}/address-lines")
async def get_address_lines(address_id: int):
    """
    Returns all address lines for an address.
    
    Args:
        address_id: The adrbase.id
    
    Returns:
        List of address line objects
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_address_lines(erp_connection, address_id)
        return result
    finally:
        erp_connection.close()


@router.get("/contacts/{contact_id}")
async def get_contact_detail(contact_id: int):
    """
    Returns detailed data for a single contact.
    
    Args:
        contact_id: The adrcont.id
    
    Returns:
        Contact detail object with all fields
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_contact_detail(erp_connection, contact_id)
        if result is None:
            raise HTTPException(status_code=404, detail=f"Kontakt mit ID {contact_id} nicht gefunden")
        return result
    finally:
        erp_connection.close()


@router.get("/contacts/{contact_id}/emails")
async def get_contact_emails(contact_id: int):
    """
    Returns all emails for a contact with their types.
    
    Args:
        contact_id: The adrcont.id
    
    Returns:
        List of email objects
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_contact_emails(erp_connection, contact_id)
        return result
    finally:
        erp_connection.close()


@router.get("/contacts/{contact_id}/phones")
async def get_contact_phones(contact_id: int):
    """
    Returns all phone numbers for a contact with their types.
    
    Args:
        contact_id: The adrcont.id
    
    Returns:
        List of phone objects
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_contact_phones(erp_connection, contact_id)
        return result
    finally:
        erp_connection.close()


@router.get("/email-types")
async def get_email_types():
    """
    Returns all email types for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_email_types(erp_connection)
        return result
    finally:
        erp_connection.close()


@router.get("/phone-types")
async def get_phone_types():
    """
    Returns all phone types for dropdown selection.
    
    Returns:
        List of {id: int, name: str}
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_phone_types(erp_connection)
        return result
    finally:
        erp_connection.close()


@router.get("/address-lines/{line_id}")
async def get_address_line_detail(line_id: int):
    """
    Returns detailed data for a single address line.
    
    Args:
        line_id: The adrline.id
    
    Returns:
        Address line detail object with all fields
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_address_line_detail(erp_connection, line_id)
        if result is None:
            raise HTTPException(status_code=404, detail=f"Adresszeile mit ID {line_id} nicht gefunden")
        return result
    finally:
        erp_connection.close()


@router.get("/address-lines/{line_id}/accounts")
async def get_address_line_accounts(line_id: int):
    """
    Returns all bank accounts for an address line.
    
    Args:
        line_id: The adrline.id
    
    Returns:
        List of bank account objects
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_address_line_accounts(erp_connection, line_id)
        return result
    finally:
        erp_connection.close()


@router.get("/address-lines/{line_id}/mline")
async def get_address_line_mline(line_id: int):
    """
    Returns direct debit data for an address line.
    
    Args:
        line_id: The adrline.id
    
    Returns:
        Direct debit object or null
    """
    erp_connection = get_erp_db_connection()
    try:
        result = adressen_data_service.get_address_line_mline(erp_connection, line_id)
        return result
    finally:
        erp_connection.close()
