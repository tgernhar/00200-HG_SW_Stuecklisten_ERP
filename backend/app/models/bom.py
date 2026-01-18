"""
BOM Model (Stückliste-Header pro Auftrag+Artikel Kombination)
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Bom(Base):
    __tablename__ = "boms"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    # HUGWAWI Identifikation (read-only Quelle; wir speichern zur eindeutigen Zuordnung)
    hugwawi_order_id = Column(Integer, nullable=True)
    hugwawi_order_name = Column(String(100), nullable=True)  # AU-Nr aus ordertable.name
    hugwawi_order_article_id = Column(Integer, nullable=True)  # order_article_ref.orderArticleId
    hugwawi_article_id = Column(Integer, nullable=True)  # article.id
    hugwawi_articlenumber = Column(String(70), nullable=True)  # article.articlenumber

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "hugwawi_order_id",
            "hugwawi_order_article_id",
            name="uq_boms_project_order_orderarticle",
        ),
    )

    # Relationships
    project = relationship("Project", back_populates="boms")
    articles = relationship("Article", back_populates="bom", cascade="all, delete-orphan")

