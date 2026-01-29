"""
ERP Service Layer
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models.article import Article
from app.core.database import get_erp_db_connection
from datetime import datetime, date


def article_exists(articlenumber: str, db_connection) -> bool:
    """
    Prüft ob Artikelnummer in ERP-Datenbank existiert
    
    Entspricht VBA Article_Exists()
    
    Args:
        articlenumber: Artikelnummer zum Prüfen
        db_connection: MySQL-Verbindung zur ERP-Datenbank
    
    Returns:
        True wenn Artikel existiert, False wenn nicht
    """
    try:
        cursor = db_connection.cursor()
        
        # SQL-Query: Prüfe ob Artikelnummer existiert
        query = "SELECT article.articlenumber FROM article WHERE article.articlenumber LIKE %s"
        cursor.execute(query, (articlenumber,))
        
        result = cursor.fetchone()
        cursor.close()
        
        if result and result[0] == articlenumber:
            return True
        else:
            return False
            
    except Exception as e:
        # Bei Fehler: False zurückgeben
        return False


def find_order_by_name(au_nr: str, db_connection) -> dict | None:
    """
    Findet einen Auftrag in HUGWAWI über ordertable.name (AU-Nr).
    Rückgabe minimal: {id, name, reference}
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id, name, reference
            FROM ordertable
            WHERE name = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (au_nr,),
        )
        return cursor.fetchone()
    finally:
        cursor.close()


def get_order_customer_name(order_id: int, db_connection) -> str | None:
    """
    Holt den Kundennamen (adrbase.suchname) für eine Order-ID.
    Verknüpfung: ordertable.kid -> adrbase.id
    
    Args:
        order_id: Die HUGWAWI Order-ID (ordertable.id)
        db_connection: MySQL-Verbindung zu HUGWAWI
    
    Returns:
        Der Kundenname (suchname) oder None falls nicht gefunden
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT adrbase.suchname
            FROM ordertable
            INNER JOIN adrbase ON ordertable.kid = adrbase.id
            WHERE ordertable.id = %s
            """,
            (order_id,),
        )
        result = cursor.fetchone()
        if result:
            return result.get("suchname")
        return None
    finally:
        cursor.close()


def get_order_customer_name_by_order_name(order_name: str, db_connection) -> str | None:
    """
    Holt den Kundennamen (adrbase.suchname) für eine Order-Nummer (ordertable.name).
    Verknüpfung: ordertable.kid -> adrbase.id
    
    Args:
        order_name: Die Auftragsnummer (ordertable.name, z.B. "AU-12345")
        db_connection: MySQL-Verbindung zu HUGWAWI
    
    Returns:
        Der Kundenname (suchname) oder None falls nicht gefunden
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT adrbase.suchname
            FROM ordertable
            INNER JOIN adrbase ON ordertable.kid = adrbase.id
            WHERE ordertable.name = %s
            ORDER BY ordertable.id DESC
            LIMIT 1
            """,
            (order_name,),
        )
        result = cursor.fetchone()
        if result:
            return result.get("suchname")
        return None
    finally:
        cursor.close()


def list_order_articles_by_au_name(au_nr: str, db_connection) -> list[dict]:
    """
    Liefert die eindeutigen Artikel-Zuordnungen eines Auftrags (order_article_ref) anhand AU-Nr (ordertable.name).
    Rückgabe enthält IDs zur eindeutigen Speicherung (orderid + orderArticleId) und die Artikelnummer.
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                ot.id AS hugwawi_order_id,
                ot.name AS hugwawi_order_name,
                ot.reference AS hugwawi_order_reference,
                oar.orderArticleId AS hugwawi_order_article_id,
                a.id AS hugwawi_article_id,
                a.articlenumber AS hugwawi_articlenumber,
                a.description AS hugwawi_description
            FROM ordertable ot
            INNER JOIN order_article_ref oar ON ot.id = oar.orderid
            INNER JOIN order_article oa ON oar.orderArticleId = oa.id
            INNER JOIN article a ON oa.articleid = a.id
            WHERE ot.name = %s
            ORDER BY a.articlenumber ASC, oar.orderArticleId ASC
            """,
            (au_nr,),
        )
        return cursor.fetchall() or []
    finally:
        cursor.close()


