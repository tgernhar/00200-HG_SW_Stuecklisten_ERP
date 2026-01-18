"""
BOM Routes (Stücklisten-spezifische Aktionen)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db, get_erp_db_connection
from app.models.bom import Bom
from app.models.article import Article

router = APIRouter()


class CreateBestellartikelRequest(BaseModel):
    source_article_ids: list[int]
    template_ids: list[int]  # HUGWAWI article.id (099900-*)


@router.post("/boms/{bom_id}/create-bestellartikel")
async def create_bestellartikel(bom_id: int, payload: CreateBestellartikelRequest, db: Session = Depends(get_db)):
    """
    Erzeugt Bestellartikel-Zeilen unterhalb der ausgewählten Artikel (pos_sub .1/.2/...).
    Templates werden read-only aus HUGWAWI article (099900-*) geladen.
    """
    bom = db.query(Bom).filter(Bom.id == bom_id).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM nicht gefunden")

    src_ids = [int(x) for x in (payload.source_article_ids or []) if x is not None]
    tpl_ids = [int(x) for x in (payload.template_ids or []) if x is not None]
    if not src_ids:
        raise HTTPException(status_code=400, detail="Keine source_article_ids angegeben")
    if not tpl_ids:
        raise HTTPException(status_code=400, detail="Keine template_ids angegeben")

    sources = (
        db.query(Article)
        .filter(Article.bom_id == bom_id, Article.id.in_(src_ids))
        .order_by(Article.pos_nr.asc(), Article.pos_sub.asc(), Article.id.asc())
        .all()
    )
    if len(sources) != len(set(src_ids)):
        found = {a.id for a in sources}
        missing = [i for i in src_ids if i not in found]
        raise HTTPException(status_code=404, detail=f"Artikel nicht gefunden (oder nicht in dieser BOM): {missing[:50]}")

    erp = get_erp_db_connection()
    try:
        from app.services.erp_service import get_bestellartikel_templates_by_ids

        templates = get_bestellartikel_templates_by_ids(tpl_ids, erp)
    finally:
        erp.close()

    template_map = {int(t.get("hugwawi_article_id")): t for t in templates if t.get("hugwawi_article_id") is not None}
    missing_tpl = [i for i in tpl_ids if i not in template_map]
    if missing_tpl:
        raise HTTPException(status_code=404, detail=f"Templates nicht gefunden: {missing_tpl[:50]}")

    # Precompute next pos_sub per pos_nr
    pos_nrs = {a.pos_nr for a in sources}
    max_sub_by_pos = {}
    for pos in pos_nrs:
        if pos is None:
            continue
        m = (
            db.query(Article.pos_sub)
            .filter(Article.bom_id == bom_id, Article.pos_nr == pos)
            .order_by(Article.pos_sub.desc())
            .limit(1)
            .all()
        )
        max_sub_by_pos[pos] = int(m[0][0]) if m and m[0] and m[0][0] is not None else 0

    created_ids: list[int] = []
    for src in sources:
        base_pos = src.pos_nr
        if base_pos is None:
            continue
        next_sub = max_sub_by_pos.get(base_pos, 0)
        for tpl_id in tpl_ids:
            tpl = template_map[tpl_id]
            suffix = str(tpl.get("customtext3") or "")
            prefix = str(tpl.get("customtext2") or "")

            next_sub += 1
            a = Article(
                project_id=src.project_id,
                bom_id=bom_id,
                pos_nr=base_pos,
                pos_sub=next_sub,
                hg_artikelnummer=(str(src.hg_artikelnummer or "") + suffix) or None,
                benennung=(prefix + " zu:\n" + str(src.benennung or "")) if (prefix or src.benennung) else None,
                konfiguration="",
                teilenummer=src.teilenummer,
                menge=src.menge,
                p_menge=getattr(src, "p_menge", None),
                teiletyp_fertigungsplan="",
                abteilung_lieferant="",
                werkstoff=src.werkstoff,
                werkstoff_nr=src.werkstoff_nr,
                oberflaeche="",
                oberflaechenschutz="",
                farbe="",
                lieferzeit=src.lieferzeit,
                laenge=src.laenge,
                breite=src.breite,
                hoehe=None,  # nicht gefordert
                gewicht=src.gewicht,
                pfad=None,
                sldasm_sldprt_pfad=None,
                slddrw_pfad=None,
                in_stueckliste_anzeigen=True,
                erp_exists=None,
            )
            db.add(a)
            db.flush()  # assign id
            created_ids.append(a.id)

        max_sub_by_pos[base_pos] = next_sub

    db.commit()
    return {"created_ids": created_ids, "created_count": len(created_ids)}

