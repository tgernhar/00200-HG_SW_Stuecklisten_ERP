"""
Document Service Layer
"""
import os
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.article import Article
from app.models.document import Document
from app.models.document_flag import DocumentGenerationFlag


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
    base_dir = os.path.dirname(sw_path) if sw_path else (article.pfad or "")
    base_name = os.path.splitext(os.path.basename(sw_path))[0] if sw_path else (article.teilenummer or "")

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

        if doc_type == "SW_Part_ASM":
            exists, file_path = _exists_any([sw_path])
        elif doc_type == "SW_DRW":
            # Prefer explicit slddrw_pfad, otherwise derive from base_name
            candidates = []
            if article.slddrw_pfad:
                candidates.append(article.slddrw_pfad)
            if base_dir and base_name:
                candidates.append(os.path.join(base_dir, f"{base_name}.SLDDRW"))
                candidates.append(os.path.join(base_dir, f"{base_name}.slddrw"))
            exists, file_path = _exists_any(candidates)
        else:
            suffix = "_Bestell" if doc_type in ("Bestell_PDF", "Bestell_DXF") else ""
            name = f"{base_name}{suffix}" if base_name else ""

            if doc_type in ("PDF", "Bestell_PDF"):
                candidates = [os.path.join(base_dir, f"{name}.pdf"), os.path.join(base_dir, f"{name}.PDF")]
                exists, file_path = _exists_any(candidates)
            elif doc_type in ("DXF", "Bestell_DXF"):
                candidates = [os.path.join(base_dir, f"{name}.dxf"), os.path.join(base_dir, f"{name}.DXF")]
                exists, file_path = _exists_any(candidates)
            elif doc_type == "STEP":
                candidates = [
                    os.path.join(base_dir, f"{name}.stp"),
                    os.path.join(base_dir, f"{name}.STP"),
                    os.path.join(base_dir, f"{name}.step"),
                    os.path.join(base_dir, f"{name}.STEP"),
                ]
                exists, file_path = _exists_any(candidates)
            elif doc_type == "X_T":
                candidates = [os.path.join(base_dir, f"{name}.x_t"), os.path.join(base_dir, f"{name}.X_T")]
                exists, file_path = _exists_any(candidates)
            elif doc_type == "STL":
                candidates = [os.path.join(base_dir, f"{name}.stl"), os.path.join(base_dir, f"{name}.STL")]
                exists, file_path = _exists_any(candidates)
            elif doc_type == "ESP":
                candidates = [os.path.join(base_dir, f"{name}.esp"), os.path.join(base_dir, f"{name}.ESP")]
                exists, file_path = _exists_any(candidates)

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
        
        # Prüfe welche Dokumente generiert werden sollen (Wert = "1")
        doc_mapping = {
            "PDF": flags.pdf,
            "Bestell_PDF": flags.pdf_bestell_pdf,
            "DXF": flags.dxf,
            "Bestell_DXF": flags.bestell_dxf,
            "STEP": flags.step,
            "X_T": flags.x_t,
            "STL": flags.stl
        }
        
        for doc_type in document_types:
            if doc_mapping.get(doc_type) == "1":
                try:
                    # Bestimme Dateipfad für SOLIDWORKS-Datei
                    sw_filepath = article.sldasm_sldprt_pfad
                    if not sw_filepath or not os.path.exists(sw_filepath):
                        failed.append({
                            "article_id": article.id,
                            "document_type": doc_type,
                            "reason": "SOLIDWORKS-Datei nicht gefunden"
                        })
                        continue
                    
                    # Rufe SOLIDWORKS-Connector auf
                    async with httpx.AsyncClient() as client:
                        if doc_type in ["STEP", "X_T", "STL"]:
                            # 3D-Dokumente
                            response = await client.post(
                                f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/create-3d-documents",
                                json={
                                    "filepath": sw_filepath,
                                    "step": doc_type == "STEP",
                                    "x_t": doc_type == "X_T",
                                    "stl": doc_type == "STL"
                                }
                            )
                        else:
                            # PDF/DXF
                            response = await client.post(
                                f"{settings.SOLIDWORKS_CONNECTOR_URL}/api/solidworks/generate-documents",
                                json={
                                    "filepath": sw_filepath,
                                    "document_type": doc_type
                                }
                            )
                        
                        if response.status_code == 200:
                            # Setze Flag auf "x" (erfolgreich generiert)
                            setattr(flags, doc_mapping.get(doc_type, "").lower().replace("-", "_"), "x")
                            
                            # Aktualisiere Document-Eintrag
                            doc = db.query(Document).filter(
                                Document.article_id == article.id,
                                Document.document_type == doc_type
                            ).first()
                            
                            if doc:
                                doc.exists = True
                                # TODO: Dateipfad aus Response setzen
                            else:
                                doc = Document(
                                    article_id=article.id,
                                    document_type=doc_type,
                                    exists=True
                                )
                                db.add(doc)
                            
                            generated.append({
                                "article_id": article.id,
                                "document_type": doc_type
                            })
                        else:
                            failed.append({
                                "article_id": article.id,
                                "document_type": doc_type,
                                "reason": f"SOLIDWORKS-Connector Fehler: {response.status_code}"
                            })
                            
                except Exception as e:
                    failed.append({
                        "article_id": article.id,
                        "document_type": doc_type,
                        "reason": str(e)
                    })
    
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
