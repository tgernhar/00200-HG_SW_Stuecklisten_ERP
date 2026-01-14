"""
Development Server Runner
"""
import uvicorn
import sys
import os
import site

# Füge User-Site-Packages zum Python-Pfad hinzu (wichtig für Subprozesse)
# Prüfe beide mögliche Benutzer-Pfade
user_site = site.getusersitepackages()
possible_paths = [
    user_site,
    r"C:\Users\tgernhar\AppData\Roaming\Python\Python314\site-packages",
    r"C:\Users\admin\AppData\Roaming\Python\Python314\site-packages"
]

# Füge alle existierenden Pfade hinzu
pythonpath_parts = []
for path in possible_paths:
    if path and os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)
        pythonpath_parts.append(path)

# Setze PYTHONPATH Umgebungsvariable für Subprozesse
if pythonpath_parts:
    existing_pythonpath = os.environ.get('PYTHONPATH', '')
    if existing_pythonpath:
        os.environ['PYTHONPATH'] = f"{os.pathsep.join(pythonpath_parts)}{os.pathsep}{existing_pythonpath}"
    else:
        os.environ['PYTHONPATH'] = os.pathsep.join(pythonpath_parts)

# Füge das Backend-Verzeichnis zum Python-Pfad hinzu
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Teste ob sqlalchemy importierbar ist
try:
    import sqlalchemy
    print(f"DEBUG: sqlalchemy found at: {sqlalchemy.__file__}")
except ImportError as e:
    print(f"ERROR: Cannot import sqlalchemy: {e}")
    print(f"DEBUG: sys.path = {sys.path[:5]}")
    print(f"DEBUG: PYTHONPATH = {os.environ.get('PYTHONPATH', 'NOT SET')}")
    raise

# Importiere die App direkt, um sicherzustellen, dass alle Module gefunden werden
from app.main import app

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False  # Deaktiviere Reload, um Subprozess-Probleme zu vermeiden
    )
