"""
Article Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.article import Article
from app.models.project import Project
from app.schemas.article import Article as ArticleSchema, ArticleCreate, ArticleUpdate, ArticleBatchUpdate

router = APIRouter()


@router.get("/projects/{project_id}/articles", response_model=List[ArticleSchema])
async def get_articles(project_id: int, db: Session = Depends(get_db)):
    """Alle Artikel eines Projekts"""
    # Prüfe ob Projekt existiert
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    articles = db.query(Article).filter(Article.project_id == project_id).all()
    return articles


@router.get("/articles/{article_id}", response_model=ArticleSchema)
async def get_article(article_id: int, db: Session = Depends(get_db)):
    """Einzelner Artikel"""
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return article


@router.post("/articles", response_model=ArticleSchema)
async def create_article(article: ArticleCreate, db: Session = Depends(get_db)):
    """Neuen Artikel erstellen"""
    db_article = Article(**article.dict())
    db.add(db_article)
    db.commit()
    db.refresh(db_article)
    return db_article


@router.patch("/articles/{article_id}", response_model=ArticleSchema)
async def update_article(
    article_id: int,
    article_update: ArticleUpdate,
    db: Session = Depends(get_db)
):
    """Artikel aktualisieren"""
    db_article = db.query(Article).filter(Article.id == article_id).first()
    if not db_article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    update_data = article_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_article, field, value)
    
    db.commit()
    db.refresh(db_article)
    return db_article


@router.delete("/articles/{article_id}")
async def delete_article(article_id: int, db: Session = Depends(get_db)):
    """Artikel löschen"""
    db_article = db.query(Article).filter(Article.id == article_id).first()
    if not db_article:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    db.delete(db_article)
    db.commit()
    return {"message": "Artikel gelöscht"}


@router.post("/articles/batch-update")
async def batch_update_articles(
    batch_update: ArticleBatchUpdate,
    db: Session = Depends(get_db)
):
    """Batch-Update mehrerer Artikel"""
    updated = []
    failed = []
    
    for article_id in batch_update.article_ids:
        try:
            db_article = db.query(Article).filter(Article.id == article_id).first()
            if not db_article:
                failed.append({"article_id": article_id, "reason": "Artikel nicht gefunden"})
                continue
            
            update_data = batch_update.updates.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_article, field, value)
            
            updated.append(article_id)
        except Exception as e:
            failed.append({"article_id": article_id, "reason": str(e)})
    
    db.commit()
    
    return {
        "updated": updated,
        "failed": failed,
        "updated_count": len(updated),
        "failed_count": len(failed)
    }
