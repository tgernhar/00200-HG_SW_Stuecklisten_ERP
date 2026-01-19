# Import‑Workflow (Hauptseite)

## Ziel
Import startet über AU‑Nr und Artikel‑Auswahl. Projekte werden **eindeutig über die Artikelnummer** geführt; AU‑Nr ist Zusatzinfo.

## Frontend‑Flow
Implementiert in `frontend/src/App.tsx`:
1. Nutzer gibt AU‑Nr ein.
2. Frontend lädt HUGWAWI‑Artikel zum Auftrag:
   - `GET /api/hugwawi/orders/{au_nr}/articles`
3. Nutzer wählt Artikelnummer (oder **„Neue Artikelnummer von Hand eingeben“**).
4. Frontend erzeugt/öffnet Projekt:
   - `POST /api/projects` mit `artikel_nr` (Pflicht) + optional `au_nr` + `project_path`
5. Frontend erzeugt BOM und importiert:
   - `POST /api/projects/{project_id}/boms`
   - `POST /api/projects/{project_id}/boms/{bom_id}/import-solidworks?assembly_filepath=...`
6. Artikelliste wird neu geladen und im Grid angezeigt.

## Import‑Fortschritt (UI)
Während des SOLIDWORKS‑Imports wird ein einfacher **Fortschrittsbalken** angezeigt:
- „BOM anlegen“ → „Import läuft“ → „Fertig“
Damit ist erkennbar, dass der Import aktiv ist.

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

Zusätzlich wird die **Hauptbaugruppe** (die beim Import angegebene `.SLDASM`) als **eigener Stücklisteneintrag** aufgenommen und steht immer an erster Stelle:
- **Hauptbaugruppe**: `pos_nr = 0`
- **Alle weiteren (deduplizierten) Positionen**: `pos_nr = 1..n`

### SOLIDWORKS Herkunftsflag (`sw_origin`)
Für jede Stücklistenzeile gibt es das Flag **`sw_origin`** (boolean):
- **`sw_origin = true`**: Zeile stammt aus dem SOLIDWORKS‑Import (inkl. Hauptbaugruppe `pos_nr=0`).
- **`sw_origin = false`**: Zeile wurde **manuell** angelegt oder ist ein **Bestellartikel** (Unterartikel).

Wichtig: Bestellartikel übernehmen zwar die SOLIDWORKS‑Pfade vom Quellartikel (damit 2D/3D/PDF Aktionen funktionieren), bleiben aber trotzdem **`sw_origin=false`**.

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

