"""
Database Initialization Script
"""
from app.core.database import engine, Base
from app.models import Project, Article, Order, Document, DocumentGenerationFlag

def init_db():
    """Create all database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
