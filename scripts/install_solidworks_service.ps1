# Installations-Script für SOLIDWORKS Connector Windows Service

Write-Host "=== SOLIDWORKS Connector Service Installation ===" -ForegroundColor Green

$servicePath = Join-Path $PSScriptRoot "..\solidworks-connector"

# Prüfe ob Python installiert ist
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Fehler: Python ist nicht installiert!" -ForegroundColor Red
    exit 1
}

# Installiere Dependencies
Write-Host "Installiere Dependencies..." -ForegroundColor Yellow
Set-Location $servicePath
python -m pip install -r requirements.txt

# Installiere Service
Write-Host "Installiere Windows Service..." -ForegroundColor Yellow
python src/service.py install

Write-Host "=== Service Installation abgeschlossen ===" -ForegroundColor Green
Write-Host "Service starten: python src/service.py start" -ForegroundColor Cyan
Write-Host "Service stoppen: python src/service.py stop" -ForegroundColor Cyan
