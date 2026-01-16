"""
ERP Service Layer
"""
from sqlalchemy.orm import Session
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


async def sync_project_orders(project_id: int, db: Session) -> dict:
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

    # Auftragnr in HUGWAWI entspricht ordertable.reference
    auftrag_ref = project.au_nr

    articles = db.query(Article).filter(Article.project_id == project_id).all()
    erp_connection = get_erp_db_connection()
    
    synced = []
    failed = []
    
    try:
        # Map: ERP articlenumber -> [article_id,...] (falls Artikelnummern im Projekt mehrfach vorkommen)
        articlenumber_to_article_ids = {}
        for a in articles:
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
                article.articlenumber AS Artikelnr,
                article_status.name AS Status,
                order_article_ref.batchsize AS Menge,
                ordertable.altText AS AltText,
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

        cursor = erp_connection.cursor(dictionary=True)
        cursor.execute(query, [auftrag_ref, *articlenumbers])
        rows = cursor.fetchall() or []
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
                        bestellkommentar=r.get("AltText"),
                        hg_lt=_to_date(r.get("LtHg")),
                        bestaetigter_lt=_to_date(r.get("LtBestaetigt")),
                    )
                    db.add(o)
                    created_count += 1
                    synced.append({"article_id": aid, "articlenumber": articlenr})
            except Exception as e:
                failed.append({"reason": str(e), "row": r})

        db.commit()
    finally:
        erp_connection.close()
    
    return {
        "synced": synced,
        "failed": failed,
        "synced_count": len(synced),
        "failed_count": len(failed)
    }
