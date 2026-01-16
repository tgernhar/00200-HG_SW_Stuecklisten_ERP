"""
SOLIDWORKS Connector - FastAPI Server
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from SolidWorksConnector import SolidWorksConnector
import os
import logging
import threading
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Konfiguriere Logging
connector_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
log_dir = os.path.join(connector_dir, 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f'solidworks_connector_{datetime.now().strftime("%Y%m%d")}.log')

# Erstelle Logger
connector_logger = logging.getLogger('solidworks_connector')
connector_logger.setLevel(logging.DEBUG)

# File Handler mit Rotation
file_handler = RotatingFileHandler(
    log_file,
    maxBytes=10*1024*1024,  # 10 MB
    backupCount=5,
    encoding='utf-8'
)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
file_handler.setFormatter(file_formatter)

# Console Handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)

# Füge Handler hinzu (nur wenn noch nicht vorhanden)
if not connector_logger.handlers:
    connector_logger.addHandler(file_handler)
    connector_logger.addHandler(console_handler)

# Stelle sicher, dass der Logger auch in die Datei schreibt
connector_logger.propagate = False  # Verhindere Propagation zum Root-Logger, da wir eigene Handler haben

connector_logger.info(f"SOLIDWORKS-Connector-Logging initialisiert. Log-Datei: {log_file}")

app = FastAPI(title="SOLIDWORKS Connector API", version="1.0.0")

# IMPORTANT:
# FastAPI request handlers may run in different threads. COM objects (SOLIDWORKS)
# are generally apartment-threaded and must not be used across threads.
# Therefore we keep ONE connector instance PER THREAD.
_thread_local = threading.local()

def get_connector():
    """Get or create the SolidWorks connector instance"""
    if not hasattr(_thread_local, "connector") or _thread_local.connector is None:
        _thread_local.connector = SolidWorksConnector()
    return _thread_local.connector


class AssemblyRequest(BaseModel):
    assembly_filepath: str


class Create3DDocumentsRequest(BaseModel):
    filepath: str
    step: bool = False
    x_t: bool = False
    stl: bool = False


class Create2DDocumentsRequest(BaseModel):
    filepath: str
    pdf: bool = False
    dxf: bool = False
    bestell_pdf: bool = False
    bestell_dxf: bool = False


class PathsExistRequest(BaseModel):
    paths: List[str]


@app.get("/")
async def root():
    return {"message": "SOLIDWORKS Connector API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/test-log")
async def test_log():
    """Test-Endpoint (File-Logging ist über den Logger abgedeckt)."""
    connector_logger.info("/test-log aufgerufen")
    return {"status": "success", "message": "OK"}


@app.post("/api/solidworks/get-all-parts-from-assembly")
async def get_all_parts_from_assembly(request: AssemblyRequest):
    """
    Liest alle Teile und Properties aus Assembly
    """
    try:
        connector_logger.info(f"get-all-parts-from-assembly aufgerufen mit filepath: {request.assembly_filepath}")
        connector = get_connector()
        connector_logger.info(f"Connector-Instanz erhalten, rufe get_all_parts_and_properties_from_assembly auf...")
        results = connector.get_all_parts_and_properties_from_assembly(
            request.assembly_filepath
        )
        connector_logger.info(f"Erfolgreich: {len(results) if results else 0} Ergebnisse erhalten")
        return {
            "success": True,
            "results": results
        }
    except Exception as e:
        connector_logger.error(f"Fehler in get-all-parts-from-assembly: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/solidworks/create-3d-documents")
async def create_3d_documents(request: Create3DDocumentsRequest):
    """
    Erstellt 3D-Dokumente (STEP, X_T, STL)
    """
    try:
        connector = get_connector()
        success = connector.create_3d_documents(
            request.filepath,
            step=request.step,
            x_t=request.x_t,
            stl=request.stl
        )
        
        if success:
            created_files = []
            base_path = request.filepath[:-7]  # Entferne Endung
            if request.step:
                created_files.append(f"{base_path}.stp")
            if request.x_t:
                created_files.append(f"{base_path}.x_t")
            if request.stl:
                created_files.append(f"{base_path}.stl")
            
            return {
                "success": True,
                "created_files": created_files
            }
        else:
            raise HTTPException(status_code=500, detail="Fehler beim Erstellen der 3D-Dokumente")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/solidworks/create-2d-documents")
async def create_2d_documents(request: Create2DDocumentsRequest):
    """
    Erstellt 2D-Dokumente (PDF, DXF) aus Zeichnung (.SLDDRW).

    Für Bestell-Varianten wird intern eine definierte Notiz temporär verschoben,
    exportiert und anschließend wieder zurückgesetzt.
    """
    try:
        connector = get_connector()
        result = connector.create_2d_documents(
            request.filepath,
            pdf=request.pdf,
            dxf=request.dxf,
            bestell_pdf=request.bestell_pdf,
            bestell_dxf=request.bestell_dxf,
        )

        # Normalize response shape
        success = bool(result.get("success"))
        created_files = result.get("created_files", []) or []
        warnings = result.get("warnings", []) or []

        if not success:
            raise HTTPException(status_code=500, detail="Fehler beim Erstellen der 2D-Dokumente")
        return {
            "success": True,
            "created_files": created_files,
            "warnings": warnings,
        }
    except HTTPException:
        raise
    except Exception as e:
        connector_logger.error(f"Fehler in create-2d-documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/solidworks/paths-exist")
async def paths_exist(request: PathsExistRequest):
    """
    Prüft Dateiexistenz auf dem Windows-Host (wo der Connector läuft).
    Wird vom Backend genutzt, wenn es in Docker/Linux läuft und Windows-Pfade (z.B. G:\\...) nicht gemountet sind.
    """
    try:
        paths = request.paths or []
        # Begrenze, um Missbrauch zu vermeiden (kein Security-Feature, nur Schutz).
        if len(paths) > 500:
            raise HTTPException(status_code=400, detail="Zu viele Pfade (max 500)")
        result = {}
        for p in paths:
            # Keine Normalisierung erzwingen; os.path.exists kann Windows-Pfade direkt prüfen.
            try:
                result[str(p)] = bool(p) and os.path.exists(str(p))
            except Exception:
                result[str(p)] = False
        return {"success": True, "exists": result, "count": len(result)}
    except HTTPException:
        raise
    except Exception as e:
        connector_logger.error(f"Fehler in paths-exist: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
