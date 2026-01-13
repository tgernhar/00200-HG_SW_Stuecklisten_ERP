#!/bin/bash
# Setup Script für das Projekt

echo "=== Stücklisten-ERP System Setup ==="

# Prüfe ob Docker installiert ist
if ! command -v docker &> /dev/null; then
    echo "Fehler: Docker ist nicht installiert!"
    exit 1
fi

# Prüfe ob Docker Compose installiert ist
if ! command -v docker-compose &> /dev/null; then
    echo "Fehler: Docker Compose ist nicht installiert!"
    exit 1
fi

# Erstelle .env Datei falls nicht vorhanden
if [ ! -f .env ]; then
    echo "Erstelle .env Datei..."
    cp .env.example .env
    echo "Bitte bearbeite die .env Datei mit deinen Einstellungen!"
fi

# Erstelle Upload-Verzeichnis
mkdir -p uploads

# Starte Docker Container
echo "Starte Docker Container..."
docker-compose up -d

# Warte auf MySQL
echo "Warte auf MySQL..."
sleep 10

# Führe Datenbank-Migrationen aus
echo "Führe Datenbank-Migrationen aus..."
docker-compose exec backend alembic upgrade head

echo "=== Setup abgeschlossen ==="
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "API Docs: http://localhost:8000/docs"
