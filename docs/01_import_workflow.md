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

## Was wird importiert?
- **Rekursiv über alle Ebenen**: der Import läuft nicht nur über Top‑Level‑Komponenten, sondern nimmt auch **Unterbaugruppen und deren Teile** mit.
- **Dedup/Aggregation**: Teile werden beim Import **dedupliziert** (gleiche Teile/Konfiguration werden aggregiert). Dadurch kann sich die Anzeige von SOLIDWORKS‑Positionsnummern verändern.

### Positionsnummer (`pos_nr`)
Da dedupliziert wird, sind die ursprünglichen SOLIDWORKS‑Positionsnummern oft nicht mehr fortlaufend. Deshalb wird nach der Aggregation:
- nach der ursprünglichen SOLIDWORKS‑Position sortiert und anschließend
- **neu fortlaufend** von **1..n** durchnummeriert.

### Mengen: `menge` vs. `p_menge`
- **`menge`**: Menge laut SOLIDWORKS‑Stückliste (wird importiert, **read‑only**). Im Grid ist diese Spalte **standardmäßig ausgeblendet**, kann aber bei Bedarf wieder eingeblendet werden.
- **`p_menge`**: Produktionsmenge für die Fertigung (**editierbar**). Beim Import wird `p_menge` initial mit `menge` vorbelegt.

## Custom Properties (Mapping)
Die Zuordnung SOLIDWORKS‑Custom‑Properties ↔ Datenbankfelder ist zentral definiert, damit Import und Zurückschreiben **dieselben Felder** verwenden:
- Backend Mapping: `backend/app/services/solidworks_property_mapping.py`

Beispiele (auszug):
- `H+G Artikelnummer` → `hg_artikelnummer`
- `Teilenummer` → `teilenummer`
- `Material` → `werkstoff`
- `Werkstoffgruppe` → `werkstoff_nr`
- `HUGWAWI - Abteilung` → `abteilung_lieferant`
- `Lieferzeit - geschätzt` → `lieferzeit`
- `Oberfläche` / `Oberfläche_ZSB` → `oberflaeche` (siehe Writeback‑Regel in der Custom‑Properties‑Doku)

