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
    
    # ERP Database (Live - HUGWAWI)
    ERP_DB_HOST: str = "10.233.159.44"
    ERP_DB_PORT: int = 3306
    ERP_DB_NAME: str = "hugwawi"
    ERP_DB_USER: str = ""
    ERP_DB_PASSWORD: str = ""
    
    # ERP Test Database (Copy of HUGWAWI for testing writes)
    ERP_TEST_DB_HOST: str = "10.233.159.39"
    ERP_TEST_DB_PORT: int = 3306
    ERP_TEST_DB_NAME: str = "hugwawi"
    # Note: Credentials are shared with ERP_DB_USER/PASSWORD
    
    # Database Switch Feature (set to False in production to hide the switch)
    DB_SWITCH_ENABLED: bool = True
    
    # SOLIDWORKS Connector
    SOLIDWORKS_CONNECTOR_URL: str = "http://localhost:8001"
    SOLIDWORKS_VERSION: str = "2025"
    # Switch between connector implementations (v1 default, v2 for new endpoint)
    SOLIDWORKS_CONNECTOR_MODE: str = "v2"
    # Writeback lock handling (False = only block when open in SOLIDWORKS)
    SOLIDWORKS_WRITEBACK_STRICT_LOCK: bool = False
    # Connector HTTP timeout for long-running imports (seconds). For very large assemblies (hours),
    # raise this value. If your environment supports it, you may also set this to a very high value.
    SOLIDWORKS_IMPORT_HTTP_TIMEOUT_S: int = 14400  # 4 hours
    
    # File Paths
    UPLOAD_PATH: str = "./uploads"
    
    # Paperless-ngx DMS Integration
    PAPERLESS_URL: str = "https://paperless.hug.gernhard.net"
    PAPERLESS_USERNAME: str = ""  # Set in .env file
    PAPERLESS_PASSWORD: str = ""  # Set in .env file
    PAPERLESS_TOKEN: str = ""  # Alternative: API Token instead of user/password
    
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
