"""
Project Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.project import Project
from app.models.bom import Bom
from app.schemas.project import Project as ProjectSchema, ProjectCreate, ProjectUpdate, SolidworksPushRequest
from app.models.article import Article
from app.models.document_flag import DocumentGenerationFlag
from app.models.document import Document
from app.models.order import Order
from app.core.config import settings
import httpx
import os
import logging
import ntpath

# Logger wird von logging_config.py konfiguriert
logger = logging.getLogger(__name__)
# Stelle sicher, dass der Logger die Handler vom Root-Logger erbt
logger.propagate = True
logger.setLevel(logging.DEBUG)  # Setze Level, damit alle Meldungen durchkommen

# Hilfsfunktion für Debug-Logs (deaktiviert)
def debug_log(message, level=logging.DEBUG):
    return

router = APIRouter()


@router.get("/projects", response_model=List[ProjectSchema])
async def get_projects(
    skip: int = 0,
    limit: int = 100,
    au_nr: str | None = Query(default=None),
    artikel_nr: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    """Liste aller Projekte (optional nach AU-Nr filtern)"""
    q = db.query(Project)
    if au_nr:
        q = q.filter(Project.au_nr == au_nr)
    if artikel_nr:
        q = q.filter(Project.artikel_nr == artikel_nr)
    projects = q.offset(skip).limit(limit).all()
    return projects


@router.get("/projects/by-au", response_model=ProjectSchema)
async def get_project_by_au(au_nr: str, db: Session = Depends(get_db)):
    """Projekt per AU-Nr laden (erstes Ergebnis, falls mehrfach vorhanden)"""
    project = (
        db.query(Project)
        .filter(Project.au_nr == au_nr)
        .order_by(Project.id.desc())
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    return project


@router.get("/projects/{project_id}", response_model=ProjectSchema)
async def get_project(project_id: int, db: Session = Depends(get_db)):
    """Projektdetails"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    return project


@router.get("/test-file-exists")
async def test_file_exists(filepath: str = Query(..., description="Pfad zur Datei")):
    """Test-Endpoint um zu prüfen, ob eine Datei existiert"""
    import urllib.parse
    import pathlib
    
    # Dekodiere den Pfad
    decoded_path = urllib.parse.unquote_plus(filepath)
    # Auf Windows: Ersetze forward slashes mit backslashes
    if os.name == 'nt':  # Windows
        decoded_path = decoded_path.replace('/', '\\')
    decoded_path = os.path.normpath(decoded_path)
    
    # Verwende den Pfad direkt, nicht pathlib.absolute() (das kann Probleme verursachen)
    path_obj = pathlib.Path(decoded_path)
    
    result = {
        "original_path": filepath,
        "decoded_path": decoded_path,
        "exists_os": os.path.exists(decoded_path),
        "exists_pathlib": path_obj.exists(),
        "is_file": path_obj.is_file() if path_obj.exists() else False,
        "path_str": str(path_obj),
        "cwd": os.getcwd(),
        "os_name": os.name,
    }
    
    # Prüfe Verzeichnis
    if path_obj.parent.exists():
        result["directory_exists"] = True
        result["files_in_directory"] = [f.name for f in path_obj.parent.iterdir()][:10]
    else:
        result["directory_exists"] = False
        result["parent_path"] = str(path_obj.parent)
        result["parent_exists"] = path_obj.parent.exists()
    
    return result


