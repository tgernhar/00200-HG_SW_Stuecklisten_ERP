"""
ERP Integration Routes
"""
from fastapi import APIRouter, Depends, HTTPException
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
async def sync_orders(project_id: int, db: Session = Depends(get_db)):
    """Bestellungen synchronisieren"""
    from app.services.erp_service import sync_project_orders
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    result = await sync_project_orders(project_id, db)
    return result
