"""
Database Configuration and Connection
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import mysql.connector
from typing import Optional
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


# Global state for database mode (per-process, thread-safe via contextvars would be better for production)
# For simplicity, we use a simple dict that can be overridden per-request
_db_mode_state = {
    "use_test_db": False
}


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_erp_db_connection(use_test_db: Optional[bool] = None):
    """
    Erstellt MySQL-Verbindung zur ERP-Datenbank (HUGWAWI)
    
    Args:
        use_test_db: If True, connect to test DB (10.233.159.39).
                     If False, connect to live DB (10.233.159.44).
                     If None, use global state from _db_mode_state.
    
    Returns:
        MySQL connection to the selected database.
    
    Note:
        - Live DB (10.233.159.44): ALWAYS read-only
        - Test DB (10.233.159.39): Read + Write (when allowed by table registry)
    """
    # Determine which database to use
    if use_test_db is None:
        use_test_db = _db_mode_state.get("use_test_db", False)
    
    # Select host based on mode
    if use_test_db:
        host = settings.ERP_TEST_DB_HOST
        port = settings.ERP_TEST_DB_PORT
        database = settings.ERP_TEST_DB_NAME
    else:
        host = settings.ERP_DB_HOST
        port = settings.ERP_DB_PORT
        database = settings.ERP_DB_NAME
    
    connection = mysql.connector.connect(
        host=host,
        port=port,
        database=database,
        user=settings.ERP_DB_USER,
        password=settings.ERP_DB_PASSWORD,
        # HUGWAWI läuft (laut Export) auf latin1; stelle saubere String-Decodierung sicher.
        use_unicode=True,
        charset="latin1",
    )
    
    return connection


def set_test_db_mode(enabled: bool) -> None:
    """
    Set the global database mode.
    
    Args:
        enabled: True to use test DB, False to use live DB.
    """
    _db_mode_state["use_test_db"] = enabled


def is_test_db_mode() -> bool:
    """
    Get the current database mode.
    
    Returns:
        True if test DB is active, False if live DB is active.
    """
    return _db_mode_state.get("use_test_db", False)


def get_current_erp_host() -> str:
    """
    Get the hostname of the currently active ERP database.
    
    Returns:
        The hostname string (e.g., "10.233.159.44" or "10.233.159.39").
    """
    if is_test_db_mode():
        return settings.ERP_TEST_DB_HOST
    return settings.ERP_DB_HOST
