"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Database
    DATABASE_URL: str = "mysql+pymysql://user:password@localhost:3306/stuecklisten_erp"
    
    # ERP Database
    ERP_DB_HOST: str = "10.233.159.44"
    ERP_DB_PORT: int = 3306
    ERP_DB_NAME: str = "hugwawi"
    ERP_DB_USER: str = ""
    ERP_DB_PASSWORD: str = ""
    
    # SOLIDWORKS Connector
    SOLIDWORKS_CONNECTOR_URL: str = "http://localhost:8001"
    SOLIDWORKS_VERSION: str = "2025"
    
    # File Paths
    UPLOAD_PATH: str = "./uploads"
    
    # Security
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # API
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Stücklisten-ERP System"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
