"""
Test-Script: Erstellt ein Test-Projekt mit Beispiel-Daten
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.database import SessionLocal
from app.models.project import Project
from app.models.article import Article
from app.models.document_flag import DocumentGenerationFlag

def create_test_project():
    """Erstellt ein Test-Projekt mit Beispiel-Artikeln"""
    db = SessionLocal()
    
    try:
        # Erstelle Test-Projekt
        project = Project(
            au_nr="AU-2024-00001",
            project_path="C:/Test/Projekt"
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        
        print(f"Test-Projekt erstellt: {project.au_nr} (ID: {project.id})")
        
        # Erstelle Beispiel-Artikel
        article = Article(
            project_id=project.id,
            pos_nr=1,
            hg_artikelnummer="TEST-001",
            benennung="Test-Artikel 1",
            konfiguration="Standard",
            menge=1,
            werkstoff="Stahl",
            in_stueckliste_anzeigen=True
        )
        db.add(article)
        db.commit()
        db.refresh(article)
        
        # Erstelle Document Flags
        flags = DocumentGenerationFlag(
            article_id=article.id,
            pdf_drucken="",
            pdf="",
            pdf_bestell_pdf="",
            dxf="",
            bestell_dxf="",
            step="",
            x_t="",
            stl="",
            bn_ab=""
        )
        db.add(flags)
        db.commit()
        
        print(f"Test-Artikel erstellt: {article.hg_artikelnummer} (ID: {article.id})")
        print("\nTest-Daten erfolgreich erstellt!")
        
    except Exception as e:
        print(f"Fehler beim Erstellen der Test-Daten: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_project()
