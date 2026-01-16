# Import‑Workflow (Hauptseite)

## Ziel
Statt zuerst ein Projekt auszuwählen, startet der Nutzer direkt über ein Formular:
- **Auftragsnummer (AU‑Nr)** eingeben
- **Pfad zur SolidWorks‑Baugruppe** (Assembly) eingeben
- Import aus SOLIDWORKS starten → Daten werden in MySQL gespeichert → Artikel werden angezeigt

## Frontend‑Flow
Implementiert in `frontend/src/App.tsx`:
1. Nutzer gibt AU‑Nr und Assembly‑Pfad ein.
2. Frontend erzeugt Projekt:
   - `POST /api/projects` mit `au_nr` und `project_path`
3. Frontend triggert Import:
   - `POST /api/projects/{project_id}/import-solidworks?assembly_filepath=...`
4. Danach wird die Artikelliste neu geladen und im Grid angezeigt.

### Hinweis zu „Datei auswählen“
Browser liefern aus Sicherheitsgründen **keinen vollständigen Pfad** über den File‑Dialog. Daher ist die **manuelle Pfad‑Eingabe** weiterhin notwendig, wenn der Backend‑Import den echten Pfad braucht.

## Backend‑Erwartung
Das Backend erwartet, dass der `assembly_filepath` erreichbar ist (unter Docker typischerweise via Mount `C:/Thomas/Solidworks` → `/mnt/solidworks`).

