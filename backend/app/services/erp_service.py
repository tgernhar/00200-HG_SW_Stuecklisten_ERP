"""
ERP Service Layer
"""
from sqlalchemy.orm import Session
from app.models.article import Article
from app.core.database import get_erp_db_connection


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
    
    articles = db.query(Article).filter(Article.project_id == project_id).all()
    erp_connection = get_erp_db_connection()
    
    synced = []
    failed = []
    
    try:
        cursor = erp_connection.cursor()
        
        for article in articles:
            if not article.hg_artikelnummer or article.hg_artikelnummer == "-":
                continue
            
            try:
                # TODO: ERP-Query für Bestellungen implementieren
                # Beispiel: SELECT * FROM orders WHERE articlenumber = %s
                # Dann Order-Objekt erstellen/aktualisieren
                
                # Placeholder für spätere Implementierung
                synced.append({"article_id": article.id})
                
            except Exception as e:
                failed.append({
                    "article_id": article.id,
                    "reason": str(e)
                })
        
        cursor.close()
        db.commit()
    finally:
        erp_connection.close()
    
    return {
        "synced": synced,
        "failed": failed,
        "synced_count": len(synced),
        "failed_count": len(failed)
    }
