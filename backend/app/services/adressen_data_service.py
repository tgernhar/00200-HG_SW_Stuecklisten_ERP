"""
Adressen Data Service Layer
Provides access to address data from HUGWAWI for Adressen module.
"""
from typing import Optional, List, Dict, Any


def get_contact_types(db_connection) -> List[Dict[str, Any]]:
    """
    Loads all contact types from adrconttype for dropdown.
    
    Returns:
        List of {id, name} objects
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        query = """
            SELECT id, name
            FROM adrconttype
            ORDER BY name ASC
        """
        cursor.execute(query)
        return cursor.fetchall() or []
    finally:
        cursor.close()


def search_addresses(
    db_connection,
    # Search group indicator
    search_group: str = "kunde",  # "kunde", "kontakt", "adresszeile"
    # Kunde group filters
    suchname: Optional[str] = None,
    kdn: Optional[str] = None,
    currency: Optional[str] = None,
    is_customer: Optional[bool] = None,
    is_salesprospect: Optional[bool] = None,
    is_distributor: Optional[bool] = None,
    is_reminderstop: Optional[bool] = None,
    is_employee: Optional[bool] = None,
    is_concern: Optional[bool] = None,
    # Kontakt group filters
    contact_name: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    contact_type_id: Optional[int] = None,
    function: Optional[str] = None,
    # Adresszeile group filters
    address: Optional[str] = None,
    tax_number: Optional[str] = None,
    sales_tax_id: Optional[str] = None,
    iban: Optional[str] = None,
    # Pagination and sorting
    page: int = 1,
    page_size: int = 500,
    sort_field: str = "suchname",
    sort_dir: str = "asc"
) -> Dict[str, Any]:
    """
    Main search function for addresses with filters based on search group.
    
    Args:
        search_group: Which search group is active ("kunde", "kontakt", "adresszeile")
        suchname, kdn, currency: Kunde group text filters
        is_customer, is_salesprospect, etc.: Kunde group checkbox filters
        contact_name, phone, email, contact_type_id, function: Kontakt group filters
        address, tax_number, sales_tax_id, iban: Adresszeile group filters
        page, page_size: Pagination
        sort_field, sort_dir: Sorting
    
    Returns:
        {items: [...], total: int, page: int, page_size: int, total_pages: int}
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        # Build conditions and params
        conditions = []
        params = []
        
        # Determine which JOINs are needed
        needs_contact_join = search_group == "kontakt"
        needs_address_join = search_group == "adresszeile"
        
        # === Kunde group filters ===
        if search_group == "kunde":
            if suchname:
                # Search in both suchname and kdn columns
                conditions.append("(ab.suchname LIKE %s OR ab.kdn LIKE %s)")
                params.append(f"%{suchname}%")
                params.append(f"%{suchname}%")
            
            if kdn:
                conditions.append("ab.kdn LIKE %s")
                params.append(f"%{kdn}%")
            
            if currency:
                conditions.append("ab.currency LIKE %s")
                params.append(f"%{currency}%")
            
            if is_customer:
                conditions.append("ab.customer = 1")
            
            if is_salesprospect:
                conditions.append("ab.salesprospect = 1")
            
            if is_distributor:
                conditions.append("ab.distributor = 1")
            
            if is_reminderstop:
                conditions.append("ab.reminderstop = 1")
            
            if is_employee:
                conditions.append("ab.employee = 1")
            
            if is_concern:
                conditions.append("ab.concern IS NOT NULL AND ab.concern > 0")
        
        # === Kontakt group filters ===
        elif search_group == "kontakt":
            if contact_name:
                conditions.append("ac.suchname LIKE %s")
                params.append(f"%{contact_name}%")
            
            if phone:
                conditions.append("acp.phonenumber LIKE %s")
                params.append(f"%{phone}%")
            
            if email:
                conditions.append("ace.email LIKE %s")
                params.append(f"%{email}%")
            
            if contact_type_id:
                conditions.append("ac.type = %s")
                params.append(contact_type_id)
            
            if function:
                conditions.append("ac.function LIKE %s")
                params.append(f"%{function}%")
        
        # === Adresszeile group filters ===
        elif search_group == "adresszeile":
            if address:
                conditions.append("""
                    (al.line1 LIKE %s OR al.line2 LIKE %s OR al.line3 LIKE %s 
                     OR al.line4 LIKE %s OR al.street LIKE %s)
                """)
                params.extend([f"%{address}%"] * 5)
            
            if tax_number:
                conditions.append("al.steuernum LIKE %s")
                params.append(f"%{tax_number}%")
            
            if sales_tax_id:
                conditions.append("al.salestax LIKE %s")
                params.append(f"%{sales_tax_id}%")
            
            if iban:
                conditions.append("ala.iban LIKE %s")
                params.append(f"%{iban}%")
        
        # Build WHERE clause
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Build JOIN clause based on search group
        join_clause = ""
        if needs_contact_join:
            join_clause = """
                LEFT JOIN adrcont ac ON ab.id = ac.kid
                LEFT JOIN adrcont_phone acp ON ac.id = acp.adrcont
                LEFT JOIN adrcont_email ace ON ac.id = ace.adrcont
            """
        elif needs_address_join:
            join_clause = """
                LEFT JOIN adrline al ON ab.id = al.kid
                LEFT JOIN adrline_account ala ON al.id = ala.adrlineid
            """
        
        # Validate sort field to prevent SQL injection
        allowed_sort_fields = {
            "kdn": "ab.kdn",
            "suchname": "ab.suchname",
            "url": "ab.url",
            "comment": "ab.comment",
            "currency": "ab.currency",
            "customer": "ab.customer",
            "distributor": "ab.distributor",
            "salesprospect": "ab.salesprospect",
            "reminderstop": "ab.reminderstop",
            "concern": "ab.concern",
            "blocked": "ab.blocked",
            "zahlziel": "bc.days"
        }
        sort_column = allowed_sort_fields.get(sort_field, "ab.suchname")
        sort_direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
        
        # Calculate pagination
        max_limit = 1000
        effective_page_size = min(page_size, max_limit)
        offset = (page - 1) * effective_page_size
        
        # Main query
        items_query = f"""
            SELECT SQL_CALC_FOUND_ROWS DISTINCT
                ab.id,
                ab.kdn,
                ab.suchname,
                ab.url,
                ab.comment,
                ab.currency,
                ab.customer,
                ab.distributor,
                ab.salesprospect,
                ab.reminderstop,
                ab.concern,
                ab.blocked,
                bc.days AS zahlziel
            FROM adrbase ab
            LEFT JOIN billing_creditperiod bc ON ab.termofpayment = bc.id
            {join_clause}
            {where_clause}
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
            "total_pages": total_pages
        }
        
    finally:
        cursor.close()


def get_address_detail(db_connection, address_id: int) -> Optional[Dict[str, Any]]:
    """
    Loads all detail data for a single address from adrbase with JOINs.
    
    Args:
        address_id: The adrbase.id
    
    Returns:
        Dict with all address fields and joined data, or None if not found
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        query = """
            SELECT 
                ab.id,
                ab.kdn,
                ab.suchname,
                ab.url,
                ab.comment,
                ab.currency,
                ab.customer,
                ab.distributor,
                ab.salesprospect,
                ab.reminderstop,
                ab.blocked,
                ab.employee,
                ab.concern,
                ab.termofpayment,
                ab.packingConditions,
                ab.tage,
                ab.stage,
                ab.skonto,
                ab.butext,
                ab.invlid,
                ab.dnlid,
                ab.oldSupplierId,
                ab.code,
                ab.materialgroupid,
                ab.distriMaterialgroup,
                ab.upsAccount,
                ab.kdnAtDistributor,
                ab.sendUpsEmail,
                ab.notificationInfo,
                ab.notificationDate,
                bc.days AS zahlziel_days,
                bc.textde AS zahlziel_text,
                bp.name AS versandbedingung_name,
                inv_line.suchname AS rechnungsadresse_name,
                del_line.suchname AS lieferadresse_name
            FROM adrbase ab
            LEFT JOIN billing_creditperiod bc ON ab.termofpayment = bc.id
            LEFT JOIN billing_packingconditions bp ON ab.packingConditions = bp.id
            LEFT JOIN adrline inv_line ON ab.invlid = inv_line.id
            LEFT JOIN adrline del_line ON ab.dnlid = del_line.id
            WHERE ab.id = %s
        """
        cursor.execute(query, [address_id])
        result = cursor.fetchone()
        return result
    finally:
        cursor.close()


