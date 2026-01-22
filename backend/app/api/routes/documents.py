"""
Document Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.config import settings
from app.models.article import Article
from app.models.project import Project
from app.models.document import Document
from app.models.document_flag import DocumentGenerationFlag
import logging
import os
import ntpath
from fastapi.responses import HTMLResponse
import json
from pypdf import PdfReader, PdfWriter
import time
import uuid
from io import BytesIO

router = APIRouter()
logger = logging.getLogger(__name__)
logger.propagate = True

def _agent_log(*args, **kwargs):
    return


def _to_container_path(p: str) -> str:
    """
    Mappt Windows-Pfad (C:\\Thomas\\Solidworks\\...) auf Docker-Mount (/mnt/solidworks/...)
    """
    p2 = (p or "").replace("\\", "/")
    prefix = "C:/Thomas/Solidworks/"
    if p2.lower().startswith(prefix.lower()):
        return "/mnt/solidworks/" + p2[len(prefix):]
    return p or ""


def _is_allowed_path(p: str) -> bool:
    # Minimaler Schutz: nur PDFs unter dem gemounteten Root erlauben.
    try:
        abspath = os.path.abspath(p)
        root = os.path.abspath("/mnt/solidworks")
        return os.path.commonpath([abspath, root]) == root
    except Exception:
        return False


@router.get("/articles/{article_id}/documents")
async def get_documents(article_id: int, db: Session = Depends(get_db)):
    """Dokumentstatus abrufen"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    documents = db.query(Document).filter(Document.article_id == article_id).all()
    return documents