def fetch_delivery_notes_for_order(order_name: str, db_connection) -> list[dict]:
    """
    Lädt Lieferschein-Informationen für einen Auftrag aus HUGWAWI.
    
    Args:
        order_name: ordertable.name (z.B. "BN-12345")
        db_connection: MySQL-Verbindung zu HUGWAWI
    
    Returns:
        Liste von Lieferscheinen mit ihren Artikeln, gruppiert nach Lieferschein
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        # Erst die Order-ID finden
        cursor.execute(
            """
            SELECT id FROM ordertable WHERE name = %s ORDER BY id DESC LIMIT 1
            """,
            (order_name,),
        )
        order_row = cursor.fetchone()
        if not order_row:
            return []
        
        order_id = order_row["id"]
        
        # Lieferscheine und ihre Artikel laden
        cursor.execute(
            """
            SELECT 
                dn.id AS delivery_note_id,
                dn.number AS delivery_note_number,
                dn.deliveryDate AS delivery_date,
                dn.created AS booked_at,
                dn.description AS delivery_note_description,
                u.loginname AS booked_by,
                dna.id AS delivery_article_id,
                dna.amount AS amount,
                dna.description AS article_note,
                a.articlenumber AS article_number,
                a.description AS article_description
            FROM incomingDeliveryNote dn
            LEFT JOIN userlogin u ON u.id = dn.orderer
            LEFT JOIN incomingDeliveryNoteArticle dna ON dna.deliveryNoteId = dn.id
            LEFT JOIN article a ON a.id = dna.articleId
            WHERE dn.orderId = %s
            ORDER BY dn.created DESC, dna.id ASC
            """,
            (order_id,),
        )
        rows = cursor.fetchall() or []
        
        # Gruppiere nach Lieferschein
        delivery_notes_map = {}
        for row in rows:
            dn_id = row.get("delivery_note_id")
            if dn_id is None:
                continue
            
            if dn_id not in delivery_notes_map:
                # Datum formatieren
                delivery_date = row.get("delivery_date")
                booked_at = row.get("booked_at")
                
                # Konvertiere datetime zu String
                delivery_date_str = None
                if delivery_date:
                    try:
                        delivery_date_str = delivery_date.strftime("%d.%m.%Y") if hasattr(delivery_date, 'strftime') else str(delivery_date)[:10]
                    except Exception:
                        delivery_date_str = str(delivery_date)[:10] if delivery_date else None
                
                booked_at_str = None
                if booked_at:
                    try:
                        booked_at_str = booked_at.strftime("%d.%m.%Y %H:%M") if hasattr(booked_at, 'strftime') else str(booked_at)[:16]
                    except Exception:
                        booked_at_str = str(booked_at)[:16] if booked_at else None
                
                delivery_notes_map[dn_id] = {
                    "delivery_note_id": dn_id,
                    "number": row.get("delivery_note_number") or "",
                    "delivery_date": delivery_date_str,
                    "booked_at": booked_at_str,
                    "booked_by": row.get("booked_by") or "",
                    "description": row.get("delivery_note_description") or "",
                    "articles": []
                }
            
            # Artikel hinzufügen (falls vorhanden)
            if row.get("delivery_article_id"):
                pos = len(delivery_notes_map[dn_id]["articles"]) + 1
                delivery_notes_map[dn_id]["articles"].append({
                    "pos": pos,
                    "article_number": row.get("article_number") or "",
                    "article_description": row.get("article_description") or "",
                    "amount": row.get("amount") or 0,
                    "note": row.get("article_note") or ""
                })
        
        return list(delivery_notes_map.values())
    finally:
        cursor.close()


def fetch_delivery_status_batch(order_names: list[str], order_quantities: dict[str, int], db_connection) -> dict[str, str]:
    """
    Berechnet den Lieferstatus für mehrere Aufträge in einem Batch.
    
    Args:
        order_names: Liste von ordertable.name (z.B. ["BN-12345", "BN-12346"])
        order_quantities: Dict von order_name -> bestellte Menge
        db_connection: MySQL-Verbindung zu HUGWAWI
    
    Returns:
        Dict von order_name -> status ("none", "partial", "complete")
        - "none": Keine Lieferscheine vorhanden
        - "partial": Liefermenge < Bestellmenge
        - "complete": Liefermenge >= Bestellmenge
    """
    if not order_names:
        return {}
    
    result = {name: "none" for name in order_names}
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        # Erst alle Order-IDs für die Namen finden
        placeholders = ", ".join(["%s"] * len(order_names))
        cursor.execute(
            f"""
            SELECT id, name FROM ordertable WHERE name IN ({placeholders})
            """,
            order_names,
        )
        order_rows = cursor.fetchall() or []
        
        if not order_rows:
            return result
        
        order_id_to_name = {row["id"]: row["name"] for row in order_rows}
        order_ids = list(order_id_to_name.keys())
        
        if not order_ids:
            return result
        
        # Summe der gelieferten Mengen pro Order abrufen
        placeholders = ", ".join(["%s"] * len(order_ids))
        cursor.execute(
            f"""
            SELECT 
                dn.orderId,
                COALESCE(SUM(dna.amount), 0) AS total_delivered
            FROM incomingDeliveryNote dn
            LEFT JOIN incomingDeliveryNoteArticle dna ON dna.deliveryNoteId = dn.id
            WHERE dn.orderId IN ({placeholders})
            GROUP BY dn.orderId
            """,
            order_ids,
        )
        delivery_rows = cursor.fetchall() or []
        
        # Status berechnen
        for row in delivery_rows:
            order_id = row["orderId"]
            total_delivered = int(row["total_delivered"] or 0)
            order_name = order_id_to_name.get(order_id)
            
            if order_name:
                ordered_qty = order_quantities.get(order_name, 0)
                if total_delivered > 0:
                    if total_delivered >= ordered_qty:
                        result[order_name] = "complete"
                    else:
                        result[order_name] = "partial"
        
        return result
    finally:
        cursor.close()


def list_bestellartikel_templates(db_connection) -> list[dict]:
    """
    Listet HUGWAWI Artikel, deren Artikelnummer mit '099900-' beginnt.
    Für UI: customtext2 (Text) und customtext3 (Suffix) plus Basisinfos.
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                id AS hugwawi_article_id,
                articlenumber AS hugwawi_articlenumber,
                description AS hugwawi_description,
                customtext1 AS customtext1,
                customtext2 AS customtext2,
                customtext3 AS customtext3
            FROM article
            WHERE articlenumber LIKE '099900-%'
              AND customtext1 = 'Externe_Arbeitsgänge'
            ORDER BY articlenumber ASC
            """
        )
        return cursor.fetchall() or []
    finally:
        cursor.close()


def get_bestellartikel_templates_by_ids(template_ids: list[int], db_connection) -> list[dict]:
    """
    Lädt eine Teilmenge der 099900-* Templates anhand HUGWAWI article.id.
    """
    ids = [int(x) for x in (template_ids or []) if x is not None]
    if not ids:
        return []
    cursor = db_connection.cursor(dictionary=True)
    try:
        placeholders = ", ".join(["%s"] * len(ids))
        cursor.execute(
            f"""
            SELECT
                id AS hugwawi_article_id,
                articlenumber AS hugwawi_articlenumber,
                description AS hugwawi_description,
                customtext1 AS customtext1,
                customtext2 AS customtext2,
                customtext3 AS customtext3
            FROM article
            WHERE id IN ({placeholders})
            """,
            ids,
        )
        return cursor.fetchall() or []
    finally:
        cursor.close()


def list_departments(db_connection) -> list[dict]:
    """
    Listet Abteilungen aus HUGWAWI (department.name).
    """
    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT id, name
            FROM department
            WHERE name IS NOT NULL AND name <> ''
            ORDER BY name ASC
            """
        )
        return cursor.fetchall() or []
    finally:
        cursor.close()


