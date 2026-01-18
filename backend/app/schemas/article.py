"""
Article Schemas (Pydantic)
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ArticleBase(BaseModel):
    pos_nr: Optional[int] = None
    hg_artikelnummer: Optional[str] = None
    benennung: Optional[str] = None
    konfiguration: Optional[str] = None
    teilenummer: Optional[str] = None
    menge: int = 1
    p_menge: Optional[int] = None
    teiletyp_fertigungsplan: Optional[str] = None
    abteilung_lieferant: Optional[str] = None
    werkstoff: Optional[str] = None
    werkstoff_nr: Optional[str] = None
    oberflaeche: Optional[str] = None
    oberflaechenschutz: Optional[str] = None
    farbe: Optional[str] = None
    lieferzeit: Optional[str] = None
    laenge: Optional[float] = None
    breite: Optional[float] = None
    hoehe: Optional[float] = None
    gewicht: Optional[float] = None
    pfad: Optional[str] = None
    sldasm_sldprt_pfad: Optional[str] = None
    slddrw_pfad: Optional[str] = None
    in_stueckliste_anzeigen: bool = True
    erp_exists: Optional[bool] = None


class ArticleCreate(ArticleBase):
    project_id: int


class ArticleUpdate(BaseModel):
    pos_nr: Optional[int] = None
    hg_artikelnummer: Optional[str] = None
    benennung: Optional[str] = None
    konfiguration: Optional[str] = None
    teilenummer: Optional[str] = None
    menge: Optional[int] = None
    p_menge: Optional[int] = None
    teiletyp_fertigungsplan: Optional[str] = None
    abteilung_lieferant: Optional[str] = None
    werkstoff: Optional[str] = None
    werkstoff_nr: Optional[str] = None
    oberflaeche: Optional[str] = None
    oberflaechenschutz: Optional[str] = None
    farbe: Optional[str] = None
    lieferzeit: Optional[str] = None
    laenge: Optional[float] = None
    breite: Optional[float] = None
    hoehe: Optional[float] = None
    gewicht: Optional[float] = None
    pfad: Optional[str] = None
    sldasm_sldprt_pfad: Optional[str] = None
    slddrw_pfad: Optional[str] = None
    in_stueckliste_anzeigen: Optional[bool] = None
    erp_exists: Optional[bool] = None


class Article(ArticleBase):
    id: int
    project_id: int
    
    class Config:
        from_attributes = True


# Response-Shape für das Frontend-Grid (mischt Artikel + Order + Dokument-Flags + Datei-Existenz)
class ArticleGridRow(ArticleBase):
    id: int
    project_id: int

    # Block A (aus Order, falls vorhanden)
    hg_bnr: Optional[str] = None
    bnr_status: Optional[str] = None
    bnr_menge: Optional[int] = None
    bestellkommentar: Optional[str] = None
    hg_lt: Optional[str] = None
    bestaetigter_lt: Optional[str] = None

    # Block B (Flags: leer, "1", "x")
    pdf_drucken: Optional[str] = None
    pdf: Optional[str] = None
    pdf_bestell_pdf: Optional[str] = None
    dxf: Optional[str] = None
    bestell_dxf: Optional[str] = None
    step: Optional[str] = None
    x_t: Optional[str] = None
    stl: Optional[str] = None
    bn_ab: Optional[str] = None

    # Existence-only Spalten (nicht editierbar)
    sw_part_asm: Optional[str] = None
    sw_drw: Optional[str] = None
    esp: Optional[str] = None

    # Für PDF-Renderer
    pdf_exists: Optional[bool] = None
    pdf_path: Optional[str] = None
    pdf_format: Optional[str] = None

    # Existence/Path für alle Dokumenttypen (für Renderer in allen Spalten)
    pdf_bestell_pdf_exists: Optional[bool] = None
    pdf_bestell_pdf_path: Optional[str] = None

    dxf_exists: Optional[bool] = None
    dxf_path: Optional[str] = None

    bestell_dxf_exists: Optional[bool] = None
    bestell_dxf_path: Optional[str] = None

    step_exists: Optional[bool] = None
    step_path: Optional[str] = None

    x_t_exists: Optional[bool] = None
    x_t_path: Optional[str] = None

    stl_exists: Optional[bool] = None
    stl_path: Optional[str] = None

    sw_part_asm_exists: Optional[bool] = None
    sw_part_asm_path: Optional[str] = None

    sw_drw_exists: Optional[bool] = None
    sw_drw_path: Optional[str] = None

    esp_exists: Optional[bool] = None
    esp_path: Optional[str] = None

    class Config:
        from_attributes = True


class ArticleBatchUpdate(BaseModel):
    article_ids: List[int]
    updates: ArticleUpdate
