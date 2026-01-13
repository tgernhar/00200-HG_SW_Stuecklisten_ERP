# Deployment-Anleitung

## Voraussetzungen

- Docker und Docker Compose installiert
- MySQL 8.0+ (für ERP-Verbindung)
- Windows Server mit SOLIDWORKS 2025 (für SOLIDWORKS-Connector)

## Setup-Schritte

### 1. Environment-Variablen konfigurieren

Kopiere `.env.example` zu `.env` und passe die Werte an:

```bash
cp .env.example .env
```

Wichtige Einstellungen:
- `DATABASE_URL`: MySQL-Verbindung zur Hauptdatenbank
- `ERP_DB_*`: ERP-Datenbank-Verbindung (HUGWAWI)
- `SOLIDWORKS_CONNECTOR_URL`: URL des SOLIDWORKS-Connectors

### 2. Docker-Container starten

**Linux/Mac:**
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

**Windows:**
```powershell
.\scripts\setup.ps1
```

**Manuell:**
```bash
docker-compose up -d
```

### 3. Datenbank-Migrationen ausführen

```bash
docker-compose exec backend alembic upgrade head
```

Oder lokal:
```bash
cd backend
alembic upgrade head
```

### 4. SOLIDWORKS-Connector installieren (Windows)

Auf dem Windows-Server mit SOLIDWORKS:

```powershell
cd solidworks-connector
python -m pip install -r requirements.txt
python src/service.py install
python src/service.py start
```

### 5. Test-Daten erstellen (optional)

```bash
python scripts/create_test_project.py
```

## Zugriff

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Dokumentation**: http://localhost:8000/docs
- **SOLIDWORKS-Connector**: http://localhost:8001

## Troubleshooting

### MySQL-Verbindungsfehler

Prüfe ob MySQL-Container läuft:
```bash
docker-compose ps
```

Prüfe MySQL-Logs:
```bash
docker-compose logs mysql
```

### SOLIDWORKS-Connector Fehler

Prüfe ob SOLIDWORKS installiert ist und COM API verfügbar ist.

Prüfe Service-Status:
```powershell
python src/service.py status
```

### Frontend lädt nicht

Prüfe ob alle Dependencies installiert sind:
```bash
cd frontend
npm install
```

## Produktions-Deployment

Für Produktions-Deployment:

1. Ändere `SECRET_KEY` in `.env`
2. Setze `allow_origins` in `backend/app/main.py` auf spezifische Domains
3. Verwende HTTPS (Reverse Proxy mit Nginx)
4. Setze `reload=False` in Docker-Compose für Backend
5. Konfiguriere Logging und Monitoring