def list_selectlist_values(selectlist_id: int, db_connection) -> list[dict]:
    """
    Listet Selectlist-Werte aus HUGWAWI für eine gegebene selectlist (article_selectlist_value.value).
    """
    # determine columns on article_selectlist and article_selectlist_value
    meta = db_connection.cursor()
    try:
        meta.execute(
            """
            SELECT TABLE_NAME, COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME IN ('article_selectlist', 'article_selectlist_value')
            """
        )
        rows = meta.fetchall() or []
        selectlist_cols = [r[1] for r in rows if r and r[0] == 'article_selectlist']
        value_cols = [r[1] for r in rows if r and r[0] == 'article_selectlist_value']
    finally:
        meta.close()

    if "selectlist" in selectlist_cols:
        filter_col = "selectlist"
    elif "selectlist_id" in selectlist_cols:
        filter_col = "selectlist_id"
    elif "selectlistid" in selectlist_cols:
        filter_col = "selectlistid"
    elif "id" in selectlist_cols:
        filter_col = "id"
    else:
        filter_col = None

    if "article_selectlist_id" in value_cols:
        fk_col = "article_selectlist_id"
    elif "selectlist_id" in value_cols:
        fk_col = "selectlist_id"
    elif "selectlistid" in value_cols:
        fk_col = "selectlistid"
    elif "selectlist" in value_cols:
        fk_col = "selectlist"
    else:
        fk_col = None

    if not filter_col:
        raise Exception(f"article_selectlist: keine passende Filter-Spalte gefunden; columns={selectlist_cols}")
    if not fk_col:
        raise Exception(f"article_selectlist_value: keine passende FK-Spalte gefunden; columns={value_cols}")

    cursor = db_connection.cursor(dictionary=True)
    try:
        cursor.execute(
            f"""
            SELECT v.id, v.value
            FROM article_selectlist_value v
            INNER JOIN article_selectlist s ON v.{fk_col} = s.id
            WHERE s.{filter_col} = %s
              AND v.value IS NOT NULL AND v.value <> ''
            ORDER BY v.value ASC
            """,
            (int(selectlist_id),),
        )
        return cursor.fetchall() or []
    finally:
        cursor.close()


# Mapping HUGWAWI -> App-DB fields for Custom Properties
HUGWAWI_FIELD_MAPPING = {
    "description": "benennung",
    "sparepart": "teilenummer",
    "department": "abteilung_lieferant",
    "customtext1": "werkstoff",
    "customtext2": "werkstoff_nr",
    "customtext3": "oberflaeche",
    "customtext5": "oberflaechenschutz",
    "customtext4": "farbe",
    "customtext6": "lieferzeit",
    "customtext7": "pfad",
    "customfloat1": "laenge",
    "customfloat2": "breite",
    "customfloat3": "hoehe",
    "weight": "gewicht",
}


