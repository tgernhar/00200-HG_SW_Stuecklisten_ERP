"""
Einfaches Script zum Entfernen einer Legacy-BOM (verwendet direkte SQL-Abfragen)

Verwendung:
    python scripts/remove_legacy_bom_simple.py <bom_id>

Beispiel:
    python scripts/remove_legacy_bom_simple.py 265
"""
import sys
import os
from pathlib import Path

# Füge das Backend-Verzeichnis zum Python-Pfad hinzu
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

try:
    import mysql.connector
    from app.core.config import settings
except ImportError as e:
    print(f"❌ Fehler beim Importieren: {e}")
    print("Bitte stellen Sie sicher, dass alle Abhängigkeiten installiert sind.")
    sys.exit(1)


def remove_legacy_bom(bom_id: int):
    """Entfernt eine Legacy-BOM und ordnet zugehörige Artikel einer anderen BOM zu"""
    try:
        # Verbinde zur Datenbank
        conn = mysql.connector.connect(
            host=settings.DATABASE_URL.split("@")[1].split("/")[0].split(":")[0] if "@" in settings.DATABASE_URL else "localhost",
            port=int(settings.DATABASE_URL.split(":")[3].split("/")[0]) if ":" in settings.DATABASE_URL.split("@")[1] else 3306,
            database=settings.DATABASE_URL.split("/")[-1],
            user=settings.DATABASE_URL.split("://")[1].split(":")[0],
            password=settings.DATABASE_URL.split(":")[2].split("@")[0] if "@" in settings.DATABASE_URL else "",
        )
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Finde die BOM
            cursor.execute("SELECT * FROM boms WHERE id = %s", (bom_id,))
            bom = cursor.fetchone()
            if not bom:
                print(f"[ERROR] BOM {bom_id} nicht gefunden!")
                return False

            # Zeige BOM-Informationen
            cursor.execute("SELECT au_nr FROM projects WHERE id = %s", (bom['project_id'],))
            project = cursor.fetchone()
            project_name = project['au_nr'] if project else f"Projekt {bom['project_id']}"
            
            print(f"[INFO] BOM {bom_id} gefunden:")
            print(f"   Projekt: {project_name} (ID: {bom['project_id']})")
            print(f"   HUGWAWI Order Name: {bom['hugwawi_order_name']}")
            print(f"   HUGWAWI Artikelnummer: {bom['hugwawi_articlenumber']}")
            print(f"   Ist Legacy-BOM: {'Ja' if bom['hugwawi_articlenumber'] is None else 'Nein'}")

            # Prüfe zugehörige Artikel
            cursor.execute("SELECT COUNT(*) as count FROM articles WHERE bom_id = %s", (bom_id,))
            article_count = cursor.fetchone()['count']
            print(f"\n[INFO] Zugehörige Artikel: {article_count}")

            if article_count > 0:
                # Finde andere BOMs im selben Projekt
                cursor.execute(
                    "SELECT * FROM boms WHERE project_id = %s AND id != %s ORDER BY id ASC LIMIT 1",
                    (bom['project_id'], bom_id)
                )
                other_bom = cursor.fetchone()

                if other_bom:
                    # Verwende die erste andere BOM
                    target_bom_id = other_bom['id']
                    print(f"\n[INFO] Ordne {article_count} Artikel der BOM {target_bom_id} zu...")
                    print(f"   Ziel-BOM: {other_bom['hugwawi_articlenumber'] or f'Legacy-BOM {target_bom_id}'}")
                    
                    # Ordne Artikel um
                    cursor.execute(
                        "UPDATE articles SET bom_id = %s WHERE bom_id = %s",
                        (target_bom_id, bom_id)
                    )
                    conn.commit()
                    print(f"[OK] Artikel erfolgreich umgeordnet!")
                else:
                    # Keine andere BOM vorhanden - erstelle eine neue Legacy-BOM
                    print(f"\n[WARN] Keine andere BOM im Projekt gefunden!")
                    print(f"   Erstelle neue Legacy-BOM...")
                    
                    cursor.execute(
                        "INSERT INTO boms (project_id, hugwawi_order_name, created_at) VALUES (%s, %s, NOW())",
                        (bom['project_id'], project['au_nr'] if project else None)
                    )
                    new_bom_id = cursor.lastrowid
                    conn.commit()
                    
                    print(f"   Neue Legacy-BOM {new_bom_id} erstellt")
                    
                    # Ordne Artikel um
                    cursor.execute(
                        "UPDATE articles SET bom_id = %s WHERE bom_id = %s",
                        (new_bom_id, bom_id)
                    )
                    conn.commit()
                    print(f"[OK] Artikel erfolgreich umgeordnet!")

            # Lösche die BOM
            print(f"\n[INFO] Lösche BOM {bom_id}...")
            cursor.execute("DELETE FROM boms WHERE id = %s", (bom_id,))
            conn.commit()
            print(f"[OK] BOM {bom_id} erfolgreich gelöscht!")
            return True

        except Exception as e:
            conn.rollback()
            print(f"[ERROR] Fehler beim Entfernen der BOM: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        print(f"[ERROR] Fehler bei der Datenbankverbindung: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Verwendung: python scripts/remove_legacy_bom_simple.py <bom_id>")
        print("Beispiel: python scripts/remove_legacy_bom_simple.py 265")
        sys.exit(1)

    try:
        bom_id = int(sys.argv[1])
    except ValueError:
        print(f"[ERROR] Ungultige BOM-ID: {sys.argv[1]}")
        sys.exit(1)

    print(f"[INFO] Entferne Legacy-BOM {bom_id}...\n")
    success = remove_legacy_bom(bom_id)
    
    if success:
        print(f"\n[OK] Vorgang erfolgreich abgeschlossen!")
        sys.exit(0)
    else:
        print(f"\n[ERROR] Vorgang fehlgeschlagen!")
        sys.exit(1)