@router.post("/projects", response_model=ProjectSchema)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Neues Projekt erstellen"""
    try:
        logger.info(f"Creating project with data: {project.dict()}")
        
        # Prüfe ob Projekt mit dieser Artikelnummer bereits existiert
        if not project.artikel_nr:
            raise HTTPException(status_code=400, detail="Artikelnummer fehlt")
        existing_project = db.query(Project).filter(Project.artikel_nr == project.artikel_nr).first()
        if existing_project:
            logger.warning(f"Project with artikel_nr '{project.artikel_nr}' already exists, ID: {existing_project.id}")
            raise HTTPException(
                status_code=400,
                detail=f"Ein Projekt mit der Artikelnummer '{project.artikel_nr}' existiert bereits (ID: {existing_project.id}). Bitte verwenden Sie eine andere Artikelnummer oder löschen Sie das bestehende Projekt."
            )
        
        db_project = Project(**project.dict())
        logger.info(f"Project object created: {db_project}")
        db.add(db_project)
        logger.debug("Project added to session")
        db.commit()
        logger.debug("Changes committed")
        db.refresh(db_project)
        logger.info(f"Project refreshed, ID: {db_project.id}")
        return db_project
    except HTTPException:
        # HTTPException weiterwerfen (z.B. für Duplicate-Key-Fehler)
        raise
    except Exception as e:
        db.rollback()
        import traceback
        from sqlalchemy.exc import IntegrityError
        
        error_details = traceback.format_exc()
        logger.error(f"Error creating project: {e}")
        logger.error(f"Traceback: {error_details}")
        logger.error(f"Project data was: {project.dict()}")
        
        # Spezielle Behandlung für Duplicate-Key-Fehler
        if isinstance(e, IntegrityError) and "Duplicate entry" in str(e):
            raise HTTPException(
                status_code=400,
                detail=f"Ein Projekt mit der Artikelnummer '{project.artikel_nr}' existiert bereits. Bitte verwenden Sie eine andere Artikelnummer."
            )
        
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Erstellen des Projekts: {str(e)}"
        )


@router.post("/projects/{project_id}/import-solidworks")
async def import_solidworks(
    project_id: int,
    request: Request,
    assembly_filepath: str = Query(None, description="Pfad zur SOLIDWORKS Assembly-Datei"),
    overwrite_password: str | None = Query(default=None, description="Passwort zum Überschreiben (aktuell: '1')"),
    db: Session = Depends(get_db)
):
    """
    Importiert SOLIDWORKS-Assembly in Projekt
    
    Entspricht VBA Main_Create_Projektsheet()
    """
    # Prüfe Query-Parameter direkt aus Request
    query_params = dict(request.query_params)
    logger.info(f"import_solidworks called - project_id: {project_id}")
    logger.info(f"assembly_filepath from Query: {assembly_filepath}")
    logger.info(f"All query params: {query_params}")
    logger.info(f"Request URL: {request.url}")
    
    # Falls assembly_filepath None ist, versuche es aus Query-Params zu holen
    if not assembly_filepath:
        assembly_filepath = query_params.get('assembly_filepath')
        logger.info(f"Got assembly_filepath from query_params: {assembly_filepath}")
    
    # Prüfe ob Projekt existiert
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    # Prüfe ob Assembly-Filepath vorhanden
    if not assembly_filepath:
        logger.error("assembly_filepath is None or empty")
        raise HTTPException(
            status_code=400,
            detail="Assembly-Filepath fehlt"
        )
    
    # Normalisiere den Pfad (Backslashes, Leerzeichen, etc.)
    import urllib.parse
    import pathlib
    
    # FastAPI dekodiert Query-Parameter bereits, aber prüfe ob noch Encoding vorhanden ist
    normalized_path = assembly_filepath
    debug_log(f"Before decoding - normalized_path: {repr(normalized_path)}")
    
    # Prüfe ob der Pfad noch URL-encoded ist (enthält % oder +)
    if '%' in normalized_path or ('+' in normalized_path and ' ' not in normalized_path):
        # Verwende unquote_plus, um auch + Zeichen als Leerzeichen zu dekodieren
        normalized_path = urllib.parse.unquote_plus(normalized_path)
        debug_log(f"Path was URL-encoded, decoded to: {normalized_path}")
    
    # Prüfe ob wir in Docker laufen (cwd ist /app)
    is_docker = os.getcwd() == '/app' or os.path.exists('/.dockerenv')

    # In Docker/Linux kann das Backend Windows-Laufwerke (z.B. G:\...) typischerweise NICHT direkt prüfen.
    # Der SOLIDWORKS-Connector läuft aber auf Windows und kann den Pfad validieren/lesen.
    # Windows drive path like C:\... or G:\... (works on Linux too)
    is_windows_drive_path = bool(ntpath.splitdrive(normalized_path or "")[0]) and ntpath.isabs(normalized_path or "")
    skip_fs_exists_check = bool(is_docker and is_windows_drive_path)
    
    # WICHTIG: Der SOLIDWORKS-Connector läuft auf Windows (nicht in Docker)
    # Daher müssen wir den Windows-Pfad beibehalten, auch wenn das Backend in Docker läuft
    # Das Backend kann die Datei über das gemountete Volume lesen, aber der Connector braucht den Windows-Pfad
    
    # Pfad für Datei-Existenz-Prüfung (kann Docker-Pfad sein)
    check_path = normalized_path
    
    # Wenn in Docker und der Pfad ein Windows-Pfad ist, prüfe über das gemountete Volume
    if is_docker and normalized_path.startswith('C:\\'):
        # Prüfe ob die Datei über das gemountete Volume existiert
        # Volume ist gemountet als: C:/Thomas/Solidworks:/mnt/solidworks
        if normalized_path.startswith('C:\\Thomas\\Solidworks\\'):
            # Entferne C:\Thomas\Solidworks\ und ersetze mit /mnt/solidworks/
            relative_path = normalized_path[len('C:\\Thomas\\Solidworks\\'):]
            docker_path = f'/mnt/solidworks/{relative_path}'.replace('\\', '/')
            debug_log(f"Docker detected, checking file via volume: {docker_path}")
            check_path = docker_path
        else:
            # Fallback: Einfache Ersetzung
            docker_path = normalized_path.replace('C:\\', '/mnt/solidworks/').replace('\\', '/')
            debug_log(f"Docker detected, checking file via volume (fallback): {docker_path}")
            check_path = docker_path
        # Wenn wir einen Docker-Pfad ableiten konnten, können wir die Existenz prüfen (optional).
        skip_fs_exists_check = False
    else:
        # Ersetze forward slashes mit backslashes für Windows (nur wenn nicht in Docker)
        if not is_docker:
            normalized_path = normalized_path.replace('/', '\\')
        # Normalisiere den Pfad (entfernt doppelte Backslashes, etc.)
        normalized_path = os.path.normpath(normalized_path)
        check_path = normalized_path
    
    debug_log(f"Final normalized_path (for SOLIDWORKS-Connector): {repr(normalized_path)}")
    debug_log(f"Check path (for file existence): {repr(check_path)}")
    debug_log(f"Is Docker: {is_docker}")
    
    debug_log(f"Original path: {assembly_filepath}")
    debug_log(f"Normalized path: {normalized_path}")
    
    # Verwende pathlib für bessere Pfad-Behandlung
    # Verwende check_path für die Existenz-Prüfung (kann Docker-Pfad sein)
    check_path_obj = pathlib.Path(check_path)
    if skip_fs_exists_check:
        exists_os = True
        exists_pathlib = True
        is_file = True
    else:
        exists_os = os.path.exists(check_path)
        exists_pathlib = check_path_obj.exists()
        is_file = check_path_obj.is_file() if exists_pathlib else False
    
    # Für den SOLIDWORKS-Connector verwenden wir normalized_path (Windows-Pfad)
    path_obj = pathlib.Path(normalized_path)
    
    debug_log(f"File exists (os.path.exists): {exists_os}")
    debug_log(f"File exists (pathlib): {exists_pathlib}")
    debug_log(f"Is file: {is_file}")
    debug_log(f"Check path string: {str(check_path_obj)}")
    debug_log(f"Normalized path string: {str(path_obj)}")
    debug_log(f"CWD: {os.getcwd()}")
    debug_log(f"OS name: {os.name}")
    
    # Wenn die Datei nicht existiert, prüfe ob das Verzeichnis existiert
    if (not exists_os and not exists_pathlib) and (not skip_fs_exists_check):
        # Versuche auch den Original-Pfad
        if os.path.exists(assembly_filepath):
            normalized_path = assembly_filepath
            debug_log(f"Original path exists, using it: {normalized_path}")
        else:
            # Prüfe ob es ein Verzeichnis-Problem ist
            dir_path = os.path.dirname(normalized_path)
            file_name = os.path.basename(normalized_path)
            debug_log(f"Directory exists: {os.path.exists(dir_path)}")
            debug_log(f"Directory path: {dir_path}")
            debug_log(f"File name: {file_name}")
            
            # Liste Dateien im Verzeichnis (falls es existiert)
            if os.path.exists(dir_path):
                files = os.listdir(dir_path)
                debug_log(f"Files in directory: {files[:10]}")  # Erste 10 Dateien
                # Prüfe ob die Datei mit einem anderen Namen existiert
                matching_files = [f for f in files if f.endswith('.SLDASM')]
                debug_log(f"SLDASM files in directory: {matching_files}")
            
            # Versuche nochmal mit pathlib.resolve()
            try:
                resolved = pathlib.Path(normalized_path).resolve()
                debug_log(f"Resolved path: {resolved}")
                debug_log(f"Resolved exists: {resolved.exists()}")
                if resolved.exists():
                    normalized_path = str(resolved)
                    exists_os = True
                    exists_pathlib = True
                    debug_log(f"Resolved path exists after error: {normalized_path}")
                else:
                    # Prüfe ob das Verzeichnis existiert
                    resolved_dir = resolved.parent
                    debug_log(f"Resolved directory: {resolved_dir}")
                    debug_log(f"Resolved directory exists: {resolved_dir.exists()}")
                    if resolved_dir.exists():
                        dir_files = list(resolved_dir.iterdir())
                        debug_log(f"Files in resolved directory: {[f.name for f in dir_files[:10]]}")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Assembly-Datei existiert nicht: {normalized_path} (resolved: {resolved}, resolved exists: {resolved.exists()})"
                    )
            except HTTPException:
                # Nicht wrapen – Detail soll beim Client ankommen
                raise
            except Exception as resolve_error:
                import traceback
                error_trace = traceback.format_exc()
                debug_log(f"Resolve error traceback: {error_trace}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Assembly-Datei existiert nicht: {normalized_path} (resolve error: {str(resolve_error)}, type: {type(resolve_error).__name__})"
                )
    
    assembly_filepath = normalized_path
    
    # Legacy-Route: importiert in die erste BOM des Projekts.
    bom = db.query(Bom).filter(Bom.project_id == project_id).order_by(Bom.id.asc()).first()
    if not bom:
        # sollte durch Migration/backfill nicht passieren; best effort: lege Legacy-BOM an
        bom = Bom(project_id=project_id, hugwawi_order_name=project.au_nr)
        db.add(bom)
        db.commit()
        db.refresh(bom)

    # Überschreibschutz: wenn bereits Artikel existieren, nur mit Passwort "1"
    existing_count = db.query(Article).filter(Article.bom_id == bom.id).count()
    if existing_count > 0 and overwrite_password != "1":
        raise HTTPException(
            status_code=409,
            detail="Für diese Stückliste existiert bereits ein Import. Zum Überschreiben bitte overwrite_password=1 setzen.",
        )

    from app.services.solidworks_service import import_solidworks_assembly
    result = await import_solidworks_assembly(project_id, bom.id, assembly_filepath, db)
    # Wenn der Service einen "success": False liefert, sollte das im HTTP-Status sichtbar sein,
    # sonst wirkt es im Frontend wie "hängt", weil Axios bei 200 nicht in den catch-Block geht.
    if isinstance(result, dict) and result.get("success") is False:
        raise HTTPException(status_code=502, detail=result.get("error") or "SOLIDWORKS-Import fehlgeschlagen")
    return result


@router.get("/projects/{project_id}/boms")
async def list_project_boms(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    boms = db.query(Bom).filter(Bom.project_id == project_id).order_by(Bom.id.asc()).all()
    return {"project_id": project_id, "items": boms, "count": len(boms)}


@router.post("/projects/{project_id}/boms")
async def create_or_get_bom(project_id: int, payload: dict, db: Session = Depends(get_db)):
    """
    Legt eine BOM (Stückliste) für eine eindeutige HUGWAWI Kombination an.
    Wenn die Kombination bereits existiert: nur mit overwrite_password=\"1\" wird sie überschrieben (Artikel gelöscht).
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    hugwawi_order_id = payload.get("hugwawi_order_id")
    hugwawi_order_name = payload.get("hugwawi_order_name")
    hugwawi_order_article_id = payload.get("hugwawi_order_article_id")
    hugwawi_article_id = payload.get("hugwawi_article_id")
    hugwawi_articlenumber = payload.get("hugwawi_articlenumber")
    overwrite_password = payload.get("overwrite_password")

    if not all([hugwawi_order_id, hugwawi_order_name, hugwawi_articlenumber]):
        raise HTTPException(status_code=400, detail="Ungültiger Payload (fehlende HUGWAWI IDs/Felder)")

    # Für manuelle Artikelnummer: order_article_id kann fehlen -> setze auf -1 als Platzhalter
    if hugwawi_order_article_id is None:
        hugwawi_order_article_id = -1

    bom = (
        db.query(Bom)
        .filter(
            Bom.project_id == project_id,
            Bom.hugwawi_order_id == int(hugwawi_order_id),
            Bom.hugwawi_order_article_id == int(hugwawi_order_article_id),
        )
        .first()
    )

    if bom:
        # Überschreiben nur mit Passwort
        if overwrite_password != "1":
            raise HTTPException(
                status_code=409,
                detail="Für diese Kombination existiert bereits eine Stückliste. Zum Überschreiben bitte overwrite_password=1 setzen.",
            )
        try:
            # Ensure child rows are removed before deleting articles (FK constraints)
            article_ids = [
                row[0]
                for row in db.query(Article.id).filter(Article.bom_id == bom.id).all()
            ]
            if article_ids:
                db.query(DocumentGenerationFlag).filter(
                    DocumentGenerationFlag.article_id.in_(article_ids)
                ).delete(synchronize_session=False)
                db.query(Document).filter(
                    Document.article_id.in_(article_ids)
                ).delete(synchronize_session=False)
                db.query(Order).filter(
                    Order.article_id.in_(article_ids)
                ).delete(synchronize_session=False)
            db.query(Article).filter(Article.bom_id == bom.id).delete(synchronize_session=False)
            # update stored labels for traceability
            bom.hugwawi_order_name = str(hugwawi_order_name)
            bom.hugwawi_article_id = int(hugwawi_article_id)
            bom.hugwawi_articlenumber = str(hugwawi_articlenumber)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Fehler beim Überschreiben: {e}")
        return {
            "bom": {
                "id": bom.id,
                "project_id": bom.project_id,
                "hugwawi_order_id": bom.hugwawi_order_id,
                "hugwawi_order_name": bom.hugwawi_order_name,
                "hugwawi_order_article_id": bom.hugwawi_order_article_id,
                "hugwawi_article_id": bom.hugwawi_article_id,
                "hugwawi_articlenumber": bom.hugwawi_articlenumber,
            },
            "overwritten": True,
        }

    bom = Bom(
        project_id=project_id,
        hugwawi_order_id=int(hugwawi_order_id),
        hugwawi_order_name=str(hugwawi_order_name),
        hugwawi_order_article_id=int(hugwawi_order_article_id),
        hugwawi_article_id=int(hugwawi_article_id) if hugwawi_article_id is not None else None,
        hugwawi_articlenumber=str(hugwawi_articlenumber),
    )
    db.add(bom)
    db.commit()
    db.refresh(bom)
    return {
        "bom": {
            "id": bom.id,
            "project_id": bom.project_id,
            "hugwawi_order_id": bom.hugwawi_order_id,
            "hugwawi_order_name": bom.hugwawi_order_name,
            "hugwawi_order_article_id": bom.hugwawi_order_article_id,
            "hugwawi_article_id": bom.hugwawi_article_id,
            "hugwawi_articlenumber": bom.hugwawi_articlenumber,
        },
        "created": True,
    }


