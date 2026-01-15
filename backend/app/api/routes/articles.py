"""
Article Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.article import Article
from app.models.project import Project
from app.schemas.article import ArticleGridRow, ArticleCreate, ArticleUpdate, ArticleBatchUpdate
from sqlalchemy.orm import joinedload
import os

router = APIRouter()


@router.get("/projects/{project_id}/articles", response_model=List[ArticleGridRow])
async def get_articles(project_id: int, db: Session = Depends(get_db)):
    """Alle Artikel eines Projekts"""
    # Prüfe ob Projekt existiert
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    articles = (
        db.query(Article)
        .options(
            joinedload(Article.orders),
            joinedload(Article.documents),
            joinedload(Article.document_flags),
        )
        .filter(Article.project_id == project_id)
        .all()
    )

    rows: List[ArticleGridRow] = []
    for a in articles:
        # Order: nehme erste (falls mehrere vorhanden)
        order = a.orders[0] if getattr(a, "orders", None) else None

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
            pos_nr=a.pos_nr,
            hg_artikelnummer=a.hg_artikelnummer,
            benennung=a.benennung,
            konfiguration=a.konfiguration,
            teilenummer=a.teilenummer,
            menge=a.menge,
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
            hg_bnr=getattr(order, "hg_bnr", None) if order else None,
            bnr_status=getattr(order, "bnr_status", None) if order else None,
            bnr_menge=getattr(order, "bnr_menge", None) if order else None,
            bestellkommentar=getattr(order, "bestellkommentar", None) if order else None,
            hg_lt=getattr(order, "hg_lt", None) if order else None,
            bestaetigter_lt=getattr(order, "bestaetigter_lt", None) if order else None,

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
