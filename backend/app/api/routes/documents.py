"""
Document Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.article import Article
from app.models.project import Project
from app.models.document import Document
from app.models.document_flag import DocumentGenerationFlag

router = APIRouter()


@router.get("/articles/{article_id}/documents")
async def get_documents(article_id: int, db: Session = Depends(get_db)):
    """Dokumentstatus abrufen"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    documents = db.query(Document).filter(Document.article_id == article_id).all()
    return documents


@router.post("/articles/{article_id}/check-documents")
async def check_documents(article_id: int, db: Session = Depends(get_db)):
    """Dokumente prüfen (Dateisystem-Check)"""
    from app.services.document_service import check_article_documents
    
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    result = await check_article_documents(article_id, db)
    return result


@router.post("/articles/{article_id}/generate-documents")
async def generate_documents(
    article_id: int,
    document_types: List[str],
    db: Session = Depends(get_db)
):
    """Einzelnes Dokument generieren (für spezifischen Dokumenttyp)"""
    from app.services.document_service import generate_single_document
    
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    result = await generate_single_document(article_id, document_types, db)
    return result


@router.post("/projects/{project_id}/generate-documents-batch")
async def generate_documents_batch(
    project_id: int,
    document_types: Optional[List[str]] = None,
    db: Session = Depends(get_db)
):
    """
    Batch-Generierung: Durchläuft alle Artikel, generiert Dokumente wo Wert="1"
    """
    from app.services.document_service import batch_generate_documents
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    result = await batch_generate_documents(project_id, document_types, db)
    return result


@router.post("/projects/{project_id}/batch-print-pdf")
async def batch_print_pdf_endpoint(
    project_id: int,
    confirm_printer_setup: bool = True,
    db: Session = Depends(get_db)
):
    """
    Batch-PDF-Druck: Durchläuft alle Artikel, druckt PDFs wo B1="1" UND B2="x"
    
    Entspricht VBA Main_Print_PDF()
    """
    from app.services.document_service import batch_print_pdf
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    result = await batch_print_pdf(project_id, confirm_printer_setup, db)
    return {
        "success": True,
        "printed_count": len(result["printed"]),
        "failed_count": len(result["failed"]),
        "skipped_count": len(result["skipped"]),
        "details": result
    }