@router.post("/projects/{project_id}/boms/{bom_id}/import-solidworks")
async def import_solidworks_into_bom(
    project_id: int,
    bom_id: int,
    request: Request,
    assembly_filepath: str = Query(None, description="Pfad zur SOLIDWORKS Assembly-Datei"),
    overwrite_password: str | None = Query(default=None, description="Passwort zum Überschreiben (aktuell: '1')"),
    db: Session = Depends(get_db),
):
    """
    Importiert SOLIDWORKS-Assembly in eine konkrete BOM.
    Wenn bereits ein Import existiert (Artikel vorhanden), ist overwrite_password=1 erforderlich.
    """
    query_params = dict(request.query_params)
    if not assembly_filepath:
        assembly_filepath = query_params.get("assembly_filepath")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    bom = db.query(Bom).filter(Bom.id == bom_id, Bom.project_id == project_id).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM nicht gefunden")

    if not assembly_filepath:
        raise HTTPException(status_code=400, detail="Assembly-Filepath fehlt")

    # Guard: only allow overwrite with password
    existing_count = db.query(Article).filter(Article.bom_id == bom_id).count()
    if existing_count > 0 and overwrite_password != "1":
        raise HTTPException(
            status_code=409,
            detail="Für diese Stückliste existiert bereits ein Import. Zum Überschreiben bitte overwrite_password=1 setzen.",
        )
    # reuse existing normalization logic by delegating to the legacy route's helper path.
    # (copy minimal normalization for connector; keep Windows path for connector)
    import urllib.parse
    import pathlib
    import os
    import ntpath

    normalized_path = assembly_filepath
    if "%" in normalized_path or ("+" in normalized_path and " " not in normalized_path):
        normalized_path = urllib.parse.unquote_plus(normalized_path)

    is_docker = os.getcwd() == "/app" or os.path.exists("/.dockerenv")
    is_windows_drive_path = bool(ntpath.splitdrive(normalized_path or "")[0]) and ntpath.isabs(normalized_path or "")
    skip_fs_exists_check = bool(is_docker and is_windows_drive_path)

    check_path = normalized_path
    if is_docker and normalized_path.startswith("C:\\"):
        if normalized_path.startswith("C:\\Thomas\\Solidworks\\"):
            relative_path = normalized_path[len("C:\\Thomas\\Solidworks\\") :]
            check_path = f"/mnt/solidworks/{relative_path}".replace("\\", "/")
        else:
            check_path = normalized_path.replace("C:\\", "/mnt/solidworks/").replace("\\", "/")
        skip_fs_exists_check = False
    else:
        if not is_docker:
            normalized_path = normalized_path.replace("/", "\\")
        normalized_path = os.path.normpath(normalized_path)
        check_path = normalized_path

    if not skip_fs_exists_check:
        check_path_obj = pathlib.Path(check_path)
        if not (os.path.exists(check_path) or check_path_obj.exists()):
            raise HTTPException(status_code=400, detail=f"Assembly-Datei existiert nicht: {normalized_path}")
        if os.path.isdir(check_path):
            try:
                files = os.listdir(check_path)
            except Exception:
                files = []
            sldasm_files = [f for f in files if f.lower().endswith(".sldasm")]
            if not sldasm_files:
                raise HTTPException(
                    status_code=400,
                    detail=f"Assembly-Pfad ist ein Ordner ohne .SLDASM: {normalized_path}",
                )
            if len(sldasm_files) > 1:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Assembly-Pfad ist ein Ordner mit mehreren .SLDASM. "
                        f"Bitte eine konkrete .SLDASM-Datei angeben. Gefunden: {', '.join(sldasm_files)}"
                    ),
                )
            connector_dir = normalized_path
            normalized_path = ntpath.normpath(os.path.join(connector_dir, sldasm_files[0]))

    from app.services.solidworks_service import import_solidworks_assembly

    result = await import_solidworks_assembly(project_id, bom_id, normalized_path, db)
    if isinstance(result, dict) and result.get("success") is False:
        raise HTTPException(status_code=502, detail=result.get("error") or "SOLIDWORKS-Import fehlgeschlagen")
    return result


