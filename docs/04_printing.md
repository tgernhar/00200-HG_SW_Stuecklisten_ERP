# Drucken

## Zielbild
Der Druck soll im Browser (Chrome) erfolgen, damit der Nutzer im Druckdialog:
- Papierformat (A4/A3/…) wählen kann
- Ausrichtung (Hoch/Quer) wählen kann

## Flags / Auswahl der zu druckenden PDFs
Im Grid gibt es das Flag:
- `pdf_drucken` (Werte: leer / `1` / `x`)

Workflow:
1. Nutzer markiert beliebig viele Zeilen mit `pdf_drucken = 1`.
2. Druckfunktion verarbeitet genau diese Queue.

Persistenz:
- `PATCH /api/articles/{article_id}/document-flags` speichert `pdf_drucken` (und weitere Flags).

## PDF öffnen (HTTP, kein file://)
Browser blockieren `file://` aus Web‑Apps. PDFs werden daher über Backend ausgeliefert:
- `GET /api/documents/open-pdf?path=...` (inline)

## PDF Viewer + Direkt‑Druck (Einzeln)
Zum Drucken einzelner PDFs aus der Queue gibt es:
- `GET /api/projects/{project_id}/print-pdf-queue-page` (Queue‑Seite)
- `GET /api/documents/view-pdf?path=...&return_to=...&autoprint=1`

Implementierungsdetail:
- `view-pdf` lädt die PDF per `fetch()` als **Blob** und setzt `<embed src="blob:...">`, um Download‑Verhalten zu vermeiden.
- `autoprint=1` triggert `window.print()` sobald die PDF geladen ist.

## Gesamte Queue in einem Job drucken (empfohlen)
Stabilster Workflow: **alle PDFs serverseitig mergen** und dann einmal drucken.

Endpunkt:
- `GET /api/projects/{project_id}/print-pdf-queue-merged`

Der Browser öffnet eine Sammel‑PDF (inline). Danach: **einmal Strg+P**.

Dependency:
- Backend nutzt `pypdf` zum Zusammenführen.

