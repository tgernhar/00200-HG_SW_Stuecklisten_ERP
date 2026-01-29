"""
Orders Data Service Layer
Provides access to order data from HUGWAWI ordertable for Auftragsdaten module.
"""
from app.core.database import get_erp_db_connection
from datetime import datetime, date
from typing import Optional, List, Dict, Any


def get_document_types(db_connection) -> List[Dict[str, Any]]:
    """
    Lädt alle Dokumenttypen aus billing_documenttype.
    
    Returns:
        Liste mit {id, name} für jeden Dokumenttyp
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, name
            FROM billing_documenttype
            ORDER BY id
        """)
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_order_statuses(db_connection, order_type: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Lädt Status-Optionen aus order_status.
    
    Args:
        order_type: Optional - filtert nach ordertype (-1 = alle)
        
    Returns:
        Liste mit {id, name, color, isClosed}
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        if order_type is not None:
            cursor.execute("""
                SELECT id, name, color, isClosed
                FROM order_status
                WHERE ordertype = %s OR ordertype = -1
                ORDER BY name
            """, (order_type,))
        else:
            cursor.execute("""
                SELECT id, name, color, isClosed
                FROM order_status
                ORDER BY name
            """)
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_addresses_for_customer(db_connection, kid: int) -> List[Dict[str, Any]]:
    """
    Lädt alle Adressen eines Kunden.
    
    Args:
        kid: Kunden-ID (adrbase.id)
        
    Returns:
        Liste mit {id, suchname, line1, city}
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, suchname, line1, city, zipcode
            FROM adrline
            WHERE kid = %s AND blocked = 0
            ORDER BY suchname
        """, (kid,))
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_contacts_for_customer(db_connection, kid: int) -> List[Dict[str, Any]]:
    """
    Lädt alle Kontakte eines Kunden.
    
    Args:
        kid: Kunden-ID (adrbase.id)
        
    Returns:
        Liste mit {id, suchname, name, prename, function}
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, suchname, name, prename, `function`
            FROM adrcont
            WHERE kid = %s AND blocked = 0
            ORDER BY suchname
        """, (kid,))
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_backoffice_users(db_connection) -> List[Dict[str, Any]]:
    """
    Lädt alle Backoffice-Mitarbeiter (userlogin), gruppiert nach Abteilung.
    
    Returns:
        Liste mit {id, loginname, department_id, department_name}
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                u.id,
                u.loginname,
                u.Vorname,
                u.Nachname,
                u.department AS department_id,
                COALESCE(d.name, 'Ohne Abteilung') AS department_name
            FROM userlogin u
            LEFT JOIN department d ON u.department = d.id
            WHERE u.blocked = 0 AND u.isEmployee = 1
            ORDER BY department_name, u.loginname
        """)
        return cursor.fetchall() or []
    finally:
        cursor.close()