def _is_empty_value(val, field: str = "") -> bool:
    """
    Prüft ob ein Wert als "leer" gilt.
    - None, leerer String
    - "-" (wird als leer behandelt)
    - "(leer)" bei numerischen Feldern
    """
    if val is None:
        return True
    if isinstance(val, str):
        val_str = val.strip()
        if val_str == "" or val_str == "-":
            return True
        # "(leer)" bei numerischen Feldern als leer behandeln
        if field in ("laenge", "breite", "hoehe", "gewicht"):
            if val_str.lower() == "(leer)":
                return True
    return False


def fetch_hugwawi_custom_properties(articlenumbers: list[str], db_connection) -> dict[str, dict]:
    """
    Lädt Custom Properties aus HUGWAWI für eine Liste von Artikelnummern.
    
    Args:
        articlenumbers: Liste von Artikelnummern zum Abfragen
        db_connection: MySQL-Verbindung zur ERP-Datenbank
    
    Returns:
        Dict: {articlenumber: {app_db_field: value, ...}, ...}
        Die Feldnamen sind bereits auf App-DB-Felder gemappt.
    """
    if not articlenumbers:
        return {}
    
    cursor = db_connection.cursor(dictionary=True)
    try:
        placeholders = ", ".join(["%s"] * len(articlenumbers))
        query = f"""
            SELECT 
                a.articlenumber,
                a.description,
                a.sparepart,
                d.name AS department,
                a.customtext1,
                a.customtext2,
                a.customtext3,
                a.customtext4,
                a.customtext5,
                a.customtext6,
                a.customtext7,
                a.customfloat1,
                a.customfloat2,
                a.customfloat3,
                a.weight
            FROM article a
            LEFT JOIN department d ON a.department = d.id
            WHERE a.articlenumber IN ({placeholders})
        """
        cursor.execute(query, articlenumbers)
        rows = cursor.fetchall() or []
        
        result = {}
        for row in rows:
            articlenumber = row.get("articlenumber")
            if not articlenumber:
                continue
            
            # Map HUGWAWI fields to App-DB fields
            mapped_data = {}
            for hugwawi_field, app_field in HUGWAWI_FIELD_MAPPING.items():
                value = row.get(hugwawi_field)
                # Normalize empty strings to None for consistent comparison
                if value == "" or value == "":
                    value = None
                # Convert floats to proper type
                if app_field in ("laenge", "breite", "hoehe", "gewicht") and value is not None:
                    try:
                        value = float(value)
                    except (ValueError, TypeError):
                        value = None
                mapped_data[app_field] = value
            
            result[articlenumber] = mapped_data
        
        return result
    finally:
        cursor.close()


def compute_article_diffs(
    articles: list,
    hugwawi_data: dict[str, dict]
) -> tuple[dict[int, dict], dict[int, dict]]:
    """
    Berechnet Differenzen zwischen Frontend-Artikeln und HUGWAWI-Daten.
    
    Args:
        articles: Liste von Article-Objekten aus der App-DB
        hugwawi_data: Dict {articlenumber: {field: value}} aus HUGWAWI
    
    Returns:
        Tuple:
        - hugwawi_by_id: {article_id: {field: hugwawi_value, ...}}
        - diffs_by_id: {article_id: {field: "conflict"|"hugwawi_only"|"frontend_only", ...}}
    """
    comparable_fields = list(HUGWAWI_FIELD_MAPPING.values())
    
    hugwawi_by_id = {}
    diffs_by_id = {}
    
    for article in articles:
        article_id = article.id
        articlenumber = (article.hg_artikelnummer or "").strip()
        
        if not articlenumber or articlenumber == "-":
            continue
        
        hugwawi_props = hugwawi_data.get(articlenumber, {})
        if not hugwawi_props:
            # Article not found in HUGWAWI - all filled frontend fields are "frontend_only"
            diffs = {}
            for field in comparable_fields:
                frontend_val = getattr(article, field, None)
                # Behandle "-" und "(leer)" als leer
                if not _is_empty_value(frontend_val, field):
                    diffs[field] = "frontend_only"
            if diffs:
                diffs_by_id[article_id] = diffs
            continue
        
        hugwawi_by_id[article_id] = hugwawi_props
        
        diffs = {}
        for field in comparable_fields:
            frontend_val = getattr(article, field, None)
            hugwawi_val = hugwawi_props.get(field)
            
            # Normalize for comparison using _is_empty_value
            # "-" und "(leer)" werden als leer behandelt
            frontend_empty = _is_empty_value(frontend_val, field)
            hugwawi_empty = _is_empty_value(hugwawi_val, field)
            
            if frontend_empty and hugwawi_empty:
                # Both empty - no diff
                continue
            elif frontend_empty and not hugwawi_empty:
                # Frontend empty, HUGWAWI has value
                diffs[field] = "hugwawi_only"
            elif not frontend_empty and hugwawi_empty:
                # Frontend has value, HUGWAWI empty
                diffs[field] = "frontend_only"
            else:
                # Both have values - compare
                # Normalize for comparison (string vs number)
                frontend_str = str(frontend_val).strip() if frontend_val is not None else ""
                hugwawi_str = str(hugwawi_val).strip() if hugwawi_val is not None else ""
                
                # For floats, compare numerically
                if field in ("laenge", "breite", "hoehe", "gewicht"):
                    try:
                        frontend_num = float(frontend_val) if frontend_val is not None else None
                        hugwawi_num = float(hugwawi_val) if hugwawi_val is not None else None
                        if frontend_num is not None and hugwawi_num is not None:
                            # Compare with tolerance
                            if abs(frontend_num - hugwawi_num) < 0.001:
                                continue  # Same value
                    except (ValueError, TypeError):
                        pass
                
                if frontend_str.lower() != hugwawi_str.lower():
                    diffs[field] = "conflict"
        
        if diffs:
            diffs_by_id[article_id] = diffs
    
    return hugwawi_by_id, diffs_by_id