@router.post("/projects/{project_id}/boms/{bom_id}/import-solidworks-job")
async def import_solidworks_into_bom_job(
    project_id: int,
    bom_id: int,
    request: Request,
    assembly_filepath: str = Query(None, description="Pfad zur SOLIDWORKS Assembly-Datei"),
    overwrite_password: str | None = Query(default=None, description="Passwort zum Überschreiben (aktuell: '1')"),
    db: Session = Depends(get_db),
):
    """
    Startet einen SOLIDWORKS-Import als Background-Job und liefert sofort eine Job-ID.
    Status wird via GET /import-jobs/{job_id} abgefragt.
    """
    query_params = dict(request.query_params)
    if not assembly_filepath:
        assembly_filepath = query_params.get("assembly_filepath")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    bom = db.query(Bom).filter(Bom.id == bom_id, Bom.project_id == project_id).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM nicht gefunden")

    if not assembly_filepath:
        raise HTTPException(status_code=400, detail="Assembly-Filepath fehlt")

    # Guard: only allow overwrite with password (same as sync route)
    existing_count = db.query(Article).filter(Article.bom_id == bom_id).count()
    if existing_count > 0 and overwrite_password != "1":
        raise HTTPException(
            status_code=409,
            detail="Für diese Stückliste existiert bereits ein Import. Zum Überschreiben bitte overwrite_password=1 setzen.",
        )
    # #region agent log
    try:
        import json, time
        with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
            _f.write(
                json.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "pre-import",
                        "hypothesisId": "IMPORT_JOB",
                        "location": "backend/app/api/routes/projects.py:import_solidworks_into_bom_job",
                        "message": "guard_passed",
                        "data": {
                            "project_id": project_id,
                            "bom_id": bom_id,
                            "existing_count": existing_count,
                            "overwrite_password_set": overwrite_password == "1",
                        },
                        "timestamp": int(time.time() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion agent log

    # Normalize path similar to sync endpoint (keep Windows path for connector)
    import urllib.parse
    import pathlib
    import os
    import ntpath

    normalized_path = assembly_filepath
    if "%" in normalized_path or ("+" in normalized_path and " " not in normalized_path):
        normalized_path = urllib.parse.unquote_plus(normalized_path)

    is_docker = os.getcwd() == "/app" or os.path.exists("/.dockerenv")
    is_windows_drive_path = bool(ntpath.splitdrive(normalized_path or "")[0]) and ntpath.isabs(normalized_path or "")
    skip_fs_exists_check = bool(is_docker and is_windows_drive_path)

    check_path = normalized_path
    if is_docker and normalized_path.startswith("C:\\"):
        if normalized_path.startswith("C:\\Thomas\\Solidworks\\"):
            relative_path = normalized_path[len("C:\\Thomas\\Solidworks\\") :]
            check_path = f"/mnt/solidworks/{relative_path}".replace("\\", "/")
        else:
            check_path = normalized_path.replace("C:\\", "/mnt/solidworks/").replace("\\", "/")
        skip_fs_exists_check = False
    else:
        if not is_docker:
            normalized_path = normalized_path.replace("/", "\\")
        normalized_path = os.path.normpath(normalized_path)
        check_path = normalized_path

    if not skip_fs_exists_check:
        check_path_obj = pathlib.Path(check_path)
        if not (os.path.exists(check_path) or check_path_obj.exists()):
            raise HTTPException(status_code=400, detail=f"Assembly-Datei existiert nicht: {normalized_path}")
        if os.path.isdir(check_path):
            try:
                files = os.listdir(check_path)
            except Exception:
                files = []
            sldasm_files = [f for f in files if f.lower().endswith(".sldasm")]
            if not sldasm_files:
                raise HTTPException(
                    status_code=400,
                    detail=f"Assembly-Pfad ist ein Ordner ohne .SLDASM: {normalized_path}",
                )
            if len(sldasm_files) > 1:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Assembly-Pfad ist ein Ordner mit mehreren .SLDASM. "
                        f"Bitte eine konkrete .SLDASM-Datei angeben. Gefunden: {', '.join(sldasm_files)}"
                    ),
                )
            connector_dir = normalized_path
            normalized_path = ntpath.normpath(os.path.join(connector_dir, sldasm_files[0]))
    # #region agent log
    try:
        import json, time
        with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
            _f.write(
                json.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "pre-import",
                        "hypothesisId": "IMPORT_JOB",
                        "location": "backend/app/api/routes/projects.py:import_solidworks_into_bom_job",
                        "message": "normalized_path",
                        "data": {
                            "project_id": project_id,
                            "bom_id": bom_id,
                            "normalized_path": normalized_path,
                        },
                        "timestamp": int(time.time() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion agent log

    from app.services.import_job_service import create_import_job, start_import_job

    job = create_import_job(db, project_id=project_id, bom_id=bom_id, assembly_filepath=normalized_path)
    start_import_job(job.id)
    return {"job_id": job.id}


@router.post("/projects/{project_id}/push-solidworks")
async def push_solidworks(
    project_id: int,
    payload: SolidworksPushRequest,
    db: Session = Depends(get_db),
):
    """
    Schreibt ausgewählte DB-Werte als SOLIDWORKS Custom Properties zurück.
    Scope: ausschließlich konfigurationsspezifisch (kein globales Schreiben).
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    ids = list(payload.article_ids or [])
    if not ids:
        raise HTTPException(status_code=400, detail="Keine article_ids angegeben")

    articles = (
        db.query(Article)
        .filter(Article.project_id == project_id, Article.id.in_(ids))
        .all()
    )
    found_ids = {a.id for a in articles}
    missing_ids = [i for i in ids if i not in found_ids]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Artikel nicht gefunden: {missing_ids[:20]}")

    # Mapping: DB-Feld -> SOLIDWORKS Property Name (VBA-Namen)
    # IMPORTANT: Do not send empty strings; otherwise we overwrite existing SOLIDWORKS values with blanks.
    def _val(v):
        if v is None:
            return None
        s = str(v)
        return s if s.strip() != "" else None

    updated = []
    failed = []

    url = f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/set-custom-properties"
    async with httpx.AsyncClient(timeout=120.0) as client:
        for a in articles:
            filepath = a.sldasm_sldprt_pfad or ""
            if not filepath:
                failed.append({"article_id": a.id, "reason": "sldasm_sldprt_pfad fehlt"})
                continue

            ext = str(filepath).lower()
            is_sldasm = ext.endswith(".sldasm")

            props = {}
            def _put(name: str, v):
                vv = _val(v)
                if vv is not None:
                    props[name] = vv

            # Zentrales Mapping: Import-Felder == Push-Felder (Single-Source-of-Truth)
            from app.services.solidworks_property_mapping import get_sw_prop_name_for_field
            for field in (
                "hg_artikelnummer",
                "teilenummer",
                "werkstoff",
                "werkstoff_nr",
                "abteilung_lieferant",
                "oberflaeche",
                "oberflaechenschutz",
                "farbe",
                "lieferzeit",
                "teiletyp_fertigungsplan",
            ):
                sw_name = get_sw_prop_name_for_field(field, is_sldasm=is_sldasm)
                if not sw_name:
                    continue
                _put(sw_name, getattr(a, field, None))

            req = {
                "filepath": filepath,
                "configuration": _val(a.konfiguration) or "",
                "scope": "config_only",
                "properties": props,
            }

            try:
                resp = await client.post(url, json=req)
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"SOLIDWORKS-Connector nicht erreichbar: {e}")

            if resp.status_code != 200:
                failed.append({"article_id": a.id, "reason": f"{resp.status_code}: {resp.text}"})
                continue

            data = resp.json() if resp.content else {}
            if not data.get("success", False):
                failed.append({"article_id": a.id, "reason": data.get("error") or "Unbekannter Fehler"})
                continue

            result = data.get("result") if isinstance(data, dict) else None
            failed_count = (result or {}).get("failed_count") if isinstance(result, dict) else None
            failed_list = (result or {}).get("failed") if isinstance(result, dict) else None

            # Treat per-property failures as a failed update for this article (otherwise issues are silent).
            if isinstance(failed_count, int) and failed_count > 0:
                failed.append(
                    {
                        "article_id": a.id,
                        "reason": "Einige Properties konnten nicht geschrieben werden",
                        "failed": failed_list,
                    }
                )
                continue

            updated.append(a.id)

    return {
        "updated": updated,
        "failed": failed,
        "updated_count": len(updated),
        "failed_count": len(failed),
    }
