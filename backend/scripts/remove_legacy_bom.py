"""
Script zum Entfernen einer Legacy-BOM

Verwendung:
    python -m scripts.remove_legacy_bom <bom_id>

Beispiel:
    python -m scripts.remove_legacy_bom 265
"""
import sys
import os

# Füge das Backend-Verzeichnis zum Python-Pfad hinzu
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.bom import Bom
from app.models.article import Article
from app.models.project import Project


def remove_legacy_bom(bom_id: int):
    """Entfernt eine Legacy-BOM und ordnet zugehörige Artikel einer anderen BOM zu"""
    db = SessionLocal()
    try:
        # Finde die BOM
        bom = db.query(Bom).filter(Bom.id == bom_id).first()
        if not bom:
            print(f"❌ BOM {bom_id} nicht gefunden!")
            return False

        # Zeige BOM-Informationen
        project = db.query(Project).filter(Project.id == bom.project_id).first()
        project_name = project.au_nr if project else f"Projekt {bom.project_id}"
        
        print(f"📋 BOM {bom_id} gefunden:")
        print(f"   Projekt: {project_name} (ID: {bom.project_id})")
        print(f"   HUGWAWI Order Name: {bom.hugwawi_order_name}")
        print(f"   HUGWAWI Artikelnummer: {bom.hugwawi_articlenumber}")
        print(f"   Ist Legacy-BOM: {'Ja' if bom.hugwawi_articlenumber is None else 'Nein'}")

        # Prüfe zugehörige Artikel
        articles = db.query(Article).filter(Article.bom_id == bom_id).all()
        article_count = len(articles)
        print(f"\n📦 Zugehörige Artikel: {article_count}")

        if article_count > 0:
            # Finde andere BOMs im selben Projekt
            other_boms = db.query(Bom).filter(
                Bom.project_id == bom.project_id,
                Bom.id != bom_id
            ).all()

            if other_boms:
                # Verwende die erste andere BOM
                target_bom = other_boms[0]
                print(f"\n🔄 Ordne {article_count} Artikel der BOM {target_bom.id} zu...")
                print(f"   Ziel-BOM: {target_bom.hugwawi_articlenumber or f'Legacy-BOM {target_bom.id}'}")
                
                # Ordne Artikel um
                db.query(Article).filter(Article.bom_id == bom_id).update(
                    {"bom_id": target_bom.id}, synchronize_session=False
                )
                db.commit()
                print(f"✅ Artikel erfolgreich umgeordnet!")
            else:
                # Keine andere BOM vorhanden - erstelle eine neue Legacy-BOM
                print(f"\n⚠️  Keine andere BOM im Projekt gefunden!")
                print(f"   Erstelle neue Legacy-BOM...")
                
                new_bom = Bom(
                    project_id=bom.project_id,
                    hugwawi_order_name=project.au_nr if project else None
                )
                db.add(new_bom)
                db.commit()
                db.refresh(new_bom)
                
                print(f"   Neue Legacy-BOM {new_bom.id} erstellt")
                
                # Ordne Artikel um
                db.query(Article).filter(Article.bom_id == bom_id).update(
                    {"bom_id": new_bom.id}, synchronize_session=False
                )
                db.commit()
                print(f"✅ Artikel erfolgreich umgeordnet!")

        # Lösche die BOM
        print(f"\n🗑️  Lösche BOM {bom_id}...")
        db.delete(bom)
        db.commit()
        print(f"✅ BOM {bom_id} erfolgreich gelöscht!")
        return True

    except Exception as e:
        db.rollback()
        print(f"❌ Fehler beim Entfernen der BOM: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Verwendung: python -m scripts.remove_legacy_bom <bom_id>")
        print("Beispiel: python -m scripts.remove_legacy_bom 265")
        sys.exit(1)

    try:
        bom_id = int(sys.argv[1])
    except ValueError:
        print(f"❌ Ungültige BOM-ID: {sys.argv[1]}")
        sys.exit(1)

    print(f"🔍 Entferne Legacy-BOM {bom_id}...\n")
    success = remove_legacy_bom(bom_id)
    
    if success:
        print(f"\n✅ Vorgang erfolgreich abgeschlossen!")
        sys.exit(0)
    else:
        print(f"\n❌ Vorgang fehlgeschlagen!")
        sys.exit(1)
