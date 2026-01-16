# Dokument-Export (PDF/DXF/STEP/…)

## Überblick
In der Web-Anwendung können zu einem Projekt SOLIDWORKS-Dokumente automatisiert erzeugt werden.
Der Export läuft **Frontend → Backend → SOLIDWORKS‑Connector → Dateisystem**.

## Voraussetzungen
- **SOLIDWORKS‑Connector läuft** auf Windows (Standard: `http://localhost:8001`)
  - Prüfung: `http://localhost:8001/docs` muss den Endpoint `POST /api/solidworks/create-2d-documents` anzeigen.
- **Backend** läuft (typisch im Docker Container) und erreicht den Connector über `SOLIDWORKS_CONNECTOR_URL`
  - docker-compose Default: `http://host.docker.internal:8001`
- Die SOLIDWORKS-Dateien sind erreichbar:
  - Host-Pfade (Windows): `C:\Thomas\Solidworks\...`
  - Docker-Mount (Backend): `C:/Thomas/Solidworks` → `/mnt/solidworks` (read-only)

## UI-Trigger
Im Frontend gibt es im Projektkopf den Button **„Dokumente erstellen“**.
Dieser triggert im Backend die Batch-Generierung.

## Backend-Endpunkt
- `POST /api/projects/{project_id}/generate-documents-batch`

Die Batch-Generierung läuft artikelweise und erzeugt nur Dokumente, deren Flags den Wert **`"1"`** haben.
Nach erfolgreicher Erstellung wird das jeweilige Flag auf **`"x"`** gesetzt und `documents.file_path` aktualisiert.

## SOLIDWORKS-Connector Endpunkte
- **2D**: `POST /api/solidworks/create-2d-documents`
  - Request: `filepath` (muss `.SLDDRW` sein), plus Booleans `pdf`, `dxf`, `bestell_pdf`, `bestell_dxf`
  - Response: `created_files[]`, optional `warnings[]`
- **3D**: `POST /api/solidworks/create-3d-documents`
  - Request: `filepath` (`.SLDPRT`/`.SLDASM`), plus Booleans `step`, `x_t`, `stl`

## 2D-Export (PDF/DXF/Bestellzng)

### Eingabedatei
Für 2D wird eine Zeichnung benötigt:
- primär `article.slddrw_pfad`
- Fallback: aus `article.sldasm_sldprt_pfad` abgeleitet (`<basename>.SLDDRW`)

### Dateinamen
- **PDF**: `<basename>.pdf`
- **DXF**: `<basename>.dxf`
- **Bestell_PDF**: `<basename> Bestellzng.pdf`
- **Bestell_DXF**: `<basename> Bestellzng.dxf`

### „Bestellzng“: Element ausblenden/entfernen
Für Bestell-Ausgaben soll eine bestimmte Notiz **nicht** exportiert werden, aber in der Zeichnung erhalten bleiben.

Selektionsziel:
- Name: `Detailelement219@Blatt1`
- Typ: `NOTE`

Implementiertes Verhalten:
- **Bestell-PDF**: Notiz wird temporär manipuliert (selektiert und während des Exports so verändert, dass sie im Bestell-PDF nicht erscheint), danach wird der Originalzustand wiederhergestellt.
- **Bestell-DXF**: Notiz wird für den Export **temporär gelöscht**, dann wird die DXF exportiert und anschließend per **Undo** wiederhergestellt. Zusätzlich wird das Dokument am Ende ohne Speichern geschlossen, so dass keine dauerhaften Änderungen bleiben.

Hinweis: DXF-Export verhält sich je nach SOLIDWORKS-Version/Settings teils anders als PDF (Visibility/Off-sheet kann trotzdem exportiert werden). Deshalb ist die Delete→Export→Undo-Strategie für Bestell-DXF die robusteste Variante.

## 3D-Export (STEP/X_T/STL)
3D-Exports werden aus dem Part/Assembly erzeugt:
- **STEP**: `<basename>.stp`
- **X_T**: `<basename>.x_t`
- **STL**: `<basename>.stl`

## Typische Fehlerbilder
- **404 vom Connector**: Auf dem Host läuft ein alter Connector ohne `create-2d-documents`. Lösung: Connector neu starten und `http://localhost:8001/docs` prüfen.
- **Timeout im Backend**: SOLIDWORKS-Exports können > 5s dauern; Backend nutzt deshalb einen längeren HTTP-Timeout für den Connector-Aufruf.

