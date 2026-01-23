"""
Performance-optimierte Version von check_article_documents

Reduziert HTTP-Requests von ~10 pro Artikel auf 1 pro Artikel durch Batch-Processing
"""
import os
import ntpath
import logging
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Tuple
from app.models.article import Article
from app.models.document import Document
from app.models.document_flag import DocumentGenerationFlag
from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_windows_path(p: str) -> bool:
    return bool(p) and len(p) >= 3 and p[1] == ":" and (p[2] in ("\\", "/"))


def _to_container_path(p: str) -> Optional[str]:
    """Mappt Windows-Pfad auf Docker-Mount"""
    if not p:
        return None
    p2 = p.replace("\\", "/")
    prefix = "C:/Thomas/Solidworks/"
    if p2.lower().startswith(prefix.lower()):
        rest = p2[len(prefix):]
        return f"/mnt/solidworks/{rest}"
    return None


def _dirname_any(p: str) -> str:
    return ntpath.dirname(p) if _is_windows_path(p) else os.path.dirname(p)


def _basename_noext_any(p: str) -> str:
    if _is_windows_path(p):
        return ntpath.splitext(ntpath.basename(p))[0]
    return os.path.splitext(os.path.basename(p))[0]


async def check_article_documents_optimized(article_id: int, db: Session) -> dict:
    """
    Performance-optimierte Version: Batch-Processing für alle Pfad-Checks
    
    Reduziert HTTP-Requests von ~10 pro Artikel auf 1 pro Artikel
    """
    import json
    import time as _time
    
    start_time = _time.time()
    log_path = r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log"
    
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        return {"error": "Artikel nicht gefunden"}

    doc_types = ["PDF", "Bestell_PDF", "DXF", "Bestell_DXF", "STEP", "X_T", "STL", "SW_DRW", "SW_Part_ASM", "ESP"]

    sw_path = article.sldasm_sldprt_pfad or ""
    base_dir = _dirname_any(sw_path) if sw_path else (article.pfad or "")
    base_name = _basename_noext_any(sw_path) if sw_path else (article.teilenummer or "")

    sw_path_container = _to_container_path(sw_path) or ""
    base_dir_container = _dirname_any(sw_path_container) if sw_path_container else ""

    is_docker = bool(os.path.exists("/.dockerenv") or os.getcwd() == "/app")

    # Load/create flags row
    flags = db.query(DocumentGenerationFlag).filter(DocumentGenerationFlag.article_id == article_id).first()
    if not flags:
        flags = DocumentGenerationFlag(article_id=article_id)
        db.add(flags)
        db.flush()

    # PHASE 1: Sammle alle Pfad-Kandidaten für alle Dokumenttypen
    doc_type_candidates: Dict[str, List[str]] = {}
    
    for doc_type in doc_types:
        candidates = []
        
        if doc_type == "SW_Part_ASM":
            candidates = [sw_path, sw_path_container]
        elif doc_type == "SW_DRW":
            if article.slddrw_pfad:
                candidates.append(article.slddrw_pfad)
            for d in [base_dir, base_dir_container]:
                if d and base_name:
                    candidates.extend([
                        os.path.join(d, f"{base_name}.SLDDRW"),
                        os.path.join(d, f"{base_name}.slddrw")
                    ])
        else:
            suffixes = [""]
            if doc_type in ("Bestell_PDF", "Bestell_DXF"):
                suffixes = ["_Bestell", " bestellversion", " Bestellversion", " Bestellzng", " bestellzng"]
            names = [f"{base_name}{s}" for s in suffixes] if base_name else [""]

            if doc_type in ("PDF", "Bestell_PDF"):
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        candidates.extend([os.path.join(d, f"{n}.pdf"), os.path.join(d, f"{n}.PDF")])
            elif doc_type in ("DXF", "Bestell_DXF"):
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        candidates.extend([os.path.join(d, f"{n}.dxf"), os.path.join(d, f"{n}.DXF")])
            elif doc_type == "STEP":
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        candidates.extend([
                            os.path.join(d, f"{n}.stp"), os.path.join(d, f"{n}.STP"),
                            os.path.join(d, f"{n}.step"), os.path.join(d, f"{n}.STEP"),
                        ])
            elif doc_type == "X_T":
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        candidates.extend([os.path.join(d, f"{n}.x_t"), os.path.join(d, f"{n}.X_T")])
            elif doc_type == "STL":
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        candidates.extend([os.path.join(d, f"{n}.stl"), os.path.join(d, f"{n}.STL")])
            elif doc_type == "ESP":
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        candidates.extend([os.path.join(d, f"{n}.esp"), os.path.join(d, f"{n}.ESP")])
        
        doc_type_candidates[doc_type] = [c for c in candidates if c]  # Filter None/empty

    # PHASE 2: Prüfe lokal und sammle Windows-Pfade für Remote-Check
    doc_type_results: Dict[str, Tuple[bool, Optional[str]]] = {}
    all_windows_paths_to_check = set()
    
    for doc_type, candidates in doc_type_candidates.items():
        found_local = False
        found_path = None
        
        # Versuche zuerst lokal
        for p in candidates:
            if not p:
                continue
            try:
                if os.path.exists(p):
                    found_local = True
                    found_path = p
                    break
            except Exception:
                pass
        
        if found_local:
            doc_type_results[doc_type] = (True, found_path)
        else:
            # Sammle Windows-Pfade für späteren Batch-Check
            if is_docker:
                for p in candidates:
                    if p and _is_windows_path(p):
                        all_windows_paths_to_check.add(p)
            doc_type_results[doc_type] = (False, None)  # Preliminary result
    
    # PHASE 3: Batch-Remote-Check für alle Windows-Pfade (ein einziger HTTP-Request!)
    remote_exists_map: Dict[str, bool] = {}
    if all_windows_paths_to_check:
        try:
            import httpx
            
            paths_list = list(all_windows_paths_to_check)
            async with httpx.AsyncClient(timeout=10.0) as client:
                base = (settings.SOLIDWORKS_CONNECTOR_URL or "").rstrip("/")
                candidates_urls = []
                if base.endswith("/api/solidworks"):
                    candidates_urls.append(f"{base}/paths-exist")
                if base.endswith("/api"):
                    candidates_urls.append(f"{base}/solidworks/paths-exist")
                candidates_urls.append(f"{base}/api/solidworks/paths-exist")
                candidates_urls.append(f"{base}/paths-exist")

                resp = None
                for url in candidates_urls:
                    try:
                        resp = await client.post(url, json={"paths": paths_list})
                        if resp.status_code == 200:
                            break
                    except Exception:
                        continue

                if resp and resp.status_code == 200:
                    data = resp.json() if resp.content else {}
                    exists_data = (data or {}).get("exists") or {}
                    for p in paths_list:
                        remote_exists_map[str(p)] = bool(exists_data.get(str(p)))
                else:
                    # Fehler: Setze alle als nicht existent
                    for p in paths_list:
                        remote_exists_map[str(p)] = False
        except Exception:
            # Fehler: Setze alle als nicht existent
            for p in all_windows_paths_to_check:
                remote_exists_map[str(p)] = False
    
    # PHASE 4: Ordne Remote-Ergebnisse den Dokumenttypen zu
    for doc_type, candidates in doc_type_candidates.items():
        exists, found_path = doc_type_results[doc_type]
        
        # Nur prüfen, wenn lokal nicht gefunden
        if not exists:
            for p in candidates:
                if p and p in remote_exists_map and remote_exists_map[p]:
                    doc_type_results[doc_type] = (True, p)
                    break
    
    # PHASE 5: STL-Fallback (Wildcard-Suche)
    if not doc_type_results.get("STL", (False, None))[0] and base_name:
        for d in [base_dir, base_dir_container]:
            if not d or not os.path.exists(d):
                continue
            try:
                for fn in os.listdir(d):
                    if fn.lower().endswith(".stl") and base_name.lower() in fn.lower():
                        fp = os.path.join(d, fn)
                        if os.path.exists(fp):
                            doc_type_results["STL"] = (True, fp)
                            break
            except Exception:
                pass
            if doc_type_results.get("STL", (False, None))[0]:
                break
    
    # PHASE 6: DB-Update
    checked = []
    updated_flags = []
    
    for doc_type in doc_types:
        exists, file_path = doc_type_results.get(doc_type, (False, None))
        
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

    db.commit()
    
    elapsed = _time.time() - start_time
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"id": f"log_{int(_time.time())}_{article_id}_optimized", "timestamp": int(_time.time() * 1000), "location": "document_service_optimized.py:check_article_documents_optimized", "message": "Function completed (optimized)", "data": {"article_id": article_id, "elapsed_seconds": round(elapsed, 3), "checked_count": len(checked), "found_count": sum(1 for c in checked if c.get("exists")), "remote_paths_checked": len(all_windows_paths_to_check), "updated_flags": sorted(set(updated_flags))}, "sessionId": "debug-session", "runId": "run2", "hypothesisId": "PERF"}) + "\n")
    except: pass
    # #endregion
    
    return {"checked": checked, "updated_flags": sorted(set(updated_flags))}
