"""
Document Service Layer
"""
import os
import ntpath
import logging
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.article import Article
from app.models.document import Document
from app.models.document_flag import DocumentGenerationFlag
from app.core.config import settings

logger = logging.getLogger(__name__)
logger.propagate = True

def _agent_log(*args, **kwargs):
    return

def _is_windows_path(p: str) -> bool:
    return bool(p) and len(p) >= 3 and p[1] == ":" and (p[2] in ("\\", "/"))

def _to_container_path(p: str) -> Optional[str]:
    """
    Mappt Windows-Pfad (C:\\Thomas\\Solidworks\\...) auf Docker-Mount (/mnt/solidworks/...)
    """
    if not p:
        return None
    p2 = p.replace("\\", "/")
    prefix = "C:/Thomas/Solidworks/"
    if p2.lower().startswith(prefix.lower()):
        rest = p2[len(prefix):]
        return f"/mnt/solidworks/{rest}"
    return None

def _dirname_any(p: str) -> str:
    # Wenn Backend unter Linux läuft, muss Windows-Pfad mit ntpath zerlegt werden.
    return ntpath.dirname(p) if _is_windows_path(p) else os.path.dirname(p)

def _basename_noext_any(p: str) -> str:
    if _is_windows_path(p):
        return ntpath.splitext(ntpath.basename(p))[0]
    return os.path.splitext(os.path.basename(p))[0]