def search_customers(db_connection, search_term: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Sucht Kunden nach Name oder Kundennummer.
    
    Args:
        search_term: Suchbegriff (wird in suchname und kdn gesucht)
        limit: Maximale Anzahl Ergebnisse
        
    Returns:
        Liste mit {id, suchname, kdn}
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        search_pattern = f"%{search_term}%"
        cursor.execute("""
            SELECT id, suchname, kdn
            FROM adrbase
            WHERE (suchname LIKE %s OR kdn LIKE %s) AND blocked = 0
            ORDER BY suchname
            LIMIT %s
        """, (search_pattern, search_pattern, limit))
        return cursor.fetchall() or []
    finally:
        cursor.close()


def search_orders(
    db_connection,
    order_types: Optional[List[int]] = None,
    year: Optional[int] = None,
    name: Optional[str] = None,
    text: Optional[str] = None,
    customer: Optional[str] = None,
    address_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    reference: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    backoffice_id: Optional[int] = None,
    status_ids: Optional[List[int]] = None,
    page: int = 1,
    page_size: int = 40,
    sort_field: str = "created",
    sort_dir: str = "desc"
) -> Dict[str, Any]:
    """
    Hauptsuchfunktion für Auftragsdaten mit allen Filtern und Pagination.
    
    Returns:
        {items: [...], total: int, page: int, page_size: int, total_pages: int}
    """
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        # Build WHERE clause
        conditions = []
        params = []
        
        # Filter by document types
        if order_types:
            placeholders = ",".join(["%s"] * len(order_types))
            conditions.append(f"o.orderType IN ({placeholders})")
            params.extend(order_types)
        
        # Filter by year
        if year:
            conditions.append("YEAR(o.created) = %s")
            params.append(year)
        
        # Filter by name (Angebotsnummer, Auftragsnummer, etc.)
        if name:
            conditions.append("o.name LIKE %s")
            params.append(f"%{name}%")
        
        # Filter by text
        if text:
            conditions.append("o.text LIKE %s")
            params.append(f"%{text}%")
        
        # Filter by customer (search in suchname and kdn)
        if customer:
            conditions.append("(a.suchname LIKE %s OR a.kdn LIKE %s)")
            params.extend([f"%{customer}%", f"%{customer}%"])
        
        # Filter by address
        if address_id:
            conditions.append("o.billingline = %s")
            params.append(address_id)
        
        # Filter by contact
        if contact_id:
            conditions.append("(o.techcont = %s OR o.commercialcont = %s)")
            params.extend([contact_id, contact_id])
        
        # Filter by price range
        if price_min is not None:
            conditions.append("o.price >= %s")
            params.append(price_min)
        if price_max is not None:
            conditions.append("o.price <= %s")
            params.append(price_max)
        
        # Filter by reference
        if reference:
            conditions.append("o.reference LIKE %s")
            params.append(f"%{reference}%")
        
        # Filter by delivery date (date1 or date2)
        if date_from:
            conditions.append("(o.date1 >= %s OR o.date2 >= %s)")
            params.extend([date_from, date_from])
        if date_to:
            conditions.append("(o.date1 <= %s OR o.date2 <= %s)")
            params.extend([date_to, date_to])
        
        # Filter by backoffice user
        if backoffice_id:
            conditions.append("o.infoBackoffice = %s")
            params.append(backoffice_id)
        
        # Filter by status (multiple selection)
        if status_ids:
            placeholders = ",".join(["%s"] * len(status_ids))
            conditions.append(f"o.status IN ({placeholders})")
            params.extend(status_ids)
        
        # Build WHERE clause
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Validate sort field to prevent SQL injection
        allowed_sort_fields = {
            "name": "o.name",
            "reference": "o.reference",
            "kunde_name": "a.suchname",
            "price": "o.price",
            "date1": "o.date1",
            "date2": "o.date2",
            "created": "o.created",
            "status_name": "os.name"
        }
        sort_column = allowed_sort_fields.get(sort_field, "o.created")
        sort_direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
        
        # Calculate pagination offset
        offset = (page - 1) * page_size
        
        # OPTIMIZED: Use SQL_CALC_FOUND_ROWS to get count and items in one roundtrip
        # This avoids running two separate queries
        items_query = f"""
            SELECT SQL_CALC_FOUND_ROWS 
                o.id,
                o.name,
                o.text,
                o.reference,
                o.price,
                o.date1,
                o.date2,
                o.created,
                o.orderType,
                o.altText AS notiz,
                o.kid,
                a.suchname AS kunde_name,
                a.kdn AS kunde_kdn,
                al.suchname AS adresse_name,
                ac.suchname AS kontakt_name,
                os.id AS status_id,
                os.name AS status_name,
                os.color AS status_color,
                u.loginname AS bearbeiter,
                bdt.name AS dokumenttyp_name
            FROM ordertable o
            LEFT JOIN adrbase a ON o.kid = a.id
            LEFT JOIN adrline al ON o.billingline = al.id
            LEFT JOIN adrcont ac ON (o.techcont = ac.id OR o.commercialcont = ac.id)
            LEFT JOIN order_status os ON o.status = os.id
            LEFT JOIN userlogin u ON o.infoBackoffice = u.id
            LEFT JOIN billing_documenttype bdt ON o.orderType = bdt.id
            {where_clause}
            GROUP BY o.id
            ORDER BY {sort_column} {sort_direction}
            LIMIT %s OFFSET %s
        """
        
        cursor.execute(items_query, params + [page_size, offset])
        items = cursor.fetchall() or []
        
        # Get the total count from SQL_CALC_FOUND_ROWS (much faster than separate COUNT query)
        cursor.execute("SELECT FOUND_ROWS() as total")
        total = cursor.fetchone()["total"]
        
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


def get_order_detail(db_connection, order_id: int) -> Optional[Dict[str, Any]]:
    """
    Lädt alle Details eines Auftrags/Angebots inkl. aller Relationen.
    
    Args:
        order_id: ID des Auftrags/Angebots (ordertable.id)
        
    Returns:
        Dict mit allen Auftragsdetails oder None wenn nicht gefunden
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        query = """
            SELECT 
                o.id,
                o.name,
                o.orderType,
                o.reference,
                o.text,
                o.altText AS notiz,
                o.productionText,
                o.calculationText,
                o.price,
                o.date1,
                o.date2,
                o.created,
                o.lupdat,
                o.lupdfrom,
                o.factDat,
                o.accounting,
                o.taxtype,
                o.factoring,
                o.printPos,
                o.currency,
                o.paymentTarget,
                o.kid,
                
                -- Kunde (adrbase via kid)
                a_kunde.suchname AS kunde_name,
                a_kunde.kdn AS kunde_kdn,
                
                -- Lieferadresse (adrbase via deliverykid)
                a_liefer.suchname AS lieferadresse_name,
                
                -- Technischer Kontakt (adrcont via techcont)
                ac_tech.suchname AS techkontakt_name,
                
                -- Kaufmännischer Kontakt (adrcont via commercialcont)
                ac_kfm.suchname AS kfmkontakt_name,
                
                -- Backoffice Mitarbeiter (userlogin via infoBackoffice)
                u_back.loginname AS backoffice_name,
                
                -- Vertrieb Mitarbeiter (userlogin via infoSales)
                u_sales.loginname AS vertrieb_name,
                
                -- Provision für (userlogin via provisionFor - ist varchar(1), daher anders)
                
                -- Ersteller (userlogin via creator)
                u_creator.loginname AS creator_name,
                
                -- Status
                os.id AS status_id,
                os.name AS status_name,
                os.color AS status_color,
                
                -- Sprache
                lang.Name AS sprache_name,
                
                -- Zahlungsziel
                cp.textde AS zahlungsziel_text,
                
                -- Factoring
                bf.facttext AS factoring_text,
                
                -- Dokumenttyp
                bdt.name AS dokumenttyp_name
                
            FROM ordertable o
            
            -- Kunde
            LEFT JOIN adrbase a_kunde ON o.kid = a_kunde.id
            
            -- Lieferadresse
            LEFT JOIN adrbase a_liefer ON o.deliverykid = a_liefer.id
            
            -- Technischer Kontakt
            LEFT JOIN adrcont ac_tech ON o.techcont = ac_tech.id
            
            -- Kaufmännischer Kontakt
            LEFT JOIN adrcont ac_kfm ON o.commercialcont = ac_kfm.id
            
            -- Backoffice
            LEFT JOIN userlogin u_back ON o.infoBackoffice = u_back.id
            
            -- Vertrieb
            LEFT JOIN userlogin u_sales ON o.infoSales = u_sales.id
            
            -- Ersteller
            LEFT JOIN userlogin u_creator ON o.creator = u_creator.id
            
            -- Status
            LEFT JOIN order_status os ON o.status = os.id
            
            -- Sprache
            LEFT JOIN language lang ON o.language = lang.shortName
            
            -- Zahlungsziel (paymentTarget ist varchar(2), in billing_creditperiod ist id bigint)
            LEFT JOIN billing_creditperiod cp ON o.paymentTarget = CAST(cp.id AS CHAR)
            
            -- Factoring (factoring ist varchar(1), in billing_factoring ist fact varchar(1))
            LEFT JOIN billing_factoring bf ON o.factoring = bf.fact
            
            -- Dokumenttyp
            LEFT JOIN billing_documenttype bdt ON o.orderType = bdt.id
            
            WHERE o.id = %s
        """
        
        cursor.execute(query, (order_id,))
        result = cursor.fetchone()
        
        return result
        
    finally:
        cursor.close()


def get_languages(db_connection) -> List[Dict[str, Any]]:
    """
    Lädt alle verfügbaren Sprachen aus der language Tabelle.
    
    Returns:
        Liste mit {shortName, name}
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT shortName, name
            FROM language
            ORDER BY name
        """)
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_payment_terms(db_connection) -> List[Dict[str, Any]]:
    """
    Lädt alle Zahlungsziele aus billing_creditperiod.
    
    Returns:
        Liste mit {id, text}
    """
    # #region agent log
    import json, time; open('/app/debug.log','a').write(json.dumps({"hypothesisId":"H1-svc","location":"orders_data_service.py:get_payment_terms","message":"service called","timestamp":time.time()})+'\n')
    # #endregion
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, textde AS text
            FROM billing_creditperiod
            ORDER BY id
        """)
        result = cursor.fetchall() or []
        # #region agent log
        open('/app/debug.log','a').write(json.dumps({"hypothesisId":"H1-svc","location":"orders_data_service.py:get_payment_terms","message":"query success","data":{"count":len(result)},"timestamp":time.time()})+'\n')
        # #endregion
        return result
    except Exception as e:
        # #region agent log
        open('/app/debug.log','a').write(json.dumps({"hypothesisId":"H1-svc","location":"orders_data_service.py:get_payment_terms","message":"SQL error","data":{"error":str(e),"type":type(e).__name__},"timestamp":time.time()})+'\n')
        # #endregion
        raise
    finally:
        cursor.close()