def find_extended_articles(
    base_articlenumbers: list[str], 
    db_connection
) -> dict[str, list[dict]]:
    """
    Findet verlängerte Artikelnummern in HUGWAWI.
    
    Sucht nach Artikelnummern die mit dem Basis-Artikel beginnen und 
    mit "_" und weiteren Zeichen erweitert sind.
    
    Beispiel: Basis "920894-0001000" findet "920894-0001000_001", "920894-0001000_002"
    
    Args:
        base_articlenumbers: Liste von Basis-Artikelnummern (nur 09/9 beginnend)
        db_connection: MySQL-Verbindung zu HUGWAWI
    
    Returns:
        {base_articlenumber: [
            {articlenumber: "..._001", benennung: "...", ...mapped_fields...},
            {articlenumber: "..._002", benennung: "...", ...mapped_fields...},
        ], ...}
    """
    if not base_articlenumbers:
        return {}
    
    result = {}
    cursor = db_connection.cursor(dictionary=True)
    
    try:
        for base_nr in base_articlenumbers:
            if not base_nr:
                continue
            
            # Suche nach Artikelnummern die mit "base_" beginnen
            # In MySQL ist _ ein Wildcard, daher escapen wir es nicht speziell,
            # sondern filtern im Python-Code nach dem exakten Pattern
            search_pattern = f"{base_nr}_%"
            
            query = """
                SELECT 
                    a.articlenumber,
                    a.description,
                    a.sparepart,
                    d.name AS department,
                    a.customtext1,
                    a.customtext2,
                    a.customtext3,
                    a.customtext4,
                    a.customtext5,
                    a.customtext6,
                    a.customtext7,
                    a.customfloat1,
                    a.customfloat2,
                    a.customfloat3,
                    a.weight
                FROM article a
                LEFT JOIN department d ON a.department = d.id
                WHERE a.articlenumber LIKE %s
                ORDER BY a.articlenumber
            """
            cursor.execute(query, (search_pattern,))
            rows = cursor.fetchall() or []
            
            extensions = []
            for row in rows:
                articlenumber = row.get("articlenumber", "")
                
                # Prüfe ob es wirklich eine Erweiterung mit "_" ist
                # (nicht einfach nur länger ohne "_")
                if not articlenumber.startswith(f"{base_nr}_"):
                    continue
                
                # Map HUGWAWI fields to App-DB fields
                mapped_data = {"articlenumber": articlenumber}
                for hugwawi_field, app_field in HUGWAWI_FIELD_MAPPING.items():
                    value = row.get(hugwawi_field)
                    # Normalize empty strings to None
                    if value == "" or value == "":
                        value = None
                    # Convert floats to proper type
                    if app_field in ("laenge", "breite", "hoehe", "gewicht") and value is not None:
                        try:
                            value = float(value)
                        except (ValueError, TypeError):
                            value = None
                    mapped_data[app_field] = value
                
                extensions.append(mapped_data)
            
            if extensions:
                result[base_nr] = extensions
        
        return result
    finally:
        cursor.close()


