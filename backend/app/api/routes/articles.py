"""
Article Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.article import Article
from app.models.project import Project
from app.models.bom import Bom
from app.models.document_flag import DocumentGenerationFlag
from app.schemas.article import ArticleGridRow, ArticleCreate, ArticleUpdate, ArticleBatchUpdate
from sqlalchemy.orm import joinedload
import os
from pydantic import BaseModel
from pypdf import PdfReader
import math

router = APIRouter()

def _to_container_path(p: str) -> str:
    p2 = (p or "").replace("\\", "/")
    prefix = "C:/Thomas/Solidworks/"
    if p2.lower().startswith(prefix.lower()):
        return "/mnt/solidworks/" + p2[len(prefix):]
    return p or ""

def _pdf_format_from_path(pdf_path: str) -> Optional[str]:
    """
    Determine ISO A-series format from PDF mediabox (page 1). Returns A0..A4, 'Custom', or None.
    """
    if not pdf_path:
        return None
    resolved = os.path.normpath(_to_container_path(pdf_path))
    if not os.path.exists(resolved):
        return None
    try:
        reader = PdfReader(resolved)
        if not reader.pages:
            return None
        mb = reader.pages[0].mediabox
        w_pt = float(mb.width)
        h_pt = float(mb.height)
        # pt -> mm
        w_mm = w_pt * 25.4 / 72.0
        h_mm = h_pt * 25.4 / 72.0
        # normalize orientation
        a = min(w_mm, h_mm)
        b = max(w_mm, h_mm)
        # allow small tolerance
        tol = 6.0
        sizes = {
            "A4": (210.0, 297.0),
            "A3": (297.0, 420.0),
            "A2": (420.0, 594.0),
            "A1": (594.0, 841.0),
            "A0": (841.0, 1189.0),
        }
        for name, (sa, sb) in sizes.items():
            if abs(a - sa) <= tol and abs(b - sb) <= tol:
                return name
        return "Custom"
    except Exception:
        return None


class DocumentFlagsUpdate(BaseModel):
    # Werte: "", "1", "x"
    pdf_drucken: Optional[str] = None
    pdf: Optional[str] = None
    pdf_bestell_pdf: Optional[str] = None
    dxf: Optional[str] = None
    bestell_dxf: Optional[str] = None
    step: Optional[str] = None
    x_t: Optional[str] = None
    stl: Optional[str] = None
    bn_ab: Optional[str] = None


@router.patch("/articles/{article_id}/document-flags")
async def update_document_flags(article_id: int, payload: DocumentFlagsUpdate, db: Session = Depends(get_db)):
    """
    Update DocumentGenerationFlag row for an article (used by grid edits like 'PDF Drucken').
    """
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")

    flags = db.query(DocumentGenerationFlag).filter(DocumentGenerationFlag.article_id == article_id).first()
    if not flags:
        flags = DocumentGenerationFlag(article_id=article_id)
        db.add(flags)
        db.commit()
        db.refresh(flags)

    allowed = {"", "1", "x"}
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is None:
            continue
        if value not in allowed:
            raise HTTPException(status_code=400, detail=f"Ungültiger Wert für {field}: {value!r}")
        setattr(flags, field, value)

    db.commit()
    db.refresh(flags)
    return {"success": True, "article_id": article_id, "flags": {k: getattr(flags, k) for k in update_data.keys()}}


@router.get("/projects/{project_id}/articles", response_model=List[ArticleGridRow])
async def get_articles(
    project_id: int,
    bom_id: int | None = Query(
        default=None,
        description="Optional: BOM-ID. Wenn leer und es gibt genau 1 BOM, wird diese verwendet.",
    ),
    db: Session = Depends(get_db),
):
    """Alle Artikel einer BOM (default: einzige BOM im Projekt)"""
    # Prüfe ob Projekt existiert
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    effective_bom_id = bom_id
    if effective_bom_id is None:
        boms = db.query(Bom).filter(Bom.project_id == project_id).order_by(Bom.id.asc()).all()
        if len(boms) == 1:
            effective_bom_id = boms[0].id
        elif len(boms) == 0:
            # Legacy fallback: create a BOM and attach existing articles
            try:
                bom = Bom(project_id=project_id, hugwawi_order_name=project.au_nr)
                db.add(bom)
                db.commit()
                db.refresh(bom)
                db.query(Article).filter(
                    Article.project_id == project_id,
                    Article.bom_id.is_(None),
                ).update({"bom_id": bom.id}, synchronize_session=False)
                db.commit()
                effective_bom_id = bom.id
            except Exception as e:
                db.rollback()
                raise HTTPException(status_code=500, detail=f"Legacy-BOM konnte nicht erstellt werden: {e}")
        else:
            raise HTTPException(status_code=400, detail="Mehrere BOMs vorhanden. Bitte bom_id angeben.")
    else:
        bom = db.query(Bom).filter(Bom.id == effective_bom_id, Bom.project_id == project_id).first()
        if not bom:
            raise HTTPException(status_code=404, detail="BOM nicht gefunden")
    
    articles = (
        db.query(Article)
        .options(
            joinedload(Article.orders),
            joinedload(Article.documents),
            joinedload(Article.document_flags),
        )
        .filter(Article.project_id == project_id)
        .filter(Article.bom_id == effective_bom_id)
        .order_by(Article.pos_nr.asc(), Article.pos_sub.asc(), Article.id.asc())
        .all()
    )

    # region agent log
    try:
        import json, time
        with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
            _f.write(
                json.dumps(
                    {
                        "sessionId": "debug-session",
                        "runId": "run4",
                        "hypothesisId": "FETCH",
                        "location": "backend/app/api/routes/articles.py:get_articles",
                        "message": "queried",
                        "data": {
                            "project_id": project_id,
                            "requested_bom_id": bom_id,
                            "effective_bom_id": effective_bom_id,
                            "count": len(articles),
                        },
                        "timestamp": int(time.time() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # endregion agent log

    rows: List[ArticleGridRow] = []
    for a in articles:
        # Order: erste Bestellung verwenden; bei mehreren Bestellungen Anzahl anzeigen
        order = None
        orders_list = list(getattr(a, "orders", None) or [])
        try:
            orders_list = sorted(orders_list, key=lambda o: (o.id or 0))
        except Exception:
            pass
        if orders_list:
            order = orders_list[0]
        order_count = len(orders_list)
        order_sum = None
        if order_count:
            try:
                order_sum = sum(int(getattr(o, "bnr_menge", 0) or 0) for o in orders_list)
            except Exception:
                order_sum = None
        def _date_to_str(v):
            try:
                from datetime import date as _date, datetime as _dt
                if isinstance(v, _dt):
                    return v.date().isoformat()
                if isinstance(v, _date):
                    return v.isoformat()
            except Exception:
                pass
            if v is None:
                return None
            return str(v)
        # #region agent log
        if order_count:
            try:
                import json, time
                with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
                    _f.write(json.dumps({
                        "sessionId": "debug-session",
                        "runId": "bn-sync-2",
                        "hypothesisId": "BN_GRID_MAP",
                        "location": "backend/app/api/routes/articles.py:get_articles",
                        "message": "display-values",
                        "data": {
                            "article_id": a.id,
                            "order_count": order_count,
                            "display_hg_bnr": (str(order_count) if order_count > 1 else (getattr(order, "hg_bnr", None) if order else None)),
                            "display_bnr_status": ("-" if order_count > 1 else (getattr(order, "bnr_status", None) if order else None)),
                            "display_bnr_menge": (order_sum if order_count > 1 else (getattr(order, "bnr_menge", None) if order else None)),
                            "display_bestellkommentar": ("-" if order_count > 1 else (getattr(order, "bestellkommentar", None) if order else None)),
                            "display_hg_lt": ("-" if order_count > 1 else _date_to_str(getattr(order, "hg_lt", None) if order else None)),
                            "display_bestaetigter_lt": ("-" if order_count > 1 else _date_to_str(getattr(order, "bestaetigter_lt", None) if order else None))
                        },
                        "timestamp": int(time.time() * 1000)
                    }) + "\n")
            except Exception:
                pass
        # #endregion agent log
        # #region agent log
        try:
            import json, time
            with open(r"c:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "bn-sync-1",
                    "hypothesisId": "BN_GRID_MAP",
                    "location": "backend/app/api/routes/articles.py:get_articles",
                    "message": "order-aggregate",
                    "data": {
                        "article_id": a.id,
                        "order_count": order_count,
                        "first_hg_bnr": getattr(order, "hg_bnr", None) if order else None,
                        "first_status": getattr(order, "bnr_status", None) if order else None,
                        "first_menge": getattr(order, "bnr_menge", None) if order else None,
                        "first_lt": getattr(order, "hg_lt", None) if order else None,
                        "first_lt_bestaetigt": getattr(order, "bestaetigter_lt", None) if order else None
                    },
                    "timestamp": int(time.time() * 1000)
                }) + "\n")
        except Exception:
            pass
        # #endregion agent log

        # Flags
        flags = getattr(a, "document_flags", None)

        # Dokument-Existenz aus documents Tabelle (wird von "Dokumente prüfen" gepflegt)
        docs = {d.document_type: d for d in (getattr(a, "documents", None) or [])}
        pdf_doc = docs.get("PDF")
        pdf_bestell_pdf_doc = docs.get("Bestell_PDF")
        dxf_doc = docs.get("DXF")
        bestell_dxf_doc = docs.get("Bestell_DXF")
        step_doc = docs.get("STEP")
        x_t_doc = docs.get("X_T")
        stl_doc = docs.get("STL")
        sw_part_asm_doc = docs.get("SW_Part_ASM")
        sw_drw_doc = docs.get("SW_DRW")
        esp_doc = docs.get("ESP")

        def _flag_or_empty(val):
            return val if val is not None else ""

        def _exists_to_x(doc):
            return "x" if (doc and getattr(doc, "exists", False)) else ""

        def _doc_exists(doc):
            return bool(getattr(doc, "exists", False)) if doc else None

        def _doc_path(doc):
            return getattr(doc, "file_path", None) if doc else None

        row = ArticleGridRow(
            # Article fields
            id=a.id,
            project_id=a.project_id,
            bom_id=getattr(a, "bom_id", None),
            pos_nr=a.pos_nr,
            pos_sub=getattr(a, "pos_sub", None),
            pos_nr_display=(
                (f"{a.pos_nr}.{getattr(a, 'pos_sub', 0)}" if int(getattr(a, "pos_sub", 0) or 0) > 0 else (str(a.pos_nr) if a.pos_nr is not None else ""))
            ),
            hg_artikelnummer=a.hg_artikelnummer,
            benennung=a.benennung,
            konfiguration=a.konfiguration,
            teilenummer=a.teilenummer,
            menge=a.menge,
            p_menge=getattr(a, "p_menge", None),
            teiletyp_fertigungsplan=a.teiletyp_fertigungsplan,
            abteilung_lieferant=a.abteilung_lieferant,
            werkstoff=a.werkstoff,
            werkstoff_nr=a.werkstoff_nr,
            oberflaeche=a.oberflaeche,
            oberflaechenschutz=a.oberflaechenschutz,
            farbe=a.farbe,
            lieferzeit=a.lieferzeit,
            laenge=a.laenge,
            breite=a.breite,
            hoehe=a.hoehe,
            gewicht=a.gewicht,
            pfad=a.pfad,
            sldasm_sldprt_pfad=a.sldasm_sldprt_pfad,
            slddrw_pfad=a.slddrw_pfad,
            in_stueckliste_anzeigen=a.in_stueckliste_anzeigen,
            erp_exists=a.erp_exists,

            # Block A
            hg_bnr=(str(order_count) if order_count > 1 else (getattr(order, "hg_bnr", None) if order else None)),
            bnr_status=("-" if order_count > 1 else (getattr(order, "bnr_status", None) if order else None)),
            bnr_menge=(order_sum if order_count > 1 else (getattr(order, "bnr_menge", None) if order else None)),
            bestellkommentar=("-" if order_count > 1 else (getattr(order, "bestellkommentar", None) if order else None)),
            hg_lt=("-" if order_count > 1 else _date_to_str(getattr(order, "hg_lt", None) if order else None)),
            bestaetigter_lt=("-" if order_count > 1 else _date_to_str(getattr(order, "bestaetigter_lt", None) if order else None)),

            # Block B flags
            pdf_drucken=_flag_or_empty(getattr(flags, "pdf_drucken", "")) if flags else "",
            pdf=_flag_or_empty(getattr(flags, "pdf", "")) if flags else "",
            pdf_bestell_pdf=_flag_or_empty(getattr(flags, "pdf_bestell_pdf", "")) if flags else "",
            dxf=_flag_or_empty(getattr(flags, "dxf", "")) if flags else "",
            bestell_dxf=_flag_or_empty(getattr(flags, "bestell_dxf", "")) if flags else "",
            step=_flag_or_empty(getattr(flags, "step", "")) if flags else "",
            x_t=_flag_or_empty(getattr(flags, "x_t", "")) if flags else "",
            stl=_flag_or_empty(getattr(flags, "stl", "")) if flags else "",
            bn_ab=_flag_or_empty(getattr(flags, "bn_ab", "")) if flags else "",

            # Existence-only indicators
            sw_part_asm=_exists_to_x(sw_part_asm_doc),
            sw_drw=_exists_to_x(sw_drw_doc),
            esp=_exists_to_x(esp_doc),

            # PDF renderer helpers
            pdf_exists=getattr(pdf_doc, "exists", None) if pdf_doc else None,
            pdf_path=getattr(pdf_doc, "file_path", None) if pdf_doc else None,
            pdf_format=_pdf_format_from_path(getattr(pdf_doc, "file_path", None)) if (pdf_doc and getattr(pdf_doc, "exists", False) and getattr(pdf_doc, "file_path", None)) else None,

            # Exists/Path für alle Dokumenttypen
            pdf_bestell_pdf_exists=_doc_exists(pdf_bestell_pdf_doc),
            pdf_bestell_pdf_path=_doc_path(pdf_bestell_pdf_doc),

            dxf_exists=_doc_exists(dxf_doc),
            dxf_path=_doc_path(dxf_doc),

            bestell_dxf_exists=_doc_exists(bestell_dxf_doc),
            bestell_dxf_path=_doc_path(bestell_dxf_doc),

            step_exists=_doc_exists(step_doc),
            step_path=_doc_path(step_doc),

            x_t_exists=_doc_exists(x_t_doc),
            x_t_path=_doc_path(x_t_doc),

            stl_exists=_doc_exists(stl_doc),
            stl_path=_doc_path(stl_doc),

            sw_part_asm_exists=_doc_exists(sw_part_asm_doc),
            sw_part_asm_path=_doc_path(sw_part_asm_doc),

            sw_drw_exists=_doc_exists(sw_drw_doc),
            sw_drw_path=_doc_path(sw_drw_doc),

            esp_exists=_doc_exists(esp_doc),
            esp_path=_doc_path(esp_doc),
        )

        rows.append(row)

    return rows


from app.schemas.article import Article as ArticleSchema
@router.get("/articles/{article_id}", response_model=ArticleSchema)
async def get_article(article_id: int, db: Session = Depends(get_db)):
    """Einzelner Artikel"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return article


