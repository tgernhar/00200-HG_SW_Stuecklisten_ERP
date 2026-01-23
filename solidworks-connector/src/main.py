"""
SOLIDWORKS Connector - FastAPI Server
"""
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
from SolidWorksConnector import SolidWorksConnector
import os
import logging
import threading
from logging.handlers import RotatingFileHandler
from datetime import datetime
import time
import win32file
import win32con
import ctypes
from ctypes import wintypes
import json

# region agent log
# Debug-mode NDJSON logger (no secrets). Writes to repo-root/.cursor/debug.log
def _agent_log(hypothesisId: str, location: str, message: str, data: dict | None = None, runId: str = "run1"):
    try:
        connector_dir2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../solidworks-connector
        repo_root = os.path.dirname(connector_dir2)
        log_path = os.path.join(repo_root, ".cursor", "debug.log")
        payload = {
            "sessionId": "debug-session",
            "runId": runId,
            "hypothesisId": hypothesisId,
            "location": location,
            "message": message,
            "data": data or {},
            "timestamp": int(time.time() * 1000),
        }
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        # never crash runtime due to debug logging
        pass
# endregion

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

# region agent log
@app.on_event("startup")
async def _startup_agent_log():
    try:
        routes = []
        for r in getattr(app, "routes", []) or []:
            p = getattr(r, "path", None)
            m = getattr(r, "methods", None)
            routes.append({"path": p, "methods": sorted(list(m)) if m else None})
        _agent_log("H2", "solidworks-connector/src/main.py:startup", "startup_routes", {"route_count": len(routes), "routes": routes[:50]})
    except Exception:
        pass