def create_extended_articles(
    parent_article,
    extension_data: dict,
    project_id: int,
    bom_id: int,
    db: Session
) -> "Article":
    """
    Erstellt einen neuen Artikel als Unterartikel (pos_sub) des Eltern-Artikels.
    
    Args:
        parent_article: Das Eltern-Article-Objekt
        extension_data: Dict mit Artikeldaten aus HUGWAWI (gemappt auf App-DB-Felder)
        project_id: Projekt-ID
        bom_id: BOM-ID
        db: Datenbank-Session
    
    Returns:
        Das neu erstellte Article-Objekt
    """
    # Finde den höchsten pos_sub für diesen pos_nr
    max_pos_sub = db.query(Article).filter(
        Article.project_id == project_id,
        Article.bom_id == bom_id,
        Article.pos_nr == parent_article.pos_nr
    ).with_entities(Article.pos_sub).order_by(Article.pos_sub.desc()).first()
    
    next_pos_sub = (max_pos_sub[0] if max_pos_sub and max_pos_sub[0] else 0) + 1
    
    # Erstelle neuen Artikel mit allen Custom Properties aus HUGWAWI
    new_article = Article(
        project_id=project_id,
        bom_id=bom_id,
        pos_nr=parent_article.pos_nr,
        pos_sub=next_pos_sub,
        hg_artikelnummer=extension_data.get("articlenumber"),
        benennung=extension_data.get("benennung"),
        teilenummer=extension_data.get("teilenummer"),
        abteilung_lieferant=extension_data.get("abteilung_lieferant"),
        werkstoff=extension_data.get("werkstoff"),
        werkstoff_nr=extension_data.get("werkstoff_nr"),
        oberflaeche=extension_data.get("oberflaeche"),
        oberflaechenschutz=extension_data.get("oberflaechenschutz"),
        farbe=extension_data.get("farbe"),
        lieferzeit=extension_data.get("lieferzeit"),
        pfad=extension_data.get("pfad"),
        laenge=extension_data.get("laenge"),
        breite=extension_data.get("breite"),
        hoehe=extension_data.get("hoehe"),
        gewicht=extension_data.get("gewicht"),
        # Standard-Werte für neue Artikel
        menge=1,
        sw_origin=False,
        in_stueckliste_anzeigen=True,
        erp_exists=True,  # Kommt aus HUGWAWI, existiert also
    )
    
    db.add(new_article)
    return new_article


async def check_all_articlenumbers(project_id: int, db: Session) -> dict:
    """
    Batch-Prüfung aller Artikelnummern im ERP
    
    Entspricht VBA Check_Articlenumber_Exists()
    
    Workflow:
    1. Hole alle Artikel des Projekts
    2. Für jeden Artikel: Prüfe Spalte C2 (hg_artikelnummer) in ERP-Datenbank
    3. Setze Status: exists=True/False
    4. Aktualisiere Artikel in Datenbank
    5. Rückgabe: Liste geprüfter Artikel mit Status
    """
    articles = db.query(Article).filter(Article.project_id == project_id).all()
    erp_connection = get_erp_db_connection()
    
    checked = []
    exists = []
    not_exists = []
    
    try:
        for article in articles:
            articlenumber = article.hg_artikelnummer
            
            if not articlenumber or articlenumber == "-":
                checked.append({
                    "article_id": article.id,
                    "articlenumber": articlenumber,
                    "exists": False,
                    "reason": "Keine Artikelnummer vorhanden"
                })
                not_exists.append(article.id)
                article.erp_exists = False
                continue
            
            # Prüfe ob Artikelnummer im ERP existiert
            article_exists_status = article_exists(articlenumber, erp_connection)
            
            checked.append({
                "article_id": article.id,
                "articlenumber": articlenumber,
                "exists": article_exists_status
            })
            
            if article_exists_status:
                exists.append(article.id)
                article.erp_exists = True
            else:
                not_exists.append(article.id)
                article.erp_exists = False
        
        db.commit()
    finally:
        erp_connection.close()
    
    return {
        "checked": checked,
        "exists": exists,
        "not_exists": not_exists,
        "total_checked": len(checked),
        "exists_count": len(exists),
        "not_exists_count": len(not_exists)
    }