async def check_article_documents(article_id: int, db: Session) -> dict:
    """
    Prüft Dokumente eines Artikels im Dateisystem
    
    Entspricht VBA Main_check_documents_of_Article()
    """
    # #region agent log
    import json
    log_path = r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log"
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:entry", "message": "Function entry", "data": {"article_id": article_id}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "A"}) + "\n")
    except: pass
    # #endregion
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        return {"error": "Artikel nicht gefunden"}

    # Regeln (User):
    # - Ordner: derselbe Ordner wie sldasm_sldprt_pfad
    # - Basename: Dateiname aus sldasm_sldprt_pfad ohne Endung
    # - Bestell_*: Suffix _Bestell
    # - Typen: PDF, Bestell_PDF, DXF, Bestell_DXF, STEP(.stp/.step), X_T(.x_t), STL(.stl), SW_DRW(.slddrw), SW_Part_ASM, ESP(.esp)
    doc_types = ["PDF", "Bestell_PDF", "DXF", "Bestell_DXF", "STEP", "X_T", "STL", "SW_DRW", "SW_Part_ASM", "ESP"]

    sw_path = article.sldasm_sldprt_pfad or ""
    base_dir = _dirname_any(sw_path) if sw_path else (article.pfad or "")
    base_name = _basename_noext_any(sw_path) if sw_path else (article.teilenummer or "")

    # Docker/Linux: zusätzlich Mount-Pfad ableiten
    sw_path_container = _to_container_path(sw_path) or ""
    base_dir_container = _dirname_any(sw_path_container) if sw_path_container else ""

    is_docker = bool(os.path.exists("/.dockerenv") or os.getcwd() == "/app")
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}_paths", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:paths", "message": "Path extraction", "data": {"article_id": article_id, "sw_path": sw_path, "sw_path_container": sw_path_container, "base_dir": base_dir, "base_dir_container": base_dir_container, "base_name": base_name, "is_docker": is_docker}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "B"}) + "\n")
    except: pass
    # #endregion

    async def _remote_exists_any(paths: List[str]) -> dict:
        """
        Fragt den SOLIDWORKS-Connector auf Windows, ob Pfade existieren.
        Rückgabe: {path: bool}
        """
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_entry", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_remote_exists_any:entry", "message": "_remote_exists_any called", "data": {"paths": paths[:5], "path_count": len(paths)}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
        except: pass
        # #endregion
        try:
            import httpx

            async with httpx.AsyncClient(timeout=10.0) as client:
                base = (settings.SOLIDWORKS_CONNECTOR_URL or "").rstrip("/")
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_base", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_remote_exists_any:base", "message": "Connector base URL", "data": {"base": base}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
                except: pass
                # #endregion
                # Be robust regarding base URL prefixes (some setups may set base=/api or /api/solidworks)
                candidates = []
                if base.endswith("/api/solidworks"):
                    candidates.append(f"{base}/paths-exist")
                if base.endswith("/api"):
                    candidates.append(f"{base}/solidworks/paths-exist")
                # default expected
                candidates.append(f"{base}/api/solidworks/paths-exist")
                # very defensive fallback (in case base already includes /api/solidworks implicitly elsewhere)
                candidates.append(f"{base}/paths-exist")

                resp = None
                for url in candidates:
                    try:
                        resp = await client.post(url, json={"paths": paths or []})
                        # #region agent log
                        try:
                            with open(log_path, "a", encoding="utf-8") as f:
                                f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_try", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_remote_exists_any:try", "message": "Trying connector URL", "data": {"url": url, "status_code": resp.status_code if resp else None}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
                        except: pass
                        # #endregion
                        if resp.status_code == 200:
                            break
                        # 404 likely means "old connector / wrong base", try next candidate
                    except Exception as e:
                        # #region agent log
                        try:
                            with open(log_path, "a", encoding="utf-8") as f:
                                f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_error", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_remote_exists_any:error", "message": "Connector request error", "data": {"url": url, "error": str(e)}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
                        except: pass
                        # #endregion
                        continue

                if not resp or resp.status_code != 200:
                    # #region agent log
                    try:
                        with open(log_path, "a", encoding="utf-8") as f:
                            f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_failed", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_remote_exists_any:failed", "message": "All connector URLs failed", "data": {"status_code": resp.status_code if resp else None}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
                    except: pass
                    # #endregion
                    return {p: False for p in (paths or [])}
                data = resp.json() if resp.content else {}
                exists = (data or {}).get("exists") or {}
                # Normalize keys to str
                out = {}
                for p in (paths or []):
                    out[str(p)] = bool(exists.get(str(p)))
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_success", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_remote_exists_any:success", "message": "Remote check successful", "data": {"result_count": len(out), "found_count": sum(1 for v in out.values() if v)}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
                except: pass
                # #endregion
                return out
        except Exception as e:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_exception", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_remote_exists_any:exception", "message": "Remote check exception", "data": {"error": str(e), "error_type": type(e).__name__}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
            except: pass
            # #endregion
            return {p: False for p in (paths or [])}

    async def _exists_any(paths: List[str]) -> tuple[bool, Optional[str]]:
        """
        Prüft zuerst lokal (Container), dann (in Docker) via SOLIDWORKS-Connector für Windows-Pfade,
        die nicht gemountet sind (z.B. G:\\...).
        """
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_exists_entry", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_exists_any:entry", "message": "_exists_any called", "data": {"paths": paths[:10], "path_count": len(paths), "is_docker": is_docker}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "C"}) + "\n")
        except: pass
        # #endregion
        if not paths:
            return False, None

        # 1) Local/container fast path
        remaining_remote = []
        for p in paths:
            if not p:
                continue
            try:
                exists_local = os.path.exists(p)
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_local_check", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_exists_any:local", "message": "Local path check", "data": {"path": p, "exists": exists_local}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "C"}) + "\n")
                except: pass
                # #endregion
                if exists_local:
                    return True, p
            except Exception as e:
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_local_error", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_exists_any:local_error", "message": "Local check exception", "data": {"path": p, "error": str(e)}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "C"}) + "\n")
                except: pass
                # #endregion
                pass

            # 2) In Docker: Windows drive/UNC paths können im Container nicht geprüft werden -> remote
            if is_docker and _is_windows_path(p):
                remaining_remote.append(p)

        if not remaining_remote:
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_no_remote", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_exists_any:no_remote", "message": "No remote paths to check", "data": {}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "C"}) + "\n")
            except: pass
            # #endregion
            return False, None

        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_start", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_exists_any:remote_start", "message": "Starting remote check", "data": {"remaining_remote": remaining_remote[:5]}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
        except: pass
        # #endregion
        remote_map = await _remote_exists_any(list(dict.fromkeys(remaining_remote)))
        # #region agent log
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_remote_result", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:_exists_any:remote_result", "message": "Remote check result", "data": {"remote_map": {k: v for k, v in list(remote_map.items())[:5]}}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "D"}) + "\n")
        except: pass
        # #endregion
        for p in remaining_remote:
            if remote_map.get(str(p)):
                return True, p
        return False, None

    # Load/create flags row
    flags = db.query(DocumentGenerationFlag).filter(DocumentGenerationFlag.article_id == article_id).first()
    if not flags:
        flags = DocumentGenerationFlag(article_id=article_id)
        db.add(flags)
        db.flush()

    checked = []
    updated_flags = []

    # PERFORMANCE-OPTIMIERUNG: Sammle alle Pfade für alle Dokumenttypen,
    # damit wir nur EINEN Remote-Call machen müssen statt einen pro Dokumenttyp
    all_paths_to_check = []
    doc_type_candidates = {}  # {doc_type: [candidates]}

    # Sammle alle Kandidaten pro Dokumenttyp
    for doc_type in doc_types:
        exists = False
        file_path: Optional[str] = None
        candidates_dbg: List[str] = []

        if doc_type == "SW_Part_ASM":
            candidates_dbg = [sw_path, sw_path_container]
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}_{doc_type}", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:doc_type", "message": "Checking document type", "data": {"article_id": article_id, "doc_type": doc_type, "candidates": candidates_dbg}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "E"}) + "\n")
            except: pass
            # #endregion
            exists, file_path = await _exists_any(candidates_dbg)
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}_{doc_type}_result", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:doc_type_result", "message": "Document type check result", "data": {"article_id": article_id, "doc_type": doc_type, "exists": exists, "file_path": file_path}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "E"}) + "\n")
            except: pass
            # #endregion
        elif doc_type == "SW_DRW":
            # Prefer explicit slddrw_pfad, otherwise derive from base_name
            candidates = []
            if article.slddrw_pfad:
                candidates.append(article.slddrw_pfad)
            # Windows/Container beide Varianten prüfen
            for d in [base_dir, base_dir_container]:
                if d and base_name:
                    candidates.append(os.path.join(d, f"{base_name}.SLDDRW"))
                    candidates.append(os.path.join(d, f"{base_name}.slddrw"))
            candidates_dbg = candidates
            exists, file_path = await _exists_any(candidates_dbg)
        else:
            # Bestell-Dateien: unterstütze sowohl _Bestell als auch " bestellversion" (wie im User-Beispiel)
            suffixes = [""]
            if doc_type in ("Bestell_PDF", "Bestell_DXF"):
                suffixes = ["_Bestell", " bestellversion", " Bestellversion", " Bestellzng", " bestellzng"]
            names = [f"{base_name}{s}" for s in suffixes] if base_name else [""]

            if doc_type in ("PDF", "Bestell_PDF"):
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([os.path.join(d, f"{n}.pdf"), os.path.join(d, f"{n}.PDF")])
                candidates_dbg = cand
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}_{doc_type}", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:doc_type", "message": "Checking document type", "data": {"article_id": article_id, "doc_type": doc_type, "candidates": candidates_dbg[:10], "candidate_count": len(candidates_dbg)}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "E"}) + "\n")
                except: pass
                # #endregion
                exists, file_path = await _exists_any(candidates_dbg)
                # #region agent log
                try:
                    with open(log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}_{doc_type}_result", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:doc_type_result", "message": "Document type check result", "data": {"article_id": article_id, "doc_type": doc_type, "exists": exists, "file_path": file_path}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "E"}) + "\n")
                except: pass
                # #endregion
            elif doc_type in ("DXF", "Bestell_DXF"):
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([os.path.join(d, f"{n}.dxf"), os.path.join(d, f"{n}.DXF")])
                candidates_dbg = cand
                exists, file_path = await _exists_any(candidates_dbg)
            elif doc_type == "STEP":
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([
                            os.path.join(d, f"{n}.stp"),
                            os.path.join(d, f"{n}.STP"),
                            os.path.join(d, f"{n}.step"),
                            os.path.join(d, f"{n}.STEP"),
                        ])
                candidates_dbg = cand
                exists, file_path = await _exists_any(candidates_dbg)
            elif doc_type == "X_T":
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([os.path.join(d, f"{n}.x_t"), os.path.join(d, f"{n}.X_T")])
                candidates_dbg = cand
                exists, file_path = await _exists_any(candidates_dbg)
            elif doc_type == "STL":
                # Erst exakte Namen versuchen, dann Fallback: irgendeine STL, die base_name enthält
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([os.path.join(d, f"{n}.stl"), os.path.join(d, f"{n}.STL")])
                candidates_dbg = cand
                exists, file_path = await _exists_any(candidates_dbg)
                if (not exists) and base_name:
                    for d in [base_dir, base_dir_container]:
                        if not d or not os.path.exists(d):
                            continue
                        try:
                            for fn in os.listdir(d):
                                if fn.lower().endswith(".stl") and base_name.lower() in fn.lower():
                                    fp = os.path.join(d, fn)
                                    if os.path.exists(fp):
                                        exists, file_path = True, fp
                                        candidates_dbg.append(fp)
                                        break
                        except Exception:
                            pass
            elif doc_type == "ESP":
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([os.path.join(d, f"{n}.esp"), os.path.join(d, f"{n}.ESP")])
                candidates_dbg = cand
                exists, file_path = await _exists_any(candidates_dbg)

        # Update/create Document row
        doc = db.query(Document).filter(Document.article_id == article_id, Document.document_type == doc_type).first()
        if doc:
            doc.exists = exists
            doc.file_path = file_path if exists else None
        else:
            doc = Document(article_id=article_id, document_type=doc_type, exists=exists, file_path=file_path if exists else None)
            db.add(doc)

        # Flags behavior: set to "x" ONLY when file exists
        if exists:
            if doc_type == "PDF" and getattr(flags, "pdf", "") != "x":
                flags.pdf = "x"
                updated_flags.append("pdf")
            elif doc_type == "Bestell_PDF" and getattr(flags, "pdf_bestell_pdf", "") != "x":
                flags.pdf_bestell_pdf = "x"
                updated_flags.append("pdf_bestell_pdf")
            elif doc_type == "DXF" and getattr(flags, "dxf", "") != "x":
                flags.dxf = "x"
                updated_flags.append("dxf")
            elif doc_type == "Bestell_DXF" and getattr(flags, "bestell_dxf", "") != "x":
                flags.bestell_dxf = "x"
                updated_flags.append("bestell_dxf")
            elif doc_type == "STEP" and getattr(flags, "step", "") != "x":
                flags.step = "x"
                updated_flags.append("step")
            elif doc_type == "X_T" and getattr(flags, "x_t", "") != "x":
                flags.x_t = "x"
                updated_flags.append("x_t")
            elif doc_type == "STL" and getattr(flags, "stl", "") != "x":
                flags.stl = "x"
                updated_flags.append("stl")

        checked.append({"document_type": doc_type, "exists": exists, "file_path": file_path})

    try:
        db.commit()
    except Exception as commit_error:
        # #region agent log
        try:
            import traceback
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}_commit_error", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:commit_error", "message": "DB commit error in check_article_documents", "data": {"article_id": article_id, "error": str(commit_error), "error_type": type(commit_error).__name__, "traceback": traceback.format_exc()[-500:]}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "F"}) + "\n")
        except: pass
        # #endregion
        # Rollback und erneut versuchen
        try:
            db.rollback()
        except:
            pass
        # Erneut versuchen zu committen
        try:
            db.commit()
        except Exception as retry_error:
            # #region agent log
            try:
                import traceback
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}_commit_retry_error", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:commit_retry_error", "message": "DB commit retry error", "data": {"article_id": article_id, "error": str(retry_error), "error_type": type(retry_error).__name__}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "F"}) + "\n")
            except: pass
            # #endregion
            # Wenn auch der Retry fehlschlägt, Exception weiterwerfen
            raise
    
    result = {"checked": checked, "updated_flags": sorted(set(updated_flags))}
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_{article_id}_final", "timestamp": int(__import__('time').time() * 1000), "location": "document_service.py:check_article_documents:final", "message": "Function exit with result", "data": {"article_id": article_id, "checked_count": len(checked), "found_count": sum(1 for c in checked if c.get("exists")), "updated_flags": result.get("updated_flags", [])}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "F"}) + "\n")
    except: pass
    # #endregion
    return result


