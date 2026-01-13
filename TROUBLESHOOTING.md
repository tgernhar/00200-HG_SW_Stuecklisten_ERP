# Troubleshooting - Docker Berechtigungen

## Problem: "permission denied while trying to connect to the docker API"

### Lösung 1: PowerShell als Administrator starten

1. PowerShell schließen
2. Rechtsklick auf PowerShell
3. "Als Administrator ausführen" wählen
4. Zum Projektverzeichnis wechseln:
   ```powershell
   cd "C:\Thomas\Cursor\00200 HG_SW_Stuecklisten_ERP"
   ```
5. Erneut versuchen:
   ```powershell
   docker ps
   ```

### Lösung 2: Docker Desktop vollständig starten

1. Docker Desktop öffnen
2. Warten bis der Status "Docker Desktop is running" angezeigt wird
3. In Docker Desktop Settings → General prüfen:
   - "Use the WSL 2 based engine" sollte aktiviert sein (falls WSL installiert)
   - "Start Docker Desktop when you log in" (optional)

### Lösung 3: Docker Desktop neu starten

1. Docker Desktop komplett schließen (aus dem System Tray)
2. Docker Desktop erneut starten
3. Warten bis vollständig gestartet
4. Erneut versuchen

### Lösung 4: Docker Context prüfen

```powershell
docker context ls
docker context use desktop-linux
```

### Lösung 5: Docker Desktop WSL Integration prüfen

Falls WSL verwendet wird:
1. Docker Desktop → Settings → Resources → WSL Integration
2. Sicherstellen, dass WSL Integration aktiviert ist

## Alternative: Lokale Entwicklung ohne Docker

Falls Docker weiterhin Probleme macht, kann das Projekt auch lokal entwickelt werden:

### Backend lokal starten:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

### Frontend lokal starten:
```powershell
cd frontend
npm install
npm run dev
```

### MySQL lokal installieren:
MySQL 8.0+ muss lokal installiert und konfiguriert sein. Die DATABASE_URL in `.env` muss entsprechend angepasst werden.
