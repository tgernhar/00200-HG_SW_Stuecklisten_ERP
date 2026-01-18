"""
Project Schemas (Pydantic)
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ProjectBase(BaseModel):
    artikel_nr: str
    au_nr: Optional[str] = None
    project_path: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    artikel_nr: Optional[str] = None
    au_nr: Optional[str] = None
    project_path: Optional[str] = None


class Project(ProjectBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SolidworksPushRequest(BaseModel):
    article_ids: List[int]
