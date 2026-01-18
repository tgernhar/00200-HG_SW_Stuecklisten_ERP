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

## Architektur (Kurzüberblick)
- **Frontend**: React + TypeScript (AG Grid), Dev‑URL je nach Setup z.B. `http://localhost:3000` oder `http://localhost:5173`
- **Backend**: FastAPI (REST), Standard‑URL `http://localhost:8000`
- **DB**: MySQL (Docker‑Service `mysql`)
- **SOLIDWORKS Connector**: separater Dienst auf Windows, vom Backend per HTTP angesprochen

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

## Troubleshooting (kurz)
- **Backend hängt / `ERR_EMPTY_RESPONSE`**: Backend‑Container Logs prüfen: `docker compose logs --tail 200 backend`
- **Backend startet nicht wegen SyntaxError**: Logs zeigen Datei/Zeile; nach Fix `docker compose up -d --build backend`
- **DB‑Zugriff**: `mysql` muss `healthy` sein (`docker compose ps`)