@router.get("/documents/open-pdf")
async def open_pdf(path: str = Query(..., description="PDF-Dateipfad (im Container z.B. /mnt/solidworks/...)")):
    """
    Liefert eine PDF als HTTP-Response, damit Browser sie öffnen kann (file:// wird meist blockiert).
    """
    if not path:
        raise HTTPException(status_code=400, detail="Pfad fehlt")

    resolved = _to_container_path(path)
    if not resolved.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Nur PDF-Dateien sind erlaubt")

    resolved = os.path.normpath(resolved)

    # One-shot runtime evidence for path mapping/allowlist/existence
    _agent_log(
        "B",
        "documents.py:open_pdf",
        "open_pdf_check",
        {
            "input_path": path,
            "resolved_path": resolved,
            "allowed": _is_allowed_path(resolved),
            "exists": os.path.exists(resolved),
        },
    )

    allowed = _is_allowed_path(resolved)
    exists = os.path.exists(resolved)

    # Normal path: only allow serving from mounted root
    if allowed and exists:
        filename = os.path.basename(resolved)
        return FileResponse(
            resolved,
            media_type="application/pdf",
            filename=filename,
            content_disposition_type="inline",
        )

    # Fallback: Backend runs in Docker and can't access Windows drives (e.g. G:\...).
    # We proxy the PDF bytes from the SOLIDWORKS-Connector (Windows host).
    try:
        import httpx

        base = (settings.SOLIDWORKS_CONNECTOR_URL or "").rstrip("/")
        url = f"{base}/api/solidworks/open-file"
        _agent_log(
            "B",
            "documents.py:open_pdf",
            "open_pdf_fallback_proxy",
            {"input_path": path, "resolved_path": resolved, "allowed": allowed, "exists": exists, "proxy_url": url},
        )
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, params={"path": path})
        _agent_log(
            "B",
            "documents.py:open_pdf",
            "open_pdf_fallback_proxy_response",
            {"status_code": resp.status_code, "bytes": (len(resp.content) if resp.content else 0), "text_snip": (resp.text or "")[:160]},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"Connector PDF Proxy Fehler: {resp.text[:200]}")
        filename = os.path.basename(path.replace("\\", "/"))
        return Response(
            content=resp.content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Datei nicht gefunden/Proxy fehlgeschlagen: {type(e).__name__}: {e}")


@router.get("/documents/view-pdf", response_class=HTMLResponse)
async def view_pdf(
    path: str = Query(..., description="PDF-Dateipfad (im Container z.B. /mnt/solidworks/...)"),
    return_to: str = Query("", description="Return URL (z.B. /api/projects/{id}/print-pdf-queue-page)"),
    autoprint: int = Query(0, description="1 = direkt window.print() auslösen"),
):
    """
    HTML-Viewer für PDFs (Backend-Origin). Optional direkt Druckdialog öffnen.
    """
    if not path:
        raise HTTPException(status_code=400, detail="Pfad fehlt")

    if not (path or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Nur PDF-Dateien sind erlaubt")
    # NOTE: Do NOT enforce container allowlist here.
    # `open_pdf` will enforce allowlist for mounted files and will proxy from the connector for Windows paths.

    # Build URLs relative to API root (/api) - path will be encoded in JS
    open_url_base = "/api/documents/open-pdf?path="
    # Allow both relative (/api/...) and same-origin absolute return URLs.
    rt = (return_to or "").strip()
    safe_return = ""
    if rt.startswith("/api/"):
        safe_return = rt
    elif rt.startswith("http://localhost:8000/api/") or rt.startswith("http://127.0.0.1:8000/api/"):
        safe_return = rt
    do_print = "true" if autoprint == 1 else "false"

    back_link_html = f'<a class="btn" href="{safe_return}">Zurück zur Queue</a>' if safe_return else ""

    _path_json = json.dumps(path)
    _return_json = json.dumps(safe_return)

    html = f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PDF Viewer</title>
    <style>
      body {{ font-family: Arial, sans-serif; margin: 0; }}
      .bar {{ display:flex; gap:10px; align-items:center; padding:10px; border-bottom:1px solid #eee; }}
      .btn {{ padding:6px 10px; border:1px solid #ccc; background:#f7f7f7; cursor:pointer; }}
      .muted {{ color:#666; font-size:12px; }}
      .frame {{ width:100vw; height: calc(100vh - 52px); border:0; }}
    </style>
  </head>
  <body>
    <div class="bar">
      {back_link_html}
      <button class="btn" onclick="printPdf()">Drucken (Chrome)</button>
      <span class="muted">Im Druckdialog kannst du A4/A3 sowie Hoch/Quer einstellen.</span>
    </div>
    <embed id="pdfEmbed" class="frame" type="application/pdf" />
    <script>
      const pdfPath = {_path_json};
      const returnTo = {_return_json};
      const autoPrint = {do_print};
      const emb = document.getElementById('pdfEmbed');
      const src = '{open_url_base}' + encodeURIComponent(pdfPath);

      emb.addEventListener('load', () => {{
        if (autoPrint) printPdf();
      }});

      // Fetch the PDF as Blob first to avoid Chrome treating some PDFs as downloads when used as <embed src="...">.
      (async () => {{
        try {{
          const r = await fetch(src, {{ method: 'GET' }});
          const ct = r.headers.get('content-type');
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const buf = await r.arrayBuffer();
          const blob = new Blob([buf], {{ type: ct || 'application/pdf' }});
          const blobUrl = URL.createObjectURL(blob);
          emb.src = blobUrl;
          // Autoprint: if embed load doesn't fire for blob in some browsers, still attempt after src set.
          if (autoPrint) {{
            setTimeout(() => {{
              printPdf();
            }}, 50);
          }}
        }} catch (e) {{
          emb.src = src;
        }}
      }})().catch(()=>{{}});

      function printPdf() {{
        try {{
          window.print();
          return;
        }} catch (e) {{
        }}
      }}
    </script>
  </body>
</html>"""
    return HTMLResponse(content=html)


@router.post("/articles/{article_id}/check-documents")
async def check_documents(article_id: int, db: Session = Depends(get_db)):
    """Dokumente prüfen (Dateisystem-Check)"""
    from app.services.document_service import check_article_documents
    
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    result = await check_article_documents(article_id, db)
    return result


@router.post("/articles/{article_id}/generate-documents")
async def generate_documents(
    article_id: int,
    document_types: List[str],
    db: Session = Depends(get_db)
):
    """Einzelnes Dokument generieren (für spezifischen Dokumenttyp)"""
    from app.services.document_service import generate_single_document
    
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    result = await generate_single_document(article_id, document_types, db)
    return result


@router.post("/projects/{project_id}/generate-documents-batch")
async def generate_documents_batch(
    project_id: int,
    document_types: Optional[List[str]] = None,
    db: Session = Depends(get_db)
):
    """
    Batch-Generierung: Durchläuft alle Artikel, generiert Dokumente wo Wert="1"
    """
    from app.services.document_service import batch_generate_documents
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    _agent_log(
        "A",
        "documents.py:generate_documents_batch",
        "batch_endpoint_called",
        {"project_id": project_id, "document_types": document_types or None},
    )
    result = await batch_generate_documents(project_id, document_types, db)

    return result


@router.post("/projects/{project_id}/batch-print-pdf")
async def batch_print_pdf_endpoint(
    project_id: int,
    confirm_printer_setup: bool = True,
    db: Session = Depends(get_db)
):
    """
    Batch-PDF-Druck: Durchläuft alle Artikel, druckt PDFs wo B1="1" UND B2="x"
    
    Entspricht VBA Main_Print_PDF()
    """
    from app.services.document_service import batch_print_pdf
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    result = await batch_print_pdf(project_id, confirm_printer_setup, db)
    return {
        "success": True,
        "printed_count": len(result["printed"]),
        "failed_count": len(result["failed"]),
        "skipped_count": len(result["skipped"]),
        "details": result
    }


@router.post("/projects/{project_id}/check-documents-batch")
async def check_documents_batch(project_id: int, db: Session = Depends(get_db)):
    """Projektweite Dokumentprüfung (Dateisystem-Check)"""
    from app.services.document_service import check_article_documents

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    articles = db.query(Article).filter(Article.project_id == project_id).all()
    # #region agent log
    import json
    log_path = r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log"
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_batch_start", "timestamp": int(__import__('time').time() * 1000), "location": "documents.py:check_documents_batch:start", "message": "Batch check started", "data": {"project_id": project_id, "article_count": len(articles)}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "G"}) + "\n")
    except: pass
    # #endregion

    checked_articles = 0
    checked_docs = 0
    found_docs = 0
    updated_flags_count = 0
    failures = []

    for article in articles:
        try:
            result = await check_article_documents(article.id, db)
            checked_articles += 1
            checked_list = result.get("checked", []) if isinstance(result, dict) else []
            checked_docs += len(checked_list)
            found_docs += sum(1 for d in checked_list if d.get("exists"))
            updated_flags_count += len(result.get("updated_flags", [])) if isinstance(result, dict) else 0
            # #region agent log
            try:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_batch_article", "timestamp": int(__import__('time').time() * 1000), "location": "documents.py:check_documents_batch:article", "message": "Article processed", "data": {"article_id": article.id, "checked_count": len(checked_list), "found_count": sum(1 for d in checked_list if d.get("exists")), "result_keys": list(result.keys()) if isinstance(result, dict) else []}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "G"}) + "\n")
            except: pass
            # #endregion
        except Exception as e:
            failures.append({"article_id": article.id, "error": str(e)})
            # #region agent log
            try:
                import traceback
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_batch_error", "timestamp": int(__import__('time').time() * 1000), "location": "documents.py:check_documents_batch:error", "message": "Article processing error", "data": {"article_id": article.id, "error": str(e), "error_type": type(e).__name__, "traceback": traceback.format_exc()[-500:]}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "G"}) + "\n")
            except: pass
            # #endregion
            # Wichtig: Rollback nur für diesen Artikel, nicht für die gesamte Batch-Operation
            try:
                db.rollback()
            except:
                pass
    
    # Stelle sicher, dass alle DB-Commits abgeschlossen sind
    try:
        db.commit()
    except Exception as commit_error:
        # #region agent log
        try:
            import traceback
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_batch_commit_error", "timestamp": int(__import__('time').time() * 1000), "location": "documents.py:check_documents_batch:commit_error", "message": "DB commit error", "data": {"error": str(commit_error), "error_type": type(commit_error).__name__, "traceback": traceback.format_exc()[-500:]}, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "G"}) + "\n")
        except: pass
        # #endregion
        # Versuche Rollback, aber fahre trotzdem fort
        try:
            db.rollback()
        except:
            pass

    final_result = {
        "success": True,
        "project_id": project_id,
        "checked_articles": checked_articles,
        "checked_documents": checked_docs,
        "found_documents": found_docs,
        "updated_flags": updated_flags_count,
        "failed": failures,
        "failed_count": len(failures),
    }
    # #region agent log
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"id": f"log_{int(__import__('time').time())}_batch_final", "timestamp": int(__import__('time').time() * 1000), "location": "documents.py:check_documents_batch:final", "message": "Batch check completed", "data": final_result, "sessionId": "debug-session", "runId": "run1", "hypothesisId": "G"}) + "\n")
    except: pass
    # #endregion
    return final_result


@router.get("/projects/{project_id}/print-pdf-queue")
async def get_print_pdf_queue(project_id: int, db: Session = Depends(get_db)):
    """
    Liefert eine Queue von PDFs, die gedruckt werden sollen:
    - flags.pdf_drucken == "1"
    - flags.pdf == "x"
    - PDF-Dokument existiert (documents.exists == True) und file_path vorhanden
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    articles = (
        db.query(Article)
        .filter(Article.project_id == project_id)
        .all()
    )

    queue = []
    for a in articles:
        flags = db.query(DocumentGenerationFlag).filter(DocumentGenerationFlag.article_id == a.id).first()
        if not flags or flags.pdf_drucken != "1" or flags.pdf != "x":
            continue

        pdf_doc = db.query(Document).filter(Document.article_id == a.id, Document.document_type == "PDF").first()
        if not pdf_doc or not pdf_doc.file_path or not getattr(pdf_doc, "exists", False):
            continue

        queue.append({
            "article_id": a.id,
            "pos_nr": getattr(a, "pos_nr", None),
            "benennung": getattr(a, "benennung", None),
            "pdf_path": pdf_doc.file_path,
        })

    return {"project_id": project_id, "count": len(queue), "items": queue}


@router.get("/projects/{project_id}/print-pdf-queue-merged")
async def get_print_pdf_queue_merged(project_id: int, db: Session = Depends(get_db)):
    """
    Merged alle PDFs der Druck-Queue (pdf_drucken=1 & pdf=x & PDF exists) zu einer Sammel-PDF.
    Reihenfolge entspricht der Queue-Reihenfolge aus get_print_pdf_queue (aktueller DB/Iter order).
    """
    queue_payload = await get_print_pdf_queue(project_id, db)
    items = (queue_payload or {}).get("items") or []
    if not items:
        raise HTTPException(status_code=400, detail="Keine PDFs in der Druck-Queue gefunden")

    writer = PdfWriter()
    missing = []
    for it in items:
        p = (it or {}).get("pdf_path")
        if not p:
            continue
        try:
            resolved = os.path.normpath(_to_container_path(p))
            if os.path.exists(resolved) and _is_allowed_path(resolved):
                reader = PdfReader(resolved)
            else:
                # Fallback: proxy bytes from connector
                import httpx

                base = (settings.SOLIDWORKS_CONNECTOR_URL or "").rstrip("/")
                url = f"{base}/api/solidworks/open-file"
                _agent_log(
                    "B",
                    "documents.py:get_print_pdf_queue_merged",
                    "merge_fetch_via_connector",
                    {"pdf_path": p, "resolved": resolved, "proxy_url": url, "allowed": _is_allowed_path(resolved), "exists": os.path.exists(resolved)},
                )
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.get(url, params={"path": p})
                _agent_log(
                    "B",
                    "documents.py:get_print_pdf_queue_merged",
                    "merge_fetch_via_connector_response",
                    {"pdf_path": p, "status_code": resp.status_code, "bytes": (len(resp.content) if resp.content else 0), "text_snip": (resp.text or "")[:160]},
                )
                if resp.status_code != 200:
                    missing.append(p)
                    continue
                reader = PdfReader(BytesIO(resp.content))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF Merge Fehler: {p}: {type(e).__name__}: {e}")

    if missing:
        raise HTTPException(status_code=404, detail=f"PDF(s) nicht gefunden: {missing[:3]}{' ...' if len(missing)>3 else ''}")

    out_dir = "/app/uploads"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"print_queue_{project_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}.pdf")
    with open(out_path, "wb") as f:
        writer.write(f)

    filename = os.path.basename(out_path)
    return FileResponse(
        out_path,
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="inline",
    )

@router.get("/projects/{project_id}/print-pdf-queue-page", response_class=HTMLResponse)
async def print_pdf_queue_page(project_id: int):
    """
    Eine einfache Browser-Queue-Seite (ein Tab), die markierte PDFs lädt und Links zum Öffnen/Drucken anbietet.
    Der eigentliche Druckdialog (A4/A3/Hoch/Quer) kommt aus Chrome.
    """
    html = f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PDF Druck-Queue – Projekt {project_id}</title>
    <style>
      body {{ font-family: Arial, sans-serif; margin: 16px; }}
      .row {{ display:flex; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid #eee; }}
      .btn {{ padding:6px 10px; border:1px solid #ccc; background:#f7f7f7; cursor:pointer; }}
      .muted {{ color:#666; font-size:12px; }}
      .header {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }}
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h2 style="margin:0;">PDF Druck-Queue</h2>
        <div class="muted">Projekt {project_id} – Drucke über den Chrome-Druckdialog (A4/A3/Hoch/Quer einstellbar)</div>
      </div>
      <button class="btn" onclick="location.reload()">Neu laden</button>
    </div>
    <div id="status" class="muted">Lade…</div>
    <div id="list"></div>

    <script>
      const apiBase = location.origin + "/api";
      const projectId = {project_id};
      const statusEl = document.getElementById("status");
      const listEl = document.getElementById("list");

      function esc(s) {{
        return (s||"").toString().replace(/[&<>\"']/g, c => ({{"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","'":"&#39;"}}[c]));
      }}

      async function loadQueue() {{
        const res = await fetch(`${{apiBase}}/projects/${{projectId}}/print-pdf-queue`);
        if (!res.ok) {{
          const t = await res.text();
          statusEl.textContent = "Fehler: " + t;
          return;
        }}
        const data = await res.json();
        statusEl.textContent = `Gefunden: ${{data.count}} PDF(s) (pdf_drucken=1 & pdf=x)`;
        listEl.innerHTML = "";

        (data.items || []).forEach((it, idx) => {{
          const row = document.createElement("div");
          row.className = "row";
          const title = document.createElement("div");
          title.style.flex = "1";
          title.innerHTML = `<div><strong>${{esc(it.pos_nr ?? "")}}</strong> ${{esc(it.benennung ?? "")}}</div><div class="muted">${{esc(it.pdf_path)}}</div>`;

          const openBtn = document.createElement("button");
          openBtn.className = "btn";
          openBtn.textContent = "PDF öffnen";
          openBtn.onclick = () => {{
            // Öffnet PDF-Viewer im selben Tab.
            const ret = `${{apiBase}}/projects/${{projectId}}/print-pdf-queue-page`;
            location.href = `${{apiBase}}/documents/view-pdf?path=${{encodeURIComponent(it.pdf_path)}}&return_to=${{encodeURIComponent(ret)}}`;
          }};

          const printBtn = document.createElement("button");
          printBtn.className = "btn";
          printBtn.textContent = "Direkt drucken";
          printBtn.onclick = () => {{
            const ret = `${{apiBase}}/projects/${{projectId}}/print-pdf-queue-page`;
            const viewUrl = `${{apiBase}}/documents/view-pdf?path=${{encodeURIComponent(it.pdf_path)}}&return_to=${{encodeURIComponent(ret)}}&autoprint=1`;
            location.href = viewUrl;
          }};

          row.appendChild(title);
          row.appendChild(openBtn);
          row.appendChild(printBtn);
          listEl.appendChild(row);
        }});
      }}
      loadQueue().catch(err => {{
        statusEl.textContent = "Fehler: " + err;
      }});
    </script>
  </body>
</html>"""
    return HTMLResponse(content=html)