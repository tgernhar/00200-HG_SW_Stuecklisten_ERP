"""
Article Model (Haupttabelle für Stücklistenzeilen)
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Article(Base):
    __tablename__ = "articles"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False, index=True)
    
    # Positionsnummer
    pos_nr = Column(Integer)
    # Sub-Position für Bestellartikel: 0 = Basisposition, 1..n = eingefügte Zeilen direkt darunter
    pos_sub = Column(Integer, default=0, nullable=False)
    
    # Artikelinformationen (Block C)
    hg_artikelnummer = Column(String(100), index=True)  # C2
    benennung = Column(String(500))  # C3
    konfiguration = Column(String(200))  # C4
    teilenummer = Column(String(100))  # C5
    menge = Column(Integer, default=1)  # C6
    # Produktionsmenge (editierbar; wird beim Import initial auf menge gesetzt)
    p_menge = Column(Integer, default=1)  # C6b
    
    # Editierbare Felder (max 150 Zeichen)
    teiletyp_fertigungsplan = Column(String(150))  # C7
    abteilung_lieferant = Column(String(150))  # C8
    werkstoff = Column(String(150))  # C9
    werkstoff_nr = Column(String(150))  # C10
    oberflaeche = Column(String(150))  # C11
    oberflaechenschutz = Column(String(150))  # C12
    farbe = Column(String(150))  # C13
    lieferzeit = Column(String(150))  # C14
    
    # Dimensionen
    laenge = Column(Float)  # C15
    breite = Column(Float)  # C16
    hoehe = Column(Float)  # C17
    gewicht = Column(Float)  # C18
    
    # Pfade
    pfad = Column(String(500))  # C19
    sldasm_sldprt_pfad = Column(String(500))  # C20
    slddrw_pfad = Column(String(500))  # C21
    
    # Flags
    in_stueckliste_anzeigen = Column(Boolean, default=True)  # C22
    
    # ERP-Status (wird durch check-all-articlenumbers gesetzt)
    erp_exists = Column(Boolean, default=None, nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="articles")
    bom = relationship("Bom", back_populates="articles")
    orders = relationship("Order", back_populates="article", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="article", cascade="all, delete-orphan")
    document_flags = relationship("DocumentGenerationFlag", back_populates="article", cascade="all, delete-orphan", uselist=False)