def get_address_contacts(db_connection, address_id: int) -> List[Dict[str, Any]]:
    """
    Loads all contacts for an address with phone numbers, emails, type, and function.
    
    Args:
        address_id: The adrbase.id (contacts are linked via adrcont.kid)
    
    Returns:
        List of contact dicts
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        query = """
            SELECT 
                ac.id,
                ac.suchname,
                ac.function,
                ac.favorite,
                GROUP_CONCAT(DISTINCT acp.phonenumber SEPARATOR ', ') AS phones,
                GROUP_CONCAT(DISTINCT ace.email SEPARATOR ', ') AS emails,
                act.name AS type_name
            FROM adrcont ac
            LEFT JOIN adrcont_phone acp ON ac.id = acp.adrcont
            LEFT JOIN adrcont_email ace ON ac.id = ace.adrcont
            LEFT JOIN adrconttype act ON ac.type = act.id
            WHERE ac.kid = %s
            GROUP BY ac.id, ac.suchname, ac.function, ac.favorite, act.name
            ORDER BY ac.favorite DESC, ac.suchname ASC
        """
        cursor.execute(query, [address_id])
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_address_lines(db_connection, address_id: int) -> List[Dict[str, Any]]:
    """
    Loads all address lines for an address.
    
    Args:
        address_id: The adrbase.id (address lines are linked via adrline.kid)
    
    Returns:
        List of address line dicts
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        query = """
            SELECT 
                al.id,
                al.suchname,
                al.street,
                al.zipcode,
                al.city,
                ab.kdn
            FROM adrline al
            LEFT JOIN adrbase ab ON al.kid = ab.id
            WHERE al.kid = %s
            ORDER BY al.suchname ASC
        """
        cursor.execute(query, [address_id])
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_payment_terms(db_connection) -> List[Dict[str, Any]]:
    """
    Loads all payment terms from billing_creditperiod for dropdown.
    
    Returns:
        List of {id, days, text} objects
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        query = """
            SELECT id, days, textde AS text
            FROM billing_creditperiod
            WHERE hidden = 0 OR hidden IS NULL
            ORDER BY ordering ASC, days ASC
        """
        cursor.execute(query)
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_packing_conditions(db_connection) -> List[Dict[str, Any]]:
    """
    Loads all packing conditions from billing_packingconditions for dropdown.
    
    Returns:
        List of {id, name} objects
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        query = """
            SELECT id, name
            FROM billing_packingconditions
            ORDER BY name ASC
        """
        cursor.execute(query)
        return cursor.fetchall() or []
    finally:
        cursor.close()
