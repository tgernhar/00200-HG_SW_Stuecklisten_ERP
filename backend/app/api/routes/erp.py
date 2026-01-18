"""
ERP Integration Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.project import Project

router = APIRouter()


@router.post("/articles/{article_id}/check-erp")
async def check_article_erp(article_id: int, db: Session = Depends(get_db)):
    """Artikelnummer im ERP prüfen (Einzelprüfung)"""
    from app.services.erp_service import article_exists, get_erp_db_connection
    from app.models.article import Article
    
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    if not article.hg_artikelnummer or article.hg_artikelnummer == "-":
        return {"exists": False, "reason": "Keine Artikelnummer vorhanden"}
    
    erp_connection = get_erp_db_connection()
    try:
        exists = article_exists(article.hg_artikelnummer, erp_connection)
        article.erp_exists = exists
        db.commit()
        return {"exists": exists, "articlenumber": article.hg_artikelnummer}
    finally:
        erp_connection.close()


@router.post("/projects/{project_id}/check-all-articlenumbers")
async def check_all_articlenumbers(
    project_id: int,
    db: Session = Depends(get_db)
):
    """
    Batch-Prüfung aller Artikelnummern im ERP
    
    Entspricht VBA Check_Articlenumber_Exists()
    """
    from app.services.erp_service import check_all_articlenumbers
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    result = await check_all_articlenumbers(project_id, db)
    return {
        "success": True,
        "total_checked": result["total_checked"],
        "exists_count": result["exists_count"],
        "not_exists_count": result["not_exists_count"],
        "details": result
    }


@router.get("/articles/{article_id}/orders")
async def get_article_orders(article_id: int, db: Session = Depends(get_db)):
    """Bestellungen abrufen"""
    from app.models.article import Article
    from app.models.order import Order
    
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    orders = db.query(Order).filter(Order.article_id == article_id).all()
    return orders


@router.post("/projects/{project_id}/sync-orders")
async def sync_orders(project_id: int, bom_id: int | None = None, db: Session = Depends(get_db)):
    """Bestellungen synchronisieren"""
    from app.services.erp_service import sync_project_orders
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    result = await sync_project_orders(project_id, db, bom_id=bom_id)
    return result


@router.get("/projects/{project_id}/export-hugwawi-articles-csv")
async def export_hugwawi_articles_csv(
    project_id: int,
    article_ids: str | None = Query(
        default=None,
        description="Optional: Kommagetrennte Artikel-IDs. Wenn gesetzt, werden nur diese (und nur erp_exists=false) exportiert.",
    ),
    db: Session = Depends(get_db),
):
    """
    Exportiert Artikel als HUGWAWI Import-CSV (Semikolon-CSV mit trailing ';').
    Exportiert nur Artikel, die im ERP fehlen (erp_exists = false).
    """
    from datetime import datetime
    from app.models.article import Article
    from app.services.hugwawi_csv_export import build_hugwawi_article_import_csv

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    q = (
        db.query(Article)
        .filter(Article.project_id == project_id)
        .filter(Article.erp_exists.is_(False))
        .filter(Article.hg_artikelnummer.isnot(None))
    )

    # Optionaler Filter auf Auswahl
    if article_ids:
        try:
            parsed_ids = [int(x.strip()) for x in article_ids.split(",") if x.strip()]
        except Exception:
            raise HTTPException(status_code=400, detail="Ungültiger Parameter article_ids (erwartet: z.B. 1,2,3)")
        if parsed_ids:
            q = q.filter(Article.id.in_(parsed_ids))

    articles = q.all()
    # zusätzlich Leerwerte/\"-\" entfernen
    articles = [a for a in articles if (a.hg_artikelnummer or "").strip() and (a.hg_artikelnummer or "").strip() != "-"]

    csv_text = build_hugwawi_article_import_csv(articles, export_dt=datetime.now())

    filename = f"hugwawi_import_{project.au_nr}_{datetime.now().strftime('%Y%m%d')}.csv"
    # Runtime-Evidence: UTF-8 (auch mit BOM) wird von HUGWAWI offenbar weiterhin als latin1/cp1252 interpretiert (Ã¤/Ã¼).
    # Deshalb exportieren wir als Windows-1252 (cp1252), sodass Umlaute als 0xE4/0xFC etc. in der Datei stehen.
    content_bytes = csv_text.encode("cp1252", errors="replace")
    return Response(
        content=content_bytes,
        media_type="text/csv; charset=windows-1252",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
