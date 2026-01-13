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


class ArticleBatchUpdate(BaseModel):
    article_ids: List[int]
    updates: ArticleUpdate
