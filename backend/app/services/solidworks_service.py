"""
SOLIDWORKS Service Layer
"""
from sqlalchemy.orm import Session
from app.models.article import Article
from app.models.project import Project
from app.core.config import settings
import httpx
import logging
import os

logger = logging.getLogger(__name__)
# Stelle sicher, dass der Logger die Handler vom Root-Logger erbt
logger.propagate = True
logger.setLevel(logging.DEBUG)  # Setze Level, damit alle Meldungen durchkommen


async def import_solidworks_assembly(
    project_id: int,
    assembly_filepath: str,
    db: Session
) -> dict:
    """
    Importiert SOLIDWORKS-Assembly entsprechend VBA Main_Create_Projektsheet()
    
    Workflow:
    1. Ruft SOLIDWORKS-Connector auf: get-all-parts-from-assembly
    2. Verarbeitet Ergebnis-Array (entspricht Main_GET_ALL_FROM_SW)
    3. Aggregiert Teile nach Name + Konfiguration (entspricht Main_SW_Import_To_Projectsheet)
    4. Speichert Artikel in Datenbank
    """
    # 1. SOLIDWORKS-Connector aufrufen
    # Debug: Direktes File-Write zum Testen
    import datetime
    log_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'logs', f'backend_{datetime.datetime.now().strftime("%Y%m%d")}.log')
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - Calling SOLIDWORKS-Connector with filepath: {assembly_filepath}\n")
        f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - SOLIDWORKS_CONNECTOR_URL: {settings.SOLIDWORKS_CONNECTOR_URL}\n")
    
    logger.info(f"Calling SOLIDWORKS-Connector with filepath: {assembly_filepath}")
    logger.info(f"SOLIDWORKS_CONNECTOR_URL: {settings.SOLIDWORKS_CONNECTOR_URL}")
    logger.info(f"Full URL: {settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/get-all-parts-from-assembly")
    logger.info(f"Request JSON: {{'assembly_filepath': '{assembly_filepath}'}}")
    
    async with httpx.AsyncClient(timeout=300.0) as client:  # 5 Minuten Timeout für große Assemblies
        try:
            request_url = f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/get-all-parts-from-assembly"
            request_json = {"assembly_filepath": assembly_filepath}
            
            # Debug: Direktes File-Write
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - Sending POST request to: {request_url}\n")
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - Request body: {request_json}\n")
            
            logger.info(f"Sending POST request to: {request_url}")
            logger.info(f"Request body: {request_json}")
            
            response = await client.post(
                request_url,
                json=request_json
            )
            
            # Debug: Direktes File-Write
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - Response status: {response.status_code}\n")
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE - Response text: {response.text[:500]}\n")
            
            logger.info(f"SOLIDWORKS-Connector response status: {response.status_code}")
            logger.debug(f"SOLIDWORKS-Connector response headers: {dict(response.headers)}")
            
            if response.status_code != 200:
                error_detail = response.text if response.text else "Keine Fehlermeldung"
                
                # Debug: Direktes File-Write
                with open(log_file, 'a', encoding='utf-8') as f:
                    f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE ERROR - SOLIDWORKS-Connector error: {error_detail}\n")
                
                logger.error(f"SOLIDWORKS-Connector error: {error_detail}")
                try:
                    error_json = response.json()
                    logger.error(f"SOLIDWORKS-Connector error JSON: {error_json}")
                except:
                    pass
                raise Exception(f"SOLIDWORKS-Connector Fehler: {response.status_code} - {error_detail}")
        except httpx.RequestError as e:
            # Debug: Direktes File-Write
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - DIRECT WRITE ERROR - Request error: {e}\n")
                import traceback
                f.write(f"Traceback: {traceback.format_exc()}\n")
            
            logger.error(f"SOLIDWORKS-Connector request error: {e}", exc_info=True)
            raise Exception(f"SOLIDWORKS-Connector Verbindungsfehler: {str(e)}")
        
        connector_data = response.json()
        results = connector_data.get("results", [])
    
    # 2. Verarbeitung (entspricht Main_GET_ALL_FROM_SW)
    articles_data = []
    child = 0
    begin_properties = 0
    end_properties = 0
    
    # Konvertiere 2D-Array in strukturierte Daten
    # results ist ein 2D-Array: results[column][row]
    if not results or len(results) == 0:
        return {
            "success": False,
            "error": "Keine Daten von SOLIDWORKS-Connector erhalten"
        }
    
    # TODO: Verarbeitung des 2D-Arrays implementieren
    # Die Struktur ist: results[0][j] = Child, results[1][j] = Partname, etc.
    
    # 3. Aggregation (entspricht Main_SW_Import_To_Projectsheet)
    # Gruppiere nach Name + Konfiguration und summiere Mengen
    aggregated_articles = {}
    
    for article_data in articles_data:
        key = f"{article_data.get('partname', '')} {article_data.get('konfiguration', '')}"
        
        if key not in aggregated_articles:
            aggregated_articles[key] = article_data.copy()
            aggregated_articles[key]["menge"] = 1
        else:
            aggregated_articles[key]["menge"] += 1
    
    # 4. Speicherung in Datenbank
    created_articles = []
    for article_data in aggregated_articles.values():
        article = Article(
            project_id=project_id,
            **article_data
        )
        db.add(article)
        created_articles.append(article)
    
    db.commit()
    
    return {
        "success": True,
        "imported_count": len(created_articles),
        "total_parts_count": len(articles_data),
        "aggregated_count": len(aggregated_articles)
    }
