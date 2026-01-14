"""
Project Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.project import Project
from app.schemas.project import Project as ProjectSchema, ProjectCreate, ProjectUpdate
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/projects", response_model=List[ProjectSchema])
async def get_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Liste aller Projekte"""
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects


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
        print(f"DEBUG: Creating project with data: {project.dict()}")
        
        # Prüfe ob Projekt mit dieser Auftragsnummer bereits existiert
        existing_project = db.query(Project).filter(Project.au_nr == project.au_nr).first()
        if existing_project:
            print(f"DEBUG: Project with au_nr '{project.au_nr}' already exists, ID: {existing_project.id}")
            raise HTTPException(
                status_code=400,
                detail=f"Ein Projekt mit der Auftragsnummer '{project.au_nr}' existiert bereits (ID: {existing_project.id}). Bitte verwenden Sie eine andere Auftragsnummer oder löschen Sie das bestehende Projekt."
            )
        
        db_project = Project(**project.dict())
        print(f"DEBUG: Project object created: {db_project}")
        db.add(db_project)
        print("DEBUG: Project added to session")
        db.commit()
        print("DEBUG: Changes committed")
        db.refresh(db_project)
        print(f"DEBUG: Project refreshed, ID: {db_project.id}")
        return db_project
    except HTTPException:
        # HTTPException weiterwerfen (z.B. für Duplicate-Key-Fehler)
        raise
    except Exception as e:
        db.rollback()
        import traceback
        from sqlalchemy.exc import IntegrityError
        
        error_details = traceback.format_exc()
        print(f"ERROR: Error creating project: {e}")
        print(f"ERROR: Traceback: {error_details}")
        print(f"ERROR: Project data was: {project.dict()}")
        
        # Spezielle Behandlung für Duplicate-Key-Fehler
        if isinstance(e, IntegrityError) and "Duplicate entry" in str(e):
            raise HTTPException(
                status_code=400,
                detail=f"Ein Projekt mit der Auftragsnummer '{project.au_nr}' existiert bereits. Bitte verwenden Sie eine andere Auftragsnummer."
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
    db: Session = Depends(get_db)
):
    """
    Importiert SOLIDWORKS-Assembly in Projekt
    
    Entspricht VBA Main_Create_Projektsheet()
    """
    import sys
    sys.stdout.flush()
    
    # Prüfe Query-Parameter direkt aus Request
    query_params = dict(request.query_params)
    logger.error(f"DEBUG: import_solidworks called - project_id: {project_id}")
    logger.error(f"DEBUG: assembly_filepath from Query: {assembly_filepath}")
    logger.error(f"DEBUG: All query params: {query_params}")
    logger.error(f"DEBUG: Request URL: {request.url}")
    
    print(f"DEBUG: import_solidworks called - project_id: {project_id}, assembly_filepath: {assembly_filepath}", flush=True)
    print(f"DEBUG: assembly_filepath type: {type(assembly_filepath)}, repr: {repr(assembly_filepath)}", flush=True)
    print(f"DEBUG: All query params: {query_params}", flush=True)
    print(f"DEBUG: Request URL: {request.url}", flush=True)
    sys.stdout.flush()
    
    # Falls assembly_filepath None ist, versuche es aus Query-Params zu holen
    if not assembly_filepath:
        assembly_filepath = query_params.get('assembly_filepath')
        logger.error(f"DEBUG: Got assembly_filepath from query_params: {assembly_filepath}")
        print(f"DEBUG: Got assembly_filepath from query_params: {assembly_filepath}", flush=True)
    
    # Prüfe ob Projekt existiert
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    # Prüfe ob Assembly-Filepath vorhanden
    if not assembly_filepath:
        print("ERROR: assembly_filepath is None or empty")
        raise HTTPException(
            status_code=400,
            detail="Assembly-Filepath fehlt"
        )
    
    # Normalisiere den Pfad (Backslashes, Leerzeichen, etc.)
    import urllib.parse
    import pathlib
    
    # FastAPI dekodiert Query-Parameter bereits, aber prüfe ob noch Encoding vorhanden ist
    normalized_path = assembly_filepath
    print(f"DEBUG: Before decoding - normalized_path: {repr(normalized_path)}", flush=True)
    
    # Prüfe ob der Pfad noch URL-encoded ist (enthält % oder +)
    if '%' in normalized_path or ('+' in normalized_path and ' ' not in normalized_path):
        # Verwende unquote_plus, um auch + Zeichen als Leerzeichen zu dekodieren
        normalized_path = urllib.parse.unquote_plus(normalized_path)
        print(f"DEBUG: Path was URL-encoded, decoded to: {normalized_path}", flush=True)
    
    # Prüfe ob wir in Docker laufen (cwd ist /app)
    is_docker = os.getcwd() == '/app' or os.path.exists('/.dockerenv')
    
    # Wenn in Docker und der Pfad ein Windows-Pfad ist, konvertiere zu Docker-Pfad
    if is_docker and normalized_path.startswith('C:\\'):
        # Konvertiere Windows-Pfad zu Docker-Pfad
        # Volume ist gemountet als: C:/Thomas/Solidworks:/mnt/solidworks
        # C:\Thomas\Solidworks\Kapselhalter und Kutsche\Baugr1.SLDASM -> /mnt/solidworks/Kapselhalter und Kutsche/Baugr1.SLDASM
        if normalized_path.startswith('C:\\Thomas\\Solidworks\\'):
            # Entferne C:\Thomas\Solidworks\ und ersetze mit /mnt/solidworks/
            relative_path = normalized_path[len('C:\\Thomas\\Solidworks\\'):]
            docker_path = f'/mnt/solidworks/{relative_path}'.replace('\\', '/')
            print(f"DEBUG: Docker detected, converting path: {normalized_path} -> {docker_path}", flush=True)
            normalized_path = docker_path
        else:
            # Fallback: Einfache Ersetzung
            docker_path = normalized_path.replace('C:\\', '/mnt/solidworks/').replace('\\', '/')
            print(f"DEBUG: Docker detected, converting path (fallback): {normalized_path} -> {docker_path}", flush=True)
            normalized_path = docker_path
    else:
        # Ersetze forward slashes mit backslashes für Windows (nur wenn nicht in Docker)
        if not is_docker:
            normalized_path = normalized_path.replace('/', '\\')
        # Normalisiere den Pfad (entfernt doppelte Backslashes, etc.)
        normalized_path = os.path.normpath(normalized_path)
    
    print(f"DEBUG: After normpath - normalized_path: {repr(normalized_path)}", flush=True)
    print(f"DEBUG: Is Docker: {is_docker}", flush=True)
    
    print(f"DEBUG: Original path: {assembly_filepath}", flush=True)
    print(f"DEBUG: Normalized path: {normalized_path}", flush=True)
    
    # Verwende pathlib für bessere Pfad-Behandlung
    # WICHTIG: Auf Windows verwende den Pfad direkt, da er bereits absolut ist
    path_obj = pathlib.Path(normalized_path)
    
    # Prüfe ob der Pfad bereits absolut ist (Windows: beginnt mit C:\ oder ähnlich)
    is_absolute = os.path.isabs(normalized_path) or (os.name == 'nt' and (normalized_path.startswith('C:\\') or normalized_path.startswith('D:\\')))
    
    # Auf Windows: Verwende den Pfad direkt, ohne absolute() aufzurufen
    if os.name == 'nt' and is_absolute:
        # Windows-Pfad, verwende direkt
        exists_os = os.path.exists(normalized_path)
        exists_pathlib = path_obj.exists()
    else:
        # Nicht-Windows oder relativer Pfad
        exists_os = os.path.exists(normalized_path)
        exists_pathlib = path_obj.exists()
    
    is_file = path_obj.is_file() if exists_pathlib else False
    
    print(f"DEBUG: File exists (os.path.exists): {exists_os}", flush=True)
    print(f"DEBUG: File exists (pathlib): {exists_pathlib}", flush=True)
    print(f"DEBUG: Is file: {is_file}", flush=True)
    print(f"DEBUG: Path string: {str(path_obj)}", flush=True)
    print(f"DEBUG: Is absolute: {is_absolute}", flush=True)
    print(f"DEBUG: CWD: {os.getcwd()}", flush=True)
    print(f"DEBUG: OS name: {os.name}", flush=True)
    sys.stdout.flush()
    
    # Wenn die Datei nicht existiert, prüfe ob das Verzeichnis existiert
    if not exists_os and not exists_pathlib:
        # Versuche auch den Original-Pfad
        if os.path.exists(assembly_filepath):
            normalized_path = assembly_filepath
            print(f"DEBUG: Original path exists, using it: {normalized_path}", flush=True)
        else:
            # Prüfe ob es ein Verzeichnis-Problem ist
            dir_path = os.path.dirname(normalized_path)
            file_name = os.path.basename(normalized_path)
            print(f"DEBUG: Directory exists: {os.path.exists(dir_path)}", flush=True)
            print(f"DEBUG: Directory path: {dir_path}", flush=True)
            print(f"DEBUG: File name: {file_name}", flush=True)
            
            # Liste Dateien im Verzeichnis (falls es existiert)
            if os.path.exists(dir_path):
                files = os.listdir(dir_path)
                print(f"DEBUG: Files in directory: {files[:10]}", flush=True)  # Erste 10 Dateien
                # Prüfe ob die Datei mit einem anderen Namen existiert
                matching_files = [f for f in files if f.endswith('.SLDASM')]
                print(f"DEBUG: SLDASM files in directory: {matching_files}", flush=True)
            
            # Versuche nochmal mit pathlib.resolve()
            try:
                resolved = pathlib.Path(normalized_path).resolve()
                print(f"DEBUG: Resolved path: {resolved}", flush=True)
                print(f"DEBUG: Resolved exists: {resolved.exists()}", flush=True)
                if resolved.exists():
                    normalized_path = str(resolved)
                    exists_os = True
                    exists_pathlib = True
                    print(f"DEBUG: Resolved path exists after error: {normalized_path}", flush=True)
                else:
                    # Prüfe ob das Verzeichnis existiert
                    resolved_dir = resolved.parent
                    print(f"DEBUG: Resolved directory: {resolved_dir}", flush=True)
                    print(f"DEBUG: Resolved directory exists: {resolved_dir.exists()}", flush=True)
                    if resolved_dir.exists():
                        dir_files = list(resolved_dir.iterdir())
                        print(f"DEBUG: Files in resolved directory: {[f.name for f in dir_files[:10]]}", flush=True)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Assembly-Datei existiert nicht: {normalized_path} (resolved: {resolved}, resolved exists: {resolved.exists()})"
                    )
            except Exception as resolve_error:
                import traceback
                error_trace = traceback.format_exc()
                print(f"DEBUG: Resolve error traceback: {error_trace}", flush=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"Assembly-Datei existiert nicht: {normalized_path} (resolve error: {str(resolve_error)}, type: {type(resolve_error).__name__})"
                )
    
    assembly_filepath = normalized_path
    
    from app.services.solidworks_service import import_solidworks_assembly
    result = await import_solidworks_assembly(project_id, assembly_filepath, db)
    return result
