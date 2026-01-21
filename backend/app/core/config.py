"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Database
    # Default passend zu docker-compose.yml (mysql Port 3306 ist nach localhost gemappt).
    # Kann jederzeit per Umgebungsvariable DATABASE_URL überschrieben werden.
    DATABASE_URL: str = "mysql+pymysql://app_user:app_password@localhost:3306/stuecklisten_erp"
    
    # ERP Database
    ERP_DB_HOST: str = "10.233.159.44"
    ERP_DB_PORT: int = 3306
    ERP_DB_NAME: str = "hugwawi"
    ERP_DB_USER: str = ""
    ERP_DB_PASSWORD: str = ""
    
    # SOLIDWORKS Connector
    SOLIDWORKS_CONNECTOR_URL: str = "http://localhost:8001"
    SOLIDWORKS_VERSION: str = "2025"
    # Switch between connector implementations (v1 default, v2 for new endpoint)
    SOLIDWORKS_CONNECTOR_MODE: str = "v2"
    # Connector HTTP timeout for long-running imports (seconds). For very large assemblies (hours),
    # raise this value. If your environment supports it, you may also set this to a very high value.
    SOLIDWORKS_IMPORT_HTTP_TIMEOUT_S: int = 14400  # 4 hours
    
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
