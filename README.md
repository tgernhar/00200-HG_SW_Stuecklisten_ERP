# Webbasiertes Stücklisten-ERP System

Vollständige Ablösung der Excel-Middleware durch ein webbasiertes System mit React-Frontend, Python FastAPI Backend, MySQL-Datenbank und Windows-basiertem SOLIDWORKS-Connector.

## Architektur

- **Frontend**: React 18+ mit TypeScript und AG Grid
- **Backend**: Python FastAPI
- **Datenbank**: MySQL 8.0+ (Project → Bom → Article Hierarchie)
- **SOLIDWORKS-Connector**: Windows Service (Python)

### Datenstruktur

Das System verwendet eine dreistufige Hierarchie:
- **Project** (eindeutig über `artikel_nr`) - Ein Projekt entspricht einer Artikelnummer
- **Bom** (mehrere BOMs pro Projekt möglich) - Eine BOM entspricht einer Auftrags-Artikel-Kombination
- **Article** (gehört zu einer BOM) - Einzelne Stücklistenzeilen

Siehe `docs/README.md` für Details.

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

- **Plan**: `.cursor/plans/webbasiertes_stücklisten-erp_system_27dfa859.plan.md` - Detaillierte Planungsdokumentation (Architektur, Datenmodell, API-Endpunkte)
- **Quick Start**: `QUICKSTART.md` - Schnellstart-Anleitung
- **Deployment**: `DEPLOYMENT.md` - Deployment-Anleitung
- **Changelog**: `CHANGELOG.md` - Versionshistorie
- **Projekt-Doku**: `docs/README.md` - Übersicht über alle Feature-Dokumentationen
  - Import-Workflow (BOM-basiert)
  - Dokumentenprüfung
  - Grid-Spalten & Status
  - Browser-basiertes Drucken
  - Dokument-Export
  - SOLIDWORKS Custom Properties
  - CSV-Export für HUGWAWI
  - Manuelle Zeilen & BN-Sync

## API-Dokumentation

Nach dem Start des Backends ist die interaktive API-Dokumentation verfügbar:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
