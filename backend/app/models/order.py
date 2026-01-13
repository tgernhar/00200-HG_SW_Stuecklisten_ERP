"""
Order Model (Bestellinformationen - Block A)
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    
    # Bestellinformationen (Block A)
    hg_bnr = Column(String(100))  # A1
    bnr_status = Column(String(50))  # A2: Unbearbeitet/Bestellt/Geliefert/Erledigt
    bnr_menge = Column(Integer)  # A3
    bestellkommentar = Column(String(500))  # A4
    hg_lt = Column(Date)  # A5: Liefertermin
    bestaetigter_lt = Column(Date)  # A6: Bestätigter Liefertermin
    
    # Relationships
    article = relationship("Article", back_populates="orders")
