"""
Database Configuration and Connection
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import mysql.connector
from app.core.config import settings

# SQLAlchemy Setup
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_erp_db_connection():
    """
    Erstellt MySQL-Verbindung zur ERP-Datenbank (HUGWAWI)
    
    Entspricht VBA MySQL-Verbindung über ODBC
    """
    connection = mysql.connector.connect(
        host=settings.ERP_DB_HOST,
        port=settings.ERP_DB_PORT,
        database=settings.ERP_DB_NAME,
        user=settings.ERP_DB_USER,
        password=settings.ERP_DB_PASSWORD
    )
    
    return connection
