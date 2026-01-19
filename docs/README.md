# Stücklisten‑ERP – Dokumentation

Diese Dokumentation fasst die in der Entwicklung entstandenen Plan‑Notizen zusammen und beschreibt den aktuellen Stand des Projekts.

## Inhalt
- [Import‑Workflow](01_import_workflow.md)
- [SOLIDWORKS Custom Properties: Import & Zurückschreiben](06_solidworks_custom_properties.md)
- [Dokumentenprüfung](02_documents_check.md)
- [Grid: Spalten & Dokumentstatus](03_grid_columns_and_status.md)
- [Dokument‑Export](05_document_export.md)
- [HUGWAWI Artikel-Import CSV](07_hugwawi_article_import_csv.md)
- [Drucken](04_printing.md)
- [Manuelle Zeilen & BN‑Sync](08_manual_rows_and_bn_sync.md)

## Architektur (Kurzüberblick)
- **Frontend**: React + TypeScript (AG Grid), Dev‑URL je nach Setup z.B. `http://localhost:3000` oder `http://localhost:5173`
- **Backend**: FastAPI (REST), Standard‑URL `http://localhost:8000`
- **DB**: MySQL (Docker‑Service `mysql`)
- **SOLIDWORKS Connector**: separater Dienst auf Windows, vom Backend per HTTP angesprochen

## Datenlogik (Kurzinfo)
- **Projekt‑Key**: Projekte sind eindeutig über **Artikelnummer (`artikel_nr`)**.  
  `au_nr` ist Zusatzinfo und darf mehrfach vorkommen.

### Datenstruktur-Hierarchie
Das System verwendet eine dreistufige Hierarchie:
- **Project** (eindeutig über `artikel_nr`) - Ein Projekt entspricht einer Artikelnummer
- **Bom** (mehrere BOMs pro Projekt möglich) - Eine BOM entspricht einer Auftrags-Artikel-Kombination
  - Eindeutig über `(project_id, hugwawi_order_id, hugwawi_order_article_id)`
- **Article** (gehört zu einer BOM) - Einzelne Stücklistenzeilen
  - Artikel gehören zu `bom_id`, nicht direkt zu `project_id`

### Docker Compose (wichtigste Ports)
- Frontend: `3000`
- Backend: `8000`
- MySQL: `3306`

## Start/Build (Docker)
Aus dem Repo‑Root:

```bash
docker compose up -d --build
```

Bei Änderungen nur am Backend:

```bash
docker compose up -d --build backend
```

## API-Übersicht (wichtigste Endpunkte)

### Projekte & BOMs
- `GET /api/projects` - Liste aller Projekte
- `POST /api/projects` - Projekt erstellen
- `GET /api/projects/{id}/boms` - BOMs auflisten
- `POST /api/projects/{id}/boms` - BOM erstellen
- `POST /api/projects/{id}/boms/{bom_id}/import-solidworks` - SOLIDWORKS Import

### Artikel
- `GET /api/projects/{id}/articles?bom_id=...` - Artikel abrufen (BOM-basiert)
- `PATCH /api/articles/{id}` - Artikel aktualisieren
- `PATCH /api/articles/{id}/document-flags` - Dokument-Flags aktualisieren

### Dokumente & Drucken
- `POST /api/projects/{id}/check-documents-batch` - Dokumente prüfen
- `POST /api/projects/{id}/generate-documents-batch` - Dokumente generieren
- `GET /api/projects/{id}/print-pdf-queue-merged` - PDF-Queue drucken (Browser-basiert)

### ERP & Export
- `POST /api/projects/{id}/check-all-articlenumbers` - ERP-Abgleich
- `GET /api/projects/{id}/export-hugwawi-articles-csv` - CSV-Export

**Vollständige API-Dokumentation**: Siehe Hauptplan-Datei oder `http://localhost:8000/docs` (Swagger UI)

## Troubleshooting (kurz)
- **Backend hängt / `ERR_EMPTY_RESPONSE`**: Backend‑Container Logs prüfen: `docker compose logs --tail 200 backend`
- **Backend startet nicht wegen SyntaxError**: Logs zeigen Datei/Zeile; nach Fix `docker compose up -d --build backend`
- **DB‑Zugriff**: `mysql` muss `healthy` sein (`docker compose ps`)