@router.post("/articles", response_model=ArticleSchema)
async def create_article(article: ArticleCreate, db: Session = Depends(get_db)):
    """Neuen Artikel erstellen"""
    db_article = Article(**article.dict())
    db.add(db_article)
    db.commit()
    db.refresh(db_article)
    return db_article


@router.patch("/articles/{article_id}", response_model=ArticleSchema)
async def update_article(
    article_id: int,
    article_update: ArticleUpdate,
    db: Session = Depends(get_db)
):
    """Artikel aktualisieren"""
    db_article = db.query(Article).filter(Article.id == article_id).first()
    if not db_article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    update_data = article_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_article, field, value)
    
    db.commit()
    db.refresh(db_article)
    return db_article


@router.delete("/articles/{article_id}")
async def delete_article(article_id: int, db: Session = Depends(get_db)):
    """Artikel löschen"""
    db_article = db.query(Article).filter(Article.id == article_id).first()
    if not db_article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    db.delete(db_article)
    db.commit()
    return {"message": "Artikel gelöscht"}


@router.post("/articles/batch-update")
async def batch_update_articles(
    batch_update: ArticleBatchUpdate,
    db: Session = Depends(get_db)
):
    """Batch-Update mehrerer Artikel"""
    updated = []
    failed = []
    
    for article_id in batch_update.article_ids:
        try:
            db_article = db.query(Article).filter(Article.id == article_id).first()
            if not db_article:
                failed.append({"article_id": article_id, "reason": "Artikel nicht gefunden"})
                continue
            
            update_data = batch_update.updates.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_article, field, value)
            
            updated.append(article_id)
        except Exception as e:
            failed.append({"article_id": article_id, "reason": str(e)})
    
    db.commit()
    
    return {
        "updated": updated,
        "failed": failed,
        "updated_count": len(updated),
        "failed_count": len(failed)
    }
