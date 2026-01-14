Param(
  [int]$Port = 8001
)

$ErrorActionPreference = "Stop"

Write-Host "Starte SOLIDWORKS-Connector als USER-Prozess (nicht als Windows-Service)..." -ForegroundColor Cyan
Write-Host "Port: $Port" -ForegroundColor Cyan
Write-Host "Hinweis: Dieses Fenster muss offen bleiben." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcDir = Join-Path $scriptDir "src"

if (!(Test-Path $srcDir)) {
  throw "src-Verzeichnis nicht gefunden: $srcDir"
}

Push-Location $srcDir
try {
  # main.py startet uvicorn auf 0.0.0.0:8001
  # (Port-Parameter ist aktuell nur Info; main.py nutzt fest 8001)
  python .\main.py
} finally {
  Pop-Location
}

