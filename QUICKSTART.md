# Quick Start Guide

## Schnellstart

### 1. Environment-Variablen einrichten

```bash
# Kopiere .env.example zu .env
cp .env.example .env

# Bearbeite .env und setze deine Werte:
# - DATABASE_URL
# - ERP_DB_* (für ERP-Verbindung)
# - SOLIDWORKS_CONNECTOR_URL
```

### 2. Projekt starten

**Option A: Mit Setup-Script (empfohlen)**

Windows:
```powershell
.\scripts\setup.ps1
```

Linux/Mac:
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

**Option B: Manuell**

```bash
# Starte Docker Container
docker-compose up -d

# Warte auf MySQL (10 Sekunden)
# Dann führe Migrationen aus:
docker-compose exec backend alembic upgrade head
```

### 3. Zugriff auf die Anwendung

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Dokumentation**: http://localhost:8000/docs

### 4. Test-Daten erstellen (optional)

```bash
python scripts/create_test_project.py
```

## SOLIDWORKS-Connector Setup (Windows)

Auf einem Windows-Server mit SOLIDWORKS 2025:

```powershell
cd solidworks-connector
python -m pip install -r requirements.txt
python src/service.py install
python src/service.py start
```

Der Service läuft dann auf Port 8001.

## Entwicklung

### Backend lokal starten

```bash
cd backend
pip install -r requirements.txt
python run.py
```

### Frontend lokal starten

```bash
cd frontend
npm install
npm run dev
```

## Nächste Schritte

1. **Projekt erstellen**: Über API oder Frontend
2. **SOLIDWORKS-Assembly importieren**: Button "Import SOLIDWORKS"
3. **ERP-Abgleich durchführen**: Button "ERP-Abgleich"
4. **Dokumente generieren**: Button "Dokumente erstellen"
5. **PDFs drucken**: Button "PDF Drucken"

## Hilfe

- Siehe `DEPLOYMENT.md` für detaillierte Deployment-Anleitung
- Siehe `README.md` für allgemeine Informationen
- API-Dokumentation: http://localhost:8000/docs