# endregion

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Instrumentation: macht 422 Ursachen sichtbar (Body/JSON/Form).
    """
    try:
        body_bytes = await request.body()
        body_preview = body_bytes[:1000].decode("utf-8", errors="replace") if body_bytes else ""
    except Exception as e:
        body_preview = f"<failed to read body: {type(e).__name__}>"

    try:
        connector_logger.warning(
            f"422 RequestValidationError: errors={exc.errors()} body_preview={body_preview!r}"
        )
    except Exception:
        pass

    return JSONResponse(status_code=422, content={"detail": exc.errors()})

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




def _check_file_lock(path: str) -> tuple[bool, str | None]:
    """
    Windows file-lock check: returns (locked, error_text).
    """
    if not path:
        return False, None
    try:
        handle = win32file.CreateFile(
            path,
            win32con.GENERIC_READ,
            0,  # no sharing -> fail if already open elsewhere
            None,
            win32con.OPEN_EXISTING,
            win32con.FILE_ATTRIBUTE_NORMAL,
            None,
        )
        win32file.CloseHandle(handle)
        return False, None
    except Exception as e:
        return True, str(e)


def _get_locking_processes(path: str) -> list[dict]:
    """
    Use Windows Restart Manager to find processes locking a file.
    """
    if not path:
        return []
    try:
        rstrtmgr = ctypes.WinDLL("rstrtmgr")
    except Exception:
        return []

    CCH_RM_MAX_APP_NAME = 255
    CCH_RM_MAX_SVC_NAME = 63
    ERROR_MORE_DATA = 234

    class RM_UNIQUE_PROCESS(ctypes.Structure):
        _fields_ = [("dwProcessId", wintypes.DWORD), ("ProcessStartTime", wintypes.FILETIME)]

    class RM_PROCESS_INFO(ctypes.Structure):
        _fields_ = [
            ("Process", RM_UNIQUE_PROCESS),
            ("strAppName", wintypes.WCHAR * (CCH_RM_MAX_APP_NAME + 1)),
            ("strServiceShortName", wintypes.WCHAR * (CCH_RM_MAX_SVC_NAME + 1)),
            ("ApplicationType", wintypes.DWORD),
            ("AppStatus", wintypes.DWORD),
            ("TSSessionId", wintypes.DWORD),
            ("bRestartable", wintypes.BOOL),
        ]

    session = wintypes.DWORD(0)
    key = ctypes.create_unicode_buffer(32)
    res = rstrtmgr.RmStartSession(ctypes.byref(session), 0, key)
    if res != 0:
        return []
    try:
        resources = (wintypes.LPCWSTR * 1)(path)
        res = rstrtmgr.RmRegisterResources(session, 1, resources, 0, None, 0, None)
        if res != 0:
            return []

        needed = wintypes.DWORD(0)
        count = wintypes.DWORD(0)
        reason = wintypes.DWORD(0)
        res = rstrtmgr.RmGetList(session, ctypes.byref(needed), ctypes.byref(count), None, ctypes.byref(reason))
        if res == ERROR_MORE_DATA and needed.value > 0:
            arr = (RM_PROCESS_INFO * needed.value)()
            count = wintypes.DWORD(needed.value)
            res = rstrtmgr.RmGetList(session, ctypes.byref(needed), ctypes.byref(count), arr, ctypes.byref(reason))
            if res != 0:
                return []
            out = []
            for i in range(count.value):
                info = arr[i]
                out.append({"pid": int(info.Process.dwProcessId), "name": info.strAppName})
            return out
        if res == 0:
            return []
    finally:
        try:
            rstrtmgr.RmEndSession(session)
        except Exception:
            pass
    return []

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


class PathsOpenCheckRequest(BaseModel):
    paths: List[str]

class SetCustomPropertiesRequest(BaseModel):
    filepath: str
    configuration: Optional[str] = None
    # Kept for backward compatibility; connector writes config-specific only.
    scope: str = "config_only"
    properties: Dict[str, Optional[str]]


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
def get_all_parts_from_assembly(request: AssemblyRequest):
    """
    Liest alle Teile und Properties aus Assembly
    """
    connector = None
    try:
        # region agent log
        connector_logger.info(f"get-all-parts-from-assembly aufgerufen mit filepath: {request.assembly_filepath}")
        _agent_log("H1", "solidworks-connector/src/main.py:get_all_parts_from_assembly", "enter_v1", {"assembly_filepath": request.assembly_filepath})
        connector = get_connector()
        connector_logger.info(f"Connector-Instanz erhalten, rufe get_all_parts_and_properties_from_assembly auf...")
        results = connector.get_all_parts_and_properties_from_assembly(
            request.assembly_filepath
        )
        connector_logger.info(f"Erfolgreich: {len(results) if results else 0} Ergebnisse erhalten")
        _agent_log("H1", "solidworks-connector/src/main.py:get_all_parts_from_assembly", "exit_v1", {"results_len": len(results) if results else 0})
        
        # Session-Beendigung: Schließe SolidWorks Session nach erfolgreichem Import
        # Nur wenn der Connector die Session gestartet hat
        try:
            if connector and connector.can_close_app():
                connector.close_app(reason="import_completed")
                connector_logger.info("SolidWorks Session nach erfolgreichem Import geschlossen")
        except Exception as close_err:
            connector_logger.warning(f"Fehler beim Schließen der Session nach Import: {close_err}")
        
        return {
            "success": True,
            "results": results
        }
    except Exception as e:
        connector_logger.error(f"Fehler in get-all-parts-from-assembly: {e}", exc_info=True)
        _agent_log("H1", "solidworks-connector/src/main.py:get_all_parts_from_assembly", "error_v1", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/solidworks/get-all-parts-from-assembly-v2")
def get_all_parts_from_assembly_v2(request: AssemblyRequest):
    """
    Backward-compatible alias for setups that use SOLIDWORKS_CONNECTOR_MODE=v2 in the backend.
    Currently returns the same shape as v1.
    """
    try:
        _agent_log("H2", "solidworks-connector/src/main.py:get_all_parts_from_assembly_v2", "enter_v2", {"assembly_filepath": request.assembly_filepath})
        return get_all_parts_from_assembly(request)
    except HTTPException:
        raise
    except Exception as e:
        connector_logger.error(f"Fehler in get-all-parts-from-assembly-v2: {e}", exc_info=True)
        _agent_log("H2", "solidworks-connector/src/main.py:get_all_parts_from_assembly_v2", "error_v2", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/solidworks/create-3d-documents")
def create_3d_documents(request: Create3DDocumentsRequest):
    """
    Erstellt 3D-Dokumente (STEP, X_T, STL)
    """
    try:
        _agent_log(
            "C",
            "solidworks-connector/src/main.py:create_3d_documents",
            "enter",
            {"filepath": request.filepath, "step": request.step, "x_t": request.x_t, "stl": request.stl},
        )
        connector = get_connector()
        success = connector.create_3d_documents(
            request.filepath,
            step=request.step,
            x_t=request.x_t,
            stl=request.stl
        )
        
        if success:
            base_path = request.filepath[:-7]  # Entferne Endung
            created_files: list[str] = []
            missing: list[str] = []

            def _pick_existing(variants: list[str]) -> list[str]:
                existing = []
                for p in variants:
                    try:
                        if os.path.exists(p):
                            existing.append(p)
                    except Exception:
                        continue
                return existing

            if request.step:
                step_variants = [f"{base_path}.stp", f"{base_path}.step", f"{base_path}.STP", f"{base_path}.STEP"]
                existing = _pick_existing(step_variants)
                if existing:
                    created_files.extend(existing)
                else:
                    # show a concise missing hint (not every variant needed)
                    missing.extend([f"{base_path}.stp", f"{base_path}.step"])

            if request.x_t:
                xt_variants = [f"{base_path}.x_t", f"{base_path}.X_T"]
                existing = _pick_existing(xt_variants)
                if existing:
                    created_files.extend(existing)
                else:
                    missing.append(f"{base_path}.x_t")

            if request.stl:
                stl_variants = [f"{base_path}.stl", f"{base_path}.STL"]
                existing = _pick_existing(stl_variants)
                if existing:
                    created_files.extend(existing)
                else:
                    missing.append(f"{base_path}.stl")

            # de-dup but keep stable order
            created_files = list(dict.fromkeys(created_files))

            if missing:
                _agent_log(
                    "C",
                    "solidworks-connector/src/main.py:create_3d_documents",
                    "missing_outputs",
                    {"missing": missing, "created_files": created_files},
                )
                raise HTTPException(status_code=500, detail=f"3D Export unvollständig, fehlend: {missing[:3]}")

            return {"success": True, "created_files": created_files}
        else:
            _agent_log(
                "C",
                "solidworks-connector/src/main.py:create_3d_documents",
                "exit_false",
                {"filepath": request.filepath},
            )
            raise HTTPException(status_code=500, detail="Fehler beim Erstellen der 3D-Dokumente")
    except Exception as e:
        _agent_log(
            "C",
            "solidworks-connector/src/main.py:create_3d_documents",
            "exception",
            {"err": f"{type(e).__name__}: {e}"},
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/solidworks/create-2d-documents")
def create_2d_documents(request: Create2DDocumentsRequest):
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
def paths_exist(request: PathsExistRequest):
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


@app.post("/api/solidworks/check-open-docs")
def check_open_docs(request: PathsOpenCheckRequest):
    """
    Prüft, ob Dateien durch andere Prozesse geöffnet/gesperrt sind (Windows).
    """
    try:
        connector_logger.info(
            f"check-open-docs aufgerufen: count={len(request.paths or [])}"
        )
        connector = None
        try:
            connector = get_connector()
            if getattr(connector, "sw_app", None) is None and hasattr(connector, "connect"):
                connector.connect()
        except Exception:
            connector = None
        paths = request.paths or []
        if len(paths) > 500:
            raise HTTPException(status_code=400, detail="Zu viele Pfade (max 500)")
        open_paths = []
        lock_errors: dict[str, str] = {}
        lock_processes: dict[str, list[dict]] = {}
        missing_paths = []
        open_in_sw: dict[str, bool] = {}
        for p in paths:
            sp = str(p or "")
            if not sp:
                continue
            if not os.path.exists(sp):
                missing_paths.append(sp)
                continue
            in_sw = False
            if connector is not None and getattr(connector, "sw_app", None) is not None:
                try:
                    doc = connector.sw_app.GetOpenDocumentByName(sp)
                    if not doc:
                        base = os.path.basename(sp)
                        if base:
                            doc = connector.sw_app.GetOpenDocumentByName(base)
                    in_sw = bool(doc)
                except Exception:
                    in_sw = False
            if in_sw:
                open_paths.append(sp)
                open_in_sw[sp] = True
                continue
            locked, err = _check_file_lock(sp)
            if locked:
                open_paths.append(sp)
                if err:
                    lock_errors[sp] = err
                procs = _get_locking_processes(sp)
                if procs:
                    lock_processes[sp] = procs
                if not procs:
                    connector_logger.warning(
                        f"check-open-docs: locked without process info: {sp} err={err}"
                    )
        return {
            "success": True,
            "open_paths": open_paths,
            "missing_paths": missing_paths,
            "lock_errors": lock_errors,
            "open_in_sw": open_in_sw,
            "lock_processes": lock_processes,
            "count": len(paths),
        }
    except HTTPException:
        raise
    except Exception as e:
        connector_logger.error(f"Fehler in check-open-docs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/solidworks/open-file")
def open_file(path: str = Query(..., description="Absoluter Dateipfad auf dem Windows-Host (z.B. G:\\... oder C:\\...)")):
    """
    Liefert eine Datei (aktuell nur PDF) als HTTP-Response.
    Gedacht als Proxy-Quelle für das Backend, wenn es in Docker läuft und Host-Pfade nicht gemountet sind.
    """
    if not path:
        raise HTTPException(status_code=400, detail="Pfad fehlt")
    p = str(path)
    if not p.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Nur PDF-Dateien sind erlaubt")
    if not os.path.exists(p):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    filename = os.path.basename(p)
    return FileResponse(
        p,
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline",
    )


@app.post("/api/solidworks/set-custom-properties")
def set_custom_properties(request: SetCustomPropertiesRequest):
    """
    Setzt Custom Properties in einer SOLIDWORKS Datei (SLDPRT/SLDASM).
    """
    connector = None
    try:
        connector = get_connector()
        result = connector.set_custom_properties(
            request.filepath,
            configuration=request.configuration,
            properties=request.properties,
            scope=request.scope,
        )
        
        # Session-Beendigung: Schließe SolidWorks Session nach erfolgreichem Export
        # Nur wenn der Connector die Session gestartet hat
        try:
            if connector and connector.can_close_app():
                connector.close_app(reason="export_completed")
                connector_logger.info("SolidWorks Session nach erfolgreichem Export geschlossen")
        except Exception as close_err:
            connector_logger.warning(f"Fehler beim Schließen der Session nach Export: {close_err}")
        
        return {"success": True, "result": result}
    except Exception as e:
        connector_logger.error(f"Fehler in set-custom-properties: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/solidworks/close-app")
def close_app(reason: str = Query("manual", description="Reason for closing SOLIDWORKS")):
    """
    Schließt SOLIDWORKS nur, wenn der Connector die Instanz gestartet hat.
    """
    try:
        connector = get_connector()
        closed = connector.close_app(reason=reason)
        return {"success": True, "closed": closed}
    except Exception as e:
        connector_logger.error(f"Fehler in close-app: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
