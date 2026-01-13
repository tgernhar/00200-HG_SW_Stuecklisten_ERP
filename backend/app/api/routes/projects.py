"""
Project Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.project import Project
from app.schemas.project import Project as ProjectSchema, ProjectCreate, ProjectUpdate
import os

router = APIRouter()


@router.get("/projects", response_model=List[ProjectSchema])
async def get_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Liste aller Projekte"""
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects


@router.get("/projects/{project_id}", response_model=ProjectSchema)
async def get_project(project_id: int, db: Session = Depends(get_db)):
    """Projektdetails"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    return project


@router.post("/projects", response_model=ProjectSchema)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Neues Projekt erstellen"""
    db_project = Project(**project.dict())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.post("/projects/{project_id}/import-solidworks")
async def import_solidworks(
    project_id: int,
    assembly_filepath: str = None,
    db: Session = Depends(get_db)
):
    """
    Importiert SOLIDWORKS-Assembly in Projekt
    
    Entspricht VBA Main_Create_Projektsheet()
    """
        # Prüfe ob Projekt existiert
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    # Prüfe ob Assembly-Filepath vorhanden
    if not assembly_filepath or not os.path.exists(assembly_filepath):
        raise HTTPException(
            status_code=400,
            detail="Assembly-Filepath fehlt oder Datei existiert nicht"
        )
    
    from app.services.solidworks_service import import_solidworks_assembly
    result = await import_solidworks_assembly(project_id, assembly_filepath, db)
    return result
