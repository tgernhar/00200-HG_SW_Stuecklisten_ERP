"""
Bom Schemas (Pydantic)
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BomBase(BaseModel):
    project_id: int
    hugwawi_order_id: Optional[int] = None
    hugwawi_order_name: Optional[str] = None
    hugwawi_order_article_id: Optional[int] = None
    hugwawi_article_id: Optional[int] = None
    hugwawi_articlenumber: Optional[str] = None


class BomCreate(BaseModel):
    hugwawi_order_id: int
    hugwawi_order_name: str
    hugwawi_order_article_id: int
    hugwawi_article_id: int
    hugwawi_articlenumber: str
    overwrite_password: Optional[str] = None


class Bom(BomBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