async def generate_single_document(
    article_id: int,
    document_types: List[str],
    db: Session
) -> dict:
    """Generiert einzelnes Dokument für spezifischen Dokumenttyp"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        return {"error": "Artikel nicht gefunden"}
    
    # TODO: Implementierung für SOLIDWORKS-Connector-Aufruf
    return {"message": "Dokumentgenerierung noch nicht implementiert"}


async def batch_generate_documents(
    project_id: int,
    document_types: Optional[List[str]],
    db: Session
) -> dict:
    """
    Batch-Generierung: Durchläuft alle Artikel, generiert Dokumente wo Wert="1"
    
    Entspricht VBA Main_Create_Solidworks_Documents()
    """
    from app.core.config import settings
    import httpx
    
    articles = db.query(Article).filter(Article.project_id == project_id).all()
    
    if not document_types:
        document_types = ["PDF", "Bestell_PDF", "DXF", "Bestell_DXF", "STEP", "X_T", "STL"]

    requested_types = set(document_types)

    _agent_log(
        "A",
        "document_service.py:batch_generate_documents",
        "start",
        {"project_id": project_id, "requested_types": sorted(list(requested_types))},
    )
    
    generated = []
    failed = []
    skipped = []
    
    for article in articles:
        # Hole Document Flags
        flags = db.query(DocumentGenerationFlag).filter(
            DocumentGenerationFlag.article_id == article.id
        ).first()
        
        if not flags:
            continue
        
        # Welche Dokumente sollen erzeugt werden? (Wert = "1" und in requested_types)
        want_pdf = flags.pdf == "1" and "PDF" in requested_types
        want_bestell_pdf = flags.pdf_bestell_pdf == "1" and "Bestell_PDF" in requested_types
        want_dxf = flags.dxf == "1" and "DXF" in requested_types
        want_bestell_dxf = flags.bestell_dxf == "1" and "Bestell_DXF" in requested_types

        want_step = flags.step == "1" and "STEP" in requested_types
        want_x_t = flags.x_t == "1" and "X_T" in requested_types
        want_stl = flags.stl == "1" and "STL" in requested_types

        # Helper: existence check in container and on host
        is_docker = bool(os.path.exists("/.dockerenv") or os.getcwd() == "/app")

        async def _remote_exists(p: str) -> bool:
            """
            In Docker: Windows-Pfade (z.B. G:\\...) sind nicht gemountet.
            Wir fragen den SOLIDWORKS-Connector auf Windows, ob die Datei existiert.
            """
            if not p:
                return False
            if not (is_docker and _is_windows_path(p)):
                return False
            try:
                base = (settings.SOLIDWORKS_CONNECTOR_URL or "").rstrip("/")
                candidates = []
                if base.endswith("/api/solidworks"):
                    candidates.append(f"{base}/paths-exist")
                if base.endswith("/api"):
                    candidates.append(f"{base}/solidworks/paths-exist")
                candidates.append(f"{base}/api/solidworks/paths-exist")
                candidates.append(f"{base}/paths-exist")
                async with httpx.AsyncClient(timeout=10.0) as client:
                    for url in candidates:
                        try:
                            resp = await client.post(url, json={"paths": [p]})
                            if resp.status_code == 200:
                                data = resp.json() if resp.content else {}
                                exists_map = (data or {}).get("exists") or {}
                                return bool(exists_map.get(p))
                        except Exception:
                            continue
            except Exception:
                return False
            return False

        async def _exists_backend_or_remote(p: Optional[str]) -> bool:
            if not p:
                return False
            try:
                if os.path.exists(p):
                    return True
            except Exception:
                pass
            p_container = _to_container_path(p)
            try:
                if p_container and os.path.exists(p_container):
                    return True
            except Exception:
                pass
            return await _remote_exists(p)

        # 2D: eine Anfrage pro Artikel (minimiert Open/Close in SOLIDWORKS)
        if want_pdf or want_bestell_pdf or want_dxf or want_bestell_dxf:
            sw_drawing_path = article.slddrw_pfad
            if not sw_drawing_path:
                # fallback: aus Part/ASM ableiten -> gleiche Dir, gleiche Base, .SLDDRW
                if article.sldasm_sldprt_pfad:
                    base_dir = _dirname_any(article.sldasm_sldprt_pfad)
                    base_name = _basename_noext_any(article.sldasm_sldprt_pfad)
                    if base_dir and base_name:
                        sw_drawing_path = os.path.join(base_dir, f"{base_name}.SLDDRW")

            exists_backend = await _exists_backend_or_remote(sw_drawing_path) if sw_drawing_path else False
            sw_drawing_path_container = _to_container_path(sw_drawing_path) if sw_drawing_path else None

            if not sw_drawing_path or not exists_backend:
                _agent_log(
                    "A",
                    "document_service.py:batch_generate_documents",
                    "2d_missing_slddrw",
                    {
                        "article_id": article.id,
                        "slddrw_pfad": article.slddrw_pfad,
                        "sldasm_sldprt_pfad": article.sldasm_sldprt_pfad,
                        "derived_slddrw": sw_drawing_path,
                        "exists_backend": exists_backend,
                        "derived_container": sw_drawing_path_container,
                    },
                )
                for doc_type in ["PDF", "Bestell_PDF", "DXF", "Bestell_DXF"]:
                    if doc_type in requested_types and (
                        (doc_type == "PDF" and want_pdf)
                        or (doc_type == "Bestell_PDF" and want_bestell_pdf)
                        or (doc_type == "DXF" and want_dxf)
                        or (doc_type == "Bestell_DXF" and want_bestell_dxf)
                    ):
                        failed.append(
                            {
                                "article_id": article.id,
                                "document_type": doc_type,
                                "reason": "SOLIDWORKS-Zeichnung (.SLDDRW) nicht gefunden",
                            }
                        )
            else:
                try:
                    # SOLIDWORKS Export kann deutlich länger als 5s dauern.
                    # Default-httpx-timeout (~5s) führt sonst zu ReadTimeout, obwohl der Connector später erfolgreich fertig wird.
                    async with httpx.AsyncClient(timeout=300.0) as client:
                        url = f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/create-2d-documents"
                        payload = {
                            "filepath": sw_drawing_path,
                            "pdf": want_pdf,
                            "dxf": want_dxf,
                            "bestell_pdf": want_bestell_pdf,
                            "bestell_dxf": want_bestell_dxf,
                        }
                        _agent_log(
                            "A",
                            "document_service.py:batch_generate_documents",
                            "2d_call_connector",
                            {
                                "article_id": article.id,
                                "url": url,
                                "payload": payload,
                                "slddrw_path_container": sw_drawing_path_container,
                            },
                        )
                        response = await client.post(
                            url,
                            json=payload,
                        )

                    _agent_log(
                        "A",
                        "document_service.py:batch_generate_documents",
                        "2d_connector_response",
                        {
                            "article_id": article.id,
                            "status_code": response.status_code,
                            "body_snippet": (response.text or "")[:400],
                        },
                    )
                    if response.status_code == 200:
                        data = response.json() if response.content else {}
                        created_files = data.get("created_files", []) or []
                        # Warnings sind optional, werden hier nur geloggt
                        warnings = data.get("warnings", []) or []
                        if warnings:
                            logger.warning(f"2D-Export warnings (article_id={article.id}): {warnings}")

                        # Mapping von doc_type -> flag_field
                        flag_field_by_type = {
                            "PDF": "pdf",
                            "Bestell_PDF": "pdf_bestell_pdf",
                            "DXF": "dxf",
                            "Bestell_DXF": "bestell_dxf",
                        }

                        # File mapping
                        created_by_type = {}
                        for fp in created_files:
                            fn = os.path.basename(str(fp)).lower()
                            if fn.endswith(".pdf"):
                                if "bestellzng" in fn:
                                    created_by_type["Bestell_PDF"] = fp
                                else:
                                    created_by_type["PDF"] = fp
                            if fn.endswith(".dxf"):
                                if "bestellzng" in fn:
                                    created_by_type["Bestell_DXF"] = fp
                                else:
                                    created_by_type["DXF"] = fp

                        for doc_type, wanted in [
                            ("PDF", want_pdf),
                            ("Bestell_PDF", want_bestell_pdf),
                            ("DXF", want_dxf),
                            ("Bestell_DXF", want_bestell_dxf),
                        ]:
                            if not wanted:
                                continue
                            setattr(flags, flag_field_by_type[doc_type], "x")

                            doc = (
                                db.query(Document)
                                .filter(Document.article_id == article.id, Document.document_type == doc_type)
                                .first()
                            )
                            if doc:
                                doc.exists = True
                                doc.file_path = created_by_type.get(doc_type)
                            else:
                                doc = Document(
                                    article_id=article.id,
                                    document_type=doc_type,
                                    exists=True,
                                    file_path=created_by_type.get(doc_type),
                                )
                                db.add(doc)

                            generated.append({"article_id": article.id, "document_type": doc_type})
                    else:
                        for doc_type, wanted in [
                            ("PDF", want_pdf),
                            ("Bestell_PDF", want_bestell_pdf),
                            ("DXF", want_dxf),
                            ("Bestell_DXF", want_bestell_dxf),
                        ]:
                            if wanted:
                                failed.append(
                                    {
                                        "article_id": article.id,
                                        "document_type": doc_type,
                                        "reason": f"SOLIDWORKS-Connector Fehler: {response.status_code}",
                                    }
                                )
                except Exception as e:
                    for doc_type, wanted in [
                        ("PDF", want_pdf),
                        ("Bestell_PDF", want_bestell_pdf),
                        ("DXF", want_dxf),
                        ("Bestell_DXF", want_bestell_dxf),
                    ]:
                        if wanted:
                            reason = str(e) or f"{type(e).__name__}"
                            failed.append({"article_id": article.id, "document_type": doc_type, "reason": reason})

        # 3D: eine Anfrage pro Artikel (STEP/X_T/STL zusammen)
        if want_step or want_x_t or want_stl:
            sw_filepath = article.sldasm_sldprt_pfad
            exists_backend = await _exists_backend_or_remote(sw_filepath) if sw_filepath else False
            if not sw_filepath or not exists_backend:
                _agent_log(
                    "A",
                    "document_service.py:batch_generate_documents",
                    "3d_missing_sldprt_sldasm",
                    {"article_id": article.id, "sldasm_sldprt_pfad": sw_filepath, "exists_backend": exists_backend},
                )
                for doc_type, wanted in [("STEP", want_step), ("X_T", want_x_t), ("STL", want_stl)]:
                    if wanted:
                        failed.append(
                            {"article_id": article.id, "document_type": doc_type, "reason": "SOLIDWORKS-Datei nicht gefunden"}
                        )
            else:
                try:
                    # 3D Exporte können ebenfalls länger dauern als Default-timeout
                    async with httpx.AsyncClient(timeout=300.0) as client:
                        url = f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/create-3d-documents"
                        payload = {"filepath": sw_filepath, "step": want_step, "x_t": want_x_t, "stl": want_stl}
                        _agent_log(
                            "A",
                            "document_service.py:batch_generate_documents",
                            "3d_call_connector",
                            {"article_id": article.id, "url": url, "payload": payload},
                        )
                        response = await client.post(url, json=payload)

                    _agent_log(
                        "A",
                        "document_service.py:batch_generate_documents",
                        "3d_connector_response",
                        {
                            "article_id": article.id,
                            "status_code": response.status_code,
                            "body_snippet": (response.text or "")[:400],
                        },
                    )
                    if response.status_code == 200:
                        data = response.json() if response.content else {}
                        created_files = data.get("created_files", []) or []

                        flag_field_by_type = {"STEP": "step", "X_T": "x_t", "STL": "stl"}
                        created_by_type = {}
                        for fp in created_files:
                            fn = os.path.basename(str(fp)).lower()
                            if fn.endswith(".stp") or fn.endswith(".step"):
                                created_by_type["STEP"] = fp
                            elif fn.endswith(".x_t"):
                                created_by_type["X_T"] = fp
                            elif fn.endswith(".stl"):
                                created_by_type["STL"] = fp

                        for doc_type, wanted in [("STEP", want_step), ("X_T", want_x_t), ("STL", want_stl)]:
                            if not wanted:
                                continue
                            fp = created_by_type.get(doc_type)
                            if not fp:
                                failed.append(
                                    {
                                        "article_id": article.id,
                                        "document_type": doc_type,
                                        "reason": "Connector meldet Erfolg, aber Output-Datei fehlt",
                                    }
                                )
                                continue

                            setattr(flags, flag_field_by_type[doc_type], "x")

                            doc = (
                                db.query(Document)
                                .filter(Document.article_id == article.id, Document.document_type == doc_type)
                                .first()
                            )
                            if doc:
                                doc.exists = True
                                doc.file_path = fp
                            else:
                                doc = Document(
                                    article_id=article.id,
                                    document_type=doc_type,
                                    exists=True,
                                    file_path=fp,
                                )
                                db.add(doc)

                            generated.append({"article_id": article.id, "document_type": doc_type})
                    else:
                        for doc_type, wanted in [("STEP", want_step), ("X_T", want_x_t), ("STL", want_stl)]:
                            if wanted:
                                failed.append(
                                    {
                                        "article_id": article.id,
                                        "document_type": doc_type,
                                        "reason": f"SOLIDWORKS-Connector Fehler: {response.status_code}",
                                    }
                                )
                except Exception as e:
                    for doc_type, wanted in [("STEP", want_step), ("X_T", want_x_t), ("STL", want_stl)]:
                        if wanted:
                            reason = str(e) or f"{type(e).__name__}"
                            failed.append({"article_id": article.id, "document_type": doc_type, "reason": reason})
    
    db.commit()

    # Small summary for runtime evidence (avoid huge payloads)
    try:
        _agent_log(
            "A",
            "document_service.py:batch_generate_documents",
            "summary",
            {
                "project_id": project_id,
                "generated_count": len(generated),
                "failed_count": len(failed),
                "skipped_count": len(skipped),
                "failed_sample": failed[:8],
            },
        )
    except Exception:
        pass
    
    return {
        "generated": generated,
        "failed": failed,
        "skipped": skipped
    }


async def batch_print_pdf(
    project_id: int,
    confirm_printer_setup: bool,
    db: Session
) -> dict:
    """
    Batch-PDF-Druck entsprechend VBA Main_Print_PDF()
    
    Bedingung für jede Zeile:
    - B1 (pdf_drucken) = "1" UND B2 (pdf) = "x"
    """
    articles = db.query(Article).filter(Article.project_id == project_id).all()
    
    printed = []
    failed = []
    skipped = []
    
    for article in articles:
        # Hole Document Flags
        flags = db.query(DocumentGenerationFlag).filter(
            DocumentGenerationFlag.article_id == article.id
        ).first()
        
        if not flags:
            skipped.append({
                "article_id": article.id,
                "reason": "Keine Document Flags vorhanden"
            })
            continue
        
        # Prüfe Bedingung: B1="1" UND B2="x"
        if flags.pdf_drucken == "1" and flags.pdf == "x":
            try:
                # Lese PDF-Dokument
                pdf_doc = db.query(Document).filter(
                    Document.article_id == article.id,
                    Document.document_type == "PDF"
                ).first()
                
                if not pdf_doc or not pdf_doc.file_path:
                    skipped.append({
                        "article_id": article.id,
                        "reason": "Kein PDF-Link vorhanden"
                    })
                    continue
                
                # Prüfe Datei-Existenz
                if not os.path.exists(pdf_doc.file_path):
                    failed.append({
                        "article_id": article.id,
                        "reason": f"Datei nicht gefunden: {pdf_doc.file_path}"
                    })
                    continue
                
                # Drucke PDF über System-Drucker
                print_result = print_pdf_file(pdf_doc.file_path)
                
                if print_result:
                    # Setze B1 auf "x" (gedruckt)
                    flags.pdf_drucken = "x"
                    db.commit()
                    
                    printed.append({
                        "article_id": article.id,
                        "file_path": pdf_doc.file_path
                    })
                else:
                    failed.append({
                        "article_id": article.id,
                        "reason": "Druck fehlgeschlagen"
                    })
                    
            except Exception as e:
                failed.append({
                    "article_id": article.id,
                    "reason": str(e)
                })
        else:
            skipped.append({
                "article_id": article.id,
                "reason": "Bedingung nicht erfüllt (B1!=1 oder B2!=x)"
            })
    
    return {
        "printed": printed,
        "failed": failed,
        "skipped": skipped
    }


def print_pdf_file(file_path: str) -> bool:
    """
    Druckt eine PDF-Datei über den System-Standarddrucker.
    
    Plattform-spezifische Implementierung:
    - Windows: subprocess mit Adobe Reader / Windows PDF Printer
    - Linux: lp/lpr Command
    """
    import platform
    import subprocess
    
    system = platform.system()
    
    if system == "Windows":
        # Option 3: Direkt über Windows API (empfohlen für Server)
        try:
            import win32api
            win32api.ShellExecute(0, "print", file_path, None, ".", 0)
            return True
        except ImportError:
            # Fallback: subprocess
            subprocess.run(['powershell', '-Command', 
                           f'Start-Process -FilePath "{file_path}" -Verb Print'])
            return True
            
    elif system == "Linux":
        # Linux: lp Command
        result = subprocess.run(['lp', file_path], capture_output=True)
        return result.returncode == 0
    
    return False
