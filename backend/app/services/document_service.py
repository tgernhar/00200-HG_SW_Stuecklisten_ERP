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

logger = logging.getLogger(__name__)
logger.propagate = True

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

    def _exists_any(paths: List[str]) -> tuple[bool, Optional[str]]:
        for p in paths:
            if p and os.path.exists(p):
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

    for doc_type in doc_types:
        exists = False
        file_path: Optional[str] = None
        candidates_dbg: List[str] = []

        if doc_type == "SW_Part_ASM":
            candidates_dbg = [sw_path, sw_path_container]
            exists, file_path = _exists_any(candidates_dbg)
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
            exists, file_path = _exists_any(candidates_dbg)
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
                exists, file_path = _exists_any(candidates_dbg)
            elif doc_type in ("DXF", "Bestell_DXF"):
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([os.path.join(d, f"{n}.dxf"), os.path.join(d, f"{n}.DXF")])
                candidates_dbg = cand
                exists, file_path = _exists_any(candidates_dbg)
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
                exists, file_path = _exists_any(candidates_dbg)
            elif doc_type == "X_T":
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([os.path.join(d, f"{n}.x_t"), os.path.join(d, f"{n}.X_T")])
                candidates_dbg = cand
                exists, file_path = _exists_any(candidates_dbg)
            elif doc_type == "STL":
                # Erst exakte Namen versuchen, dann Fallback: irgendeine STL, die base_name enthält
                cand = []
                for d in [base_dir, base_dir_container]:
                    for n in names:
                        cand.extend([os.path.join(d, f"{n}.stl"), os.path.join(d, f"{n}.STL")])
                candidates_dbg = cand
                exists, file_path = _exists_any(candidates_dbg)
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
                exists, file_path = _exists_any(candidates_dbg)

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
    return {"checked": checked, "updated_flags": sorted(set(updated_flags))}


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
        def _exists_backend(p: Optional[str]) -> bool:
            if not p:
                return False
            if os.path.exists(p):
                return True
            p_container = _to_container_path(p)
            return bool(p_container and os.path.exists(p_container))

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

            exists_backend = _exists_backend(sw_drawing_path) if sw_drawing_path else False
            sw_drawing_path_container = _to_container_path(sw_drawing_path) if sw_drawing_path else None

            if not sw_drawing_path or not exists_backend:
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
                        response = await client.post(
                            url,
                            json={
                                "filepath": sw_drawing_path,
                                "pdf": want_pdf,
                                "dxf": want_dxf,
                                "bestell_pdf": want_bestell_pdf,
                                "bestell_dxf": want_bestell_dxf,
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
            if not sw_filepath or not _exists_backend(sw_filepath):
                for doc_type, wanted in [("STEP", want_step), ("X_T", want_x_t), ("STL", want_stl)]:
                    if wanted:
                        failed.append(
                            {"article_id": article.id, "document_type": doc_type, "reason": "SOLIDWORKS-Datei nicht gefunden"}
                        )
            else:
                try:
                    # 3D Exporte können ebenfalls länger dauern als Default-timeout
                    async with httpx.AsyncClient(timeout=300.0) as client:
                        response = await client.post(
                            f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/create-3d-documents",
                            json={
                                "filepath": sw_filepath,
                                "step": want_step,
                                "x_t": want_x_t,
                                "stl": want_stl,
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