async def sync_project_orders(project_id: int, db: Session, bom_id: int | None = None) -> dict:
    """
    Synchronisiert Bestellungen aus ERP-System
    
    Workflow:
    1. Hole alle Artikel des Projekts
    2. Für jeden Artikel: Prüfe Bestellungen im ERP
    3. Aktualisiere Order-Tabelle
    """
    from app.models.order import Order
    from app.models.project import Project
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {
            "synced": [],
            "failed": [{"project_id": project_id, "reason": "Projekt nicht gefunden"}],
            "synced_count": 0,
            "failed_count": 1,
        }

    # AU-Nr in HUGWAWI entspricht ordertable.name
    auftrag_name = project.au_nr

    articles = db.query(Article).filter(Article.project_id == project_id).all()
    erp_connection = get_erp_db_connection()
    
    synced = []
    failed = []
    
    try:
        # Map: ERP articlenumber -> [article_id,...] (falls Artikelnummern im Projekt mehrfach vorkommen)
        articlenumber_to_article_ids = {}
        for a in articles:
            # Exclude BN-Sync rows from mapping; they are transient and may be deleted
            if (a.konfiguration or "") == "BN-Sync":
                continue
            an = (a.hg_artikelnummer or "").strip()
            if not an or an == "-":
                continue
            articlenumber_to_article_ids.setdefault(an, []).append(a.id)

        articlenumbers = list(articlenumber_to_article_ids.keys())
        if not articlenumbers:
            return {
                "synced": [],
                "failed": [],
                "synced_count": 0,
                "failed_count": 0,
                "reason": "Keine Artikelnummern im Projekt vorhanden",
            }

        # idempotent: lösche bestehende Orders für die betroffenen Artikel
        target_article_ids = [aid for ids in articlenumber_to_article_ids.values() for aid in ids]
        try:
            db.query(Order).filter(Order.article_id.in_(target_article_ids)).delete(synchronize_session=False)
            db.commit()
        except Exception as e:
            db.rollback()
            failed.append({"reason": f"Fehler beim Löschen alter Orders: {e}"})

        # Parameterisierte ERP-Query (VBA-Äquivalent), batchfähig via IN (...)
        placeholders = ", ".join(["%s"] * len(articlenumbers))
        query = f"""
            SELECT
                ordertable.name AS Auftrag,
                order_article.position AS Pos,
                article.articlenumber AS Artikelnr,
                article_status.name AS Status,
                article.description AS Beschreibung,
                article.sparepart AS Teilenummer,
                order_article_ref.batchsize AS Menge,
                order_article.deliverynote AS Lieferschein,
                order_article.deliveredon AS Lieferdatum,
                ordertable.text AS OrderText,
                ordertable.date1 AS LtHg,
                ordertable.date2 AS LtBestaetigt
            FROM ordertable
            INNER JOIN order_article_ref ON ordertable.id = order_article_ref.orderid
            INNER JOIN order_article ON order_article_ref.orderArticleId = order_article.id
            INNER JOIN article ON order_article.articleid = article.id
            INNER JOIN article_status ON order_article.articlestatus = article_status.id
            WHERE
                ordertable.reference = %s
                AND article.articlenumber IN ({placeholders})
        """

        all_rows = []

        cursor = erp_connection.cursor(dictionary=True)
        cursor.execute(query, [auftrag_name, *articlenumbers])
        rows = cursor.fetchall() or []
        cursor.close()
        row_articlenr = [(r.get("Artikelnr") or "").strip() for r in rows]
        missing_in_project = [a for a in row_articlenr if a and a not in set(articlenumbers)]

        cursor = erp_connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                ordertable.name AS Auftrag,
                article.articlenumber AS Artikelnr,
                article_status.name AS Status,
                article.description AS Beschreibung,
                article.sparepart AS Teilenummer,
                order_article_ref.batchsize AS Menge,
                ordertable.text AS OrderText,
                ordertable.date1 AS LtHg,
                ordertable.date2 AS LtBestaetigt
            FROM ordertable
            INNER JOIN order_article_ref ON ordertable.id = order_article_ref.orderid
            INNER JOIN order_article ON order_article_ref.orderArticleId = order_article.id
            LEFT JOIN article ON order_article.articleid = article.id
            INNER JOIN article_status ON order_article.articlestatus = article_status.id
            WHERE ordertable.reference = %s
            """,
            (auftrag_name,),
        )
        all_rows = cursor.fetchall() or []
        cursor.close()

        totals = {"total_orders": None, "no_articlenr": None}
        cursor = erp_connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_orders,
                SUM(CASE WHEN a.articlenumber IS NULL OR a.articlenumber = '' THEN 1 ELSE 0 END) AS no_articlenr
            FROM ordertable ot
            INNER JOIN order_article_ref oar ON ot.id = oar.orderid
            INNER JOIN order_article oa ON oar.orderArticleId = oa.id
            LEFT JOIN article a ON oa.articleid = a.id
            WHERE ot.reference = %s
            """,
            (auftrag_name,),
        )
        totals = cursor.fetchone() or totals
        cursor.close()

        def _to_int(v):
            if v is None or v == "":
                return None
            try:
                return int(round(float(v)))
            except Exception:
                return None

        def _to_date(v):
            if v is None or v == "":
                return None
            # mysql.connector kann date oder datetime liefern
            try:
                if isinstance(v, datetime):
                    return v.date()
                if isinstance(v, date):
                    return v
            except Exception:
                pass
            # Fallback: String parse (YYYY-MM-DD)
            if isinstance(v, str):
                try:
                    return datetime.strptime(v[:10], "%Y-%m-%d").date()
                except Exception:
                    return None
            return v

        created_count = 0
        existing_article_numbers = set(articlenumbers)
        bom_id = bom_id
        try:
            from app.models.bom import Bom
            boms = (
                db.query(Bom)
                .filter(Bom.project_id == project_id)
                .order_by(Bom.id.asc())
                .all()
            )
            if bom_id is None:
                bom = boms[0] if boms else None
                bom_id = bom.id if bom else None

            # Remove previous BN-Sync order rows for this BOM to avoid duplicates
            try:
                # Mark legacy BN rows (older runs) so they can be deleted reliably
                legacy_ids = (
                    db.query(Article.id)
                    .join(Order, Order.article_id == Article.id)
                    .filter(
                        Article.project_id == project_id,
                        Article.bom_id == bom_id,
                        Article.konfiguration.is_(None),
                        Article.sldasm_sldprt_pfad.is_(None),
                        Article.pfad.is_(None),
                        Order.hg_bnr.like("BN-%"),
                    )
                    .distinct()
                    .all()
                )
                legacy_ids = [row[0] for row in legacy_ids]
                if legacy_ids:
                    db.query(Article).filter(Article.id.in_(legacy_ids)).update(
                        {Article.konfiguration: "BN-Sync"}, synchronize_session=False
                    )

                bn_sync_ids = (
                    db.query(Article.id)
                    .filter(
                        Article.project_id == project_id,
                        Article.bom_id == bom_id,
                        Article.konfiguration == "BN-Sync",
                    )
                    .distinct()
                    .all()
                )
                bn_sync_ids = [row[0] for row in bn_sync_ids]
                if bn_sync_ids:
                    db.query(Order).filter(Order.article_id.in_(bn_sync_ids)).delete(
                        synchronize_session=False
                    )
                    db.query(Article).filter(Article.id.in_(bn_sync_ids)).delete(
                        synchronize_session=False
                    )
                db.commit()
            except Exception:
                db.rollback()

            # Determine position at end
            max_pos = (
                db.query(func.max(Article.pos_nr))
                .filter(Article.project_id == project_id, Article.bom_id == bom_id)
                .scalar()
            )
            if max_pos is None:
                max_pos = 0
            next_pos_nr = int(max_pos) + 1
            next_pos_sub = 0
        except Exception:
            bom_id = None
        for r in rows:
            try:
                articlenr = (r.get("Artikelnr") or "").strip()
                if not articlenr:
                    continue

                for aid in articlenumber_to_article_ids.get(articlenr, []):
                    o = Order(
                        article_id=aid,
                        hg_bnr=r.get("Auftrag"),
                        bnr_status=r.get("Status"),
                        bnr_menge=_to_int(r.get("Menge")),
                        bestellkommentar=r.get("OrderText"),
                        hg_lt=_to_date(r.get("LtHg")),
                        bestaetigter_lt=_to_date(r.get("LtBestaetigt")),
                    )
                    db.add(o)
                    created_count += 1
                    synced.append({"article_id": aid, "articlenumber": articlenr})
            except Exception as e:
                failed.append({"reason": str(e), "row": r})

        manual_created = 0
        no_art_rows_count = None
        no_art_created = 0
        no_art_skipped_existing_any = 0
        no_art_skipped_existing_project = 0
        # Create manual rows for orders (all orders, appended at end)
        try:
            no_art_rows = all_rows
            no_art_rows_count = len(no_art_rows)
            for r in no_art_rows:
                try:
                    a = Article(
                        project_id=project_id,
                        bom_id=bom_id,
                        pos_nr=next_pos_nr,
                        pos_sub=next_pos_sub,
                        hg_artikelnummer=(r.get("Artikelnr") or None),
                        benennung=(r.get("Beschreibung") or None),
                        konfiguration="BN-Sync",
                        teilenummer=(r.get("Teilenummer") or None),
                        menge=1,
                        p_menge=None,
                        teiletyp_fertigungsplan=None,
                        abteilung_lieferant=None,
                        werkstoff=None,
                        werkstoff_nr=None,
                        oberflaeche=None,
                        oberflaechenschutz=None,
                        farbe=None,
                        lieferzeit=None,
                        laenge=None,
                        breite=None,
                        hoehe=None,
                        gewicht=None,
                        pfad=None,
                        sldasm_sldprt_pfad=None,
                        slddrw_pfad=None,
                        in_stueckliste_anzeigen=True,
                        erp_exists=None,
                    )
                    db.add(a)
                    db.flush()
                    next_pos_sub += 1
                    o = Order(
                        article_id=a.id,
                        hg_bnr=r.get("Auftrag"),
                        bnr_status=r.get("Status"),
                        bnr_menge=_to_int(r.get("Menge")),
                        bestellkommentar=r.get("OrderText"),
                        hg_lt=_to_date(r.get("LtHg")),
                        bestaetigter_lt=_to_date(r.get("LtBestaetigt")),
                    )
                    db.add(o)
                    created_count += 1
                    manual_created += 1
                    no_art_created += 1
                    synced.append({"article_id": a.id, "articlenumber": r.get("Artikelnr"), "created_manual": True})
                except Exception as e:
                    failed.append({"reason": str(e), "row": r})
        except Exception as e:
            failed.append({"reason": f"Fehler beim Laden von Bestellungen ohne Artikelnummer: {e}"})


        db.commit()
    finally:
        erp_connection.close()
    
    return {
        "synced": synced,
        "failed": failed,
        "synced_count": len(synced),
        "failed_count": len(failed),
        "total_orders": totals.get("total_orders"),
        "no_articlenr": totals.get("no_articlenr"),
        "missing_in_project_count": len(missing_in_project),
        "manual_created": manual_created,
    }
