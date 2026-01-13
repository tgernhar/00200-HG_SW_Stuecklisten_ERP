# Setup Script für das Projekt (PowerShell)

Write-Host "=== Stücklisten-ERP System Setup ===" -ForegroundColor Green

# Prüfe ob Docker installiert ist
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Fehler: Docker ist nicht installiert!" -ForegroundColor Red
    exit 1
}

# Prüfe ob Docker Compose installiert ist
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "Fehler: Docker Compose ist nicht installiert!" -ForegroundColor Red
    exit 1
}

# Erstelle .env Datei falls nicht vorhanden
if (-not (Test-Path .env)) {
    Write-Host "Erstelle .env Datei..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "Bitte bearbeite die .env Datei mit deinen Einstellungen!" -ForegroundColor Yellow
}

# Erstelle Upload-Verzeichnis
if (-not (Test-Path uploads)) {
    New-Item -ItemType Directory -Path uploads | Out-Null
}

# Starte Docker Container
Write-Host "Starte Docker Container..." -ForegroundColor Yellow
docker-compose up -d

# Warte auf MySQL
Write-Host "Warte auf MySQL..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Führe Datenbank-Migrationen aus
Write-Host "Führe Datenbank-Migrationen aus..." -ForegroundColor Yellow
docker-compose exec backend alembic upgrade head

Write-Host "=== Setup abgeschlossen ===" -ForegroundColor Green
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
