"""
Logging Configuration
"""
import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime

def setup_logging():
    """Konfiguriere Logging für die gesamte Anwendung"""
    # Erstelle logs-Verzeichnis
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    log_dir = os.path.join(backend_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Log-Datei mit Datum
    log_file = os.path.join(log_dir, f'backend_{datetime.now().strftime("%Y%m%d")}.log')
    
    # Root Logger konfigurieren
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    
    # Entferne vorhandene Handler
    root_logger.handlers.clear()
    
    # File Handler mit Rotation
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10*1024*1024,  # 10 MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    
    # Console Handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(levelname)s - %(message)s')
    console_handler.setFormatter(console_formatter)
    
    # Füge Handler hinzu
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # Stelle sicher, dass alle Logger die Handler vom Root-Logger erben
    # Setze propagate=True für alle existierenden Logger
    for logger_name in logging.Logger.manager.loggerDict:
        logger_obj = logging.getLogger(logger_name)
        if hasattr(logger_obj, 'propagate'):
            logger_obj.propagate = True
        # Entferne Handler von Child-Loggern, damit sie die Handler vom Root-Logger verwenden
        if logger_obj.handlers and logger_name != 'root':
            # Behalte nur Handler, die explizit für diesen Logger konfiguriert wurden
            # (z.B. für spezielle Logs)
            pass
    
    return log_file