def get_tax_types(db_connection) -> List[Dict[str, Any]]:
    """
    Lädt alle Steuertypen.
    Die Steuertypen sind in ordertable.taxtype als String gespeichert.
    
    Returns:
        Liste mit {id, name} - typische Werte wie 'Standard', 'Reduced', 'Free'
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        # Distinct values from ordertable.taxtype
        cursor.execute("""
            SELECT DISTINCT taxtype as id, taxtype as name
            FROM ordertable
            WHERE taxtype IS NOT NULL AND taxtype != ''
            ORDER BY taxtype
        """)
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_factoring_options(db_connection) -> List[Dict[str, Any]]:
    """
    Lädt alle Factoring-Optionen aus billing_factoring.
    
    Returns:
        Liste mit {fact, text}
    """
    # #region agent log
    import json, time; open('/app/debug.log','a').write(json.dumps({"hypothesisId":"H2-svc","location":"orders_data_service.py:get_factoring_options","message":"service called","timestamp":time.time()})+'\n')
    # #endregion
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT fact, facttext AS text
            FROM billing_factoring
            ORDER BY fact
        """)
        result = cursor.fetchall() or []
        # #region agent log
        open('/app/debug.log','a').write(json.dumps({"hypothesisId":"H2-svc","location":"orders_data_service.py:get_factoring_options","message":"query success","data":{"count":len(result)},"timestamp":time.time()})+'\n')
        # #endregion
        return result
    except Exception as e:
        # #region agent log
        open('/app/debug.log','a').write(json.dumps({"hypothesisId":"H2-svc","location":"orders_data_service.py:get_factoring_options","message":"SQL error","data":{"error":str(e),"type":type(e).__name__},"timestamp":time.time()})+'\n')
        # #endregion
        raise
    finally:
        cursor.close()


def get_sales_users(db_connection) -> List[Dict[str, Any]]:
    """
    Lädt alle Vertriebsmitarbeiter (userlogin mit isEmployee=1).
    
    Returns:
        Liste mit {id, loginname, Vorname, Nachname, department_id, department_name}
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                u.id,
                u.loginname,
                u.Vorname,
                u.Nachname,
                u.department AS department_id,
                COALESCE(d.name, 'Ohne Abteilung') AS department_name
            FROM userlogin u
            LEFT JOIN department d ON u.department = d.id
            WHERE u.blocked = 0 AND u.isEmployee = 1
            ORDER BY department_name, u.loginname
        """)
        return cursor.fetchall() or []
    finally:
        cursor.close()
