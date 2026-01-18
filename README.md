# Webbasiertes Stücklisten-ERP System

Vollständige Ablösung der Excel-Middleware durch ein webbasiertes System mit React-Frontend, Python FastAPI Backend, MySQL-Datenbank und Windows-basiertem SOLIDWORKS-Connector.

## Architektur

- **Frontend**: React 18+ mit TypeScript und AG Grid
- **Backend**: Python FastAPI
- **Datenbank**: MySQL 8.0+
- **SOLIDWORKS-Connector**: Windows Service (Python)

## Setup

### Voraussetzungen

- Docker und Docker Compose
- Node.js 18+ (für Frontend-Entwicklung)
- Python 3.11+ (für Backend-Entwicklung)
- MySQL 8.0+ (für ERP-Verbindung)

### Installation

1. Environment-Variablen konfigurieren:
   ```bash
   cp .env.example .env
   # Bearbeite .env mit deinen Werten
   ```

2. Docker-Container starten:
   ```bash
   docker-compose up -d
   ```

3. Datenbank-Migrationen ausführen:
   ```bash
   cd backend
   alembic upgrade head
   ```

## Entwicklung

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## SOLIDWORKS-Connector

Der SOLIDWORKS-Connector läuft als separater Windows-Service und muss auf einem Windows-Server mit SOLIDWORKS 2025 installiert werden.

## Dokumentation

- **Plan**: `.cursor/plans/webbasiertes_stücklisten-erp_system_27dfa859.plan.md` - Detaillierte Planungsdokumentation
- **Quick Start**: `QUICKSTART.md` - Schnellstart-Anleitung
- **Deployment**: `DEPLOYMENT.md` - Deployment-Anleitung
- **Changelog**: `CHANGELOG.md` - Versionshistorie
- **Projekt-Doku (Details Import/Custom Properties)**: `docs/README.md`

## API-Dokumentation

Nach dem Start des Backends ist die interaktive API-Dokumentation verfügbar:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
