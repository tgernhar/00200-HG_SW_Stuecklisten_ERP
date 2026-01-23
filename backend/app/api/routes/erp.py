"""
ERP Integration Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.database import get_db
import re
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


@router.post("/projects/{project_id}/load-articles")
async def load_articles(
    project_id: int,
    auto_fill: bool = Query(
        default=True,
        description="Wenn true, werden leere Frontend-Felder automatisch mit HUGWAWI-Daten befüllt.",
    ),
    db: Session = Depends(get_db),
):
    """
    Lädt Artikel aus HUGWAWI und berechnet Differenzen.
    
    Workflow:
    1. Artikel-Sync ausführen (check_all_articlenumbers)
    2. Custom Properties aus HUGWAWI laden
    3. Differenzen berechnen
    4. Optional: Leere Frontend-Felder automatisch befüllen
    5. Response mit hugwawi_data und diffs zurückgeben
    """
    from app.services.erp_service import (
        check_all_articlenumbers,
        fetch_hugwawi_custom_properties,
        compute_article_diffs,
        find_extended_articles,
        create_extended_articles,
        HUGWAWI_FIELD_MAPPING,
    )
    from app.core.database import get_erp_db_connection
    from app.models.article import Article

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")

    # 1. Artikel-Sync ausführen
    sync_result = await check_all_articlenumbers(project_id, db)

    # 2. Alle Artikelnummern des Projekts sammeln
    articles = db.query(Article).filter(Article.project_id == project_id).all()
    articlenumbers = list(set(
        (a.hg_artikelnummer or "").strip()
        for a in articles
        if (a.hg_artikelnummer or "").strip() and (a.hg_artikelnummer or "").strip() != "-"
    ))

    # 3. Custom Properties aus HUGWAWI laden
    erp_connection = get_erp_db_connection()
    try:
        hugwawi_data = fetch_hugwawi_custom_properties(articlenumbers, erp_connection)
    finally:
        erp_connection.close()

    # 4. Differenzen berechnen
    hugwawi_by_id, diffs_by_id = compute_article_diffs(articles, hugwawi_data)

    # 5. Optional: Auto-fill leere Frontend-Felder
    auto_filled = {}
    if auto_fill:
        for article in articles:
            article_id = article.id
            diffs = diffs_by_id.get(article_id, {})
            hugwawi_props = hugwawi_by_id.get(article_id, {})
            
            filled_fields = {}
            for field, diff_type in list(diffs.items()):
                if diff_type == "hugwawi_only":
                    # Frontend leer, HUGWAWI hat Wert -> übernehmen
                    hugwawi_val = hugwawi_props.get(field)
                    if hugwawi_val is not None:
                        setattr(article, field, hugwawi_val)
                        filled_fields[field] = hugwawi_val
                        # Entferne aus diffs, da jetzt kein Unterschied mehr
                        del diffs[field]
            
            if filled_fields:
                auto_filled[article_id] = filled_fields
            
            # Update diffs_by_id (leere dicts entfernen)
            if not diffs:
                diffs_by_id.pop(article_id, None)
            else:
                diffs_by_id[article_id] = diffs
        
        db.commit()

    # 6. Erweiterte Artikel finden und einfügen (für Artikel die mit "09" oder "9" beginnen)
    new_extended_articles = 0
    extended_details = {}
    
    # Hole die aktuelle BOM-ID (erste BOM des Projekts oder None)
    from app.models.bom import Bom
    default_bom = db.query(Bom).filter(Bom.project_id == project_id).first()
    
    if default_bom:
        # Filter: Nur Artikelnummern die mit "09" oder "9" beginnen
        base_09_articles = [
            a for a in articles 
            if (a.hg_artikelnummer or "").strip().startswith(("09", "9"))
        ]
        
        if base_09_articles:
            # Bereits vorhandene Artikelnummern im Projekt sammeln
            existing_numbers = set(
                (a.hg_artikelnummer or "").strip() 
                for a in articles
            )
            
            # Basis-Artikelnummern für die Suche
            base_numbers = [
                (a.hg_artikelnummer or "").strip() 
                for a in base_09_articles 
                if (a.hg_artikelnummer or "").strip()
            ]
            
            # Erweiterte Artikel aus HUGWAWI laden
            erp_connection2 = get_erp_db_connection()
            try:
                extended_data = find_extended_articles(base_numbers, erp_connection2)
            finally:
                erp_connection2.close()
            
            # Neue Artikel erstellen (nur wenn noch nicht vorhanden)
            for parent in base_09_articles:
                parent_nr = (parent.hg_artikelnummer or "").strip()
                extensions = extended_data.get(parent_nr, [])
                created_nrs = []
                
                for ext in extensions:
                    ext_nr = ext.get("articlenumber", "")
                    if ext_nr and ext_nr not in existing_numbers:
                        # Erstelle neuen Artikel
                        new_art = create_extended_articles(
                            parent_article=parent,
                            extension_data=ext,
                            project_id=project_id,
                            bom_id=parent.bom_id or default_bom.id,
                            db=db
                        )
                        new_extended_articles += 1
                        created_nrs.append(ext_nr)
                        existing_numbers.add(ext_nr)  # Verhindere Duplikate
                
                if created_nrs:
                    extended_details[parent_nr] = created_nrs
            
            if new_extended_articles > 0:
                db.commit()

    return {
        "success": True,
        "sync_result": {
            "total_checked": sync_result["total_checked"],
            "exists_count": sync_result["exists_count"],
            "not_exists_count": sync_result["not_exists_count"],
        },
        "hugwawi_data": hugwawi_by_id,
        "diffs": diffs_by_id,
        "auto_filled": auto_filled,
        "total_articles": len(articles),
        "hugwawi_found": len(hugwawi_by_id),
        "articles_with_diffs": len(diffs_by_id),
        "new_extended_articles": new_extended_articles,
        "extended_details": extended_details,
    }


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
    # zusätzlich Leerwerte/"-" entfernen + Plausibilitätsprüfung
    articles = [a for a in articles if (a.hg_artikelnummer or "").strip() and (a.hg_artikelnummer or "").strip() != "-"]
    valid_pattern = re.compile(r"^[0-9]{6}-")
    articles = [a for a in articles if valid_pattern.match((a.hg_artikelnummer or "").strip())]

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
