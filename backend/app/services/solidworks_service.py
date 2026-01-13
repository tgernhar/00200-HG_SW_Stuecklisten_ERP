"""
SOLIDWORKS Service Layer
"""
from sqlalchemy.orm import Session
from app.models.article import Article
from app.models.project import Project
from app.core.config import settings
import httpx


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
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/get-all-parts-from-assembly",
            json={"assembly_filepath": assembly_filepath}
        )
        
        if response.status_code != 200:
            raise Exception(f"SOLIDWORKS-Connector Fehler: {response.status_code}")
        
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
