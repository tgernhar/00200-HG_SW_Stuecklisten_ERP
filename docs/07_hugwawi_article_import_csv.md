# HUGWAWI Artikel-Import CSV (Export aus Stücklisten-ERP)

## Zweck
Diese Funktion exportiert Artikel aus dem Stücklisten-ERP als **Import-CSV** für HUGWAWI.

Der Export ist so aufgebaut, dass er direkt in den HUGWAWI-Artikel-Import eingelesen werden kann.

## UI
Im Projektkopf (Header) gibt es den Button **„ERP-Artikel-Export“**. Dieser lädt die CSV-Datei herunter.

## Backend Endpoint
- `GET /api/projects/{project_id}/export-hugwawi-articles-csv`

### Filterlogik
Es werden **nur Artikel exportiert, die im ERP fehlen**:
- `articles.erp_exists = false`
- `hg_artikelnummer` ist gesetzt und nicht `"-"`

Hinweis: `erp_exists` wird durch den Artikelnummer-Abgleich gepflegt (**Artikel-Sync** Button).

### Export mit Auswahl (Checkboxen im Grid)
Wenn im Grid Zeilen ausgewählt sind, sendet das Frontend zusätzlich den Query‑Parameter:
- `article_ids=1,2,3`

Dann exportiert das Backend **nur diese IDs** – und innerhalb der Auswahl weiterhin nur Artikel mit:
- `erp_exists = false`

## CSV-Format (wichtig)
- **Separator**: Semikolon `;`
- **Leere Felder**: leer zwischen `;;` (nicht `NULL`)
- **Trailing Semikolon**: **jede Zeile endet mit `;`** (wie im Referenzbeispiel)
- **Encoding**: **Windows-1252 (cp1252)** (damit Umlaute beim HUGWAWI-Import korrekt ankommen)
- **Datum**:
  - `EK-Datum` = Exportdatum im Format `dd.mm.yyyy`

## Feldmapping (aktueller Stand)
Die Header-Reihenfolge ist fest in `backend/app/services/hugwawi_csv_export.py` definiert.

### Direkt aus dem Stücklisten-ERP
- **Artikelnummer**: `Article.hg_artikelnummer`
- **Bezeichnung**: `Article.benennung`
- **Index**: `Article.konfiguration` (falls leer: leerer String)
- **EK-Menge**: `Article.p_menge` (Fallback: `Article.menge`)
- **Abteilung**: aus `Article.abteilung_lieferant` (Name-Matching gegen erlaubte HUGWAWI Departments); sonst Default **`03 Auswärtsfertigung`**
- **Teilenummer**: `Article.teilenummer`
- **customtext1..7**:
  - `customtext1` = Werkstoff (`Article.werkstoff`)
  - `customtext2` = Werkstoff-Nr (`Article.werkstoff_nr`)
  - `customtext3` = Oberfläche (`Article.oberflaeche`)
  - `customtext4` = Farbe (`Article.farbe`)
  - `customtext5` = Oberflächenschutz (`Article.oberflaechenschutz`)
  - `customtext6` = Lieferzeit (`Article.lieferzeit`)
  - `customtext7` = Pfad (`Article.pfad`)
- **customfloat1..3**:
  - `customfloat1` = Länge (`Article.laenge`)
  - `customfloat2` = Breite (`Article.breite`)
  - `customfloat3` = Höhe (`Article.hoehe`)
- **Gewicht**: `Article.gewicht`

### Berechnete Felder
- **Warengruppe**: erste 6 Zeichen der Artikelnummer (`hg_artikelnummer[:6]`), sonst leer
- **Kunde** (KID-Regeln): aus Artikelnummer abgeleitet gemäß implementierter Logik in `compute_kunde_from_rules()`:
  - Warengruppe `099880`: 4 Zeichen ab Position 8 (1-based) **nach dem ersten '-'**
  - Warengruppe beginnt mit `09`: `warengruppe[2:5]`
  - Warengruppe beginnt mit `9`: letzte 5 Zeichen der Warengruppe

### Konstanten (wie Referenz/Absprache)
- **Einkaufseinheit** / **Verkaufseinheit**: `Stück (stck)`
- **EK VPE** / **VK VPE**: `1.0`
- **Verschnittfaktor**: `1.0`
- **Verkaufsfaktor**: `1.3`
- **VK Berechnung**: `VK_Stueck`
- **DIN/EN/ISO/EN-ISO**: leer (nicht NULL)

## Troubleshooting
- **CSV leer**: dann sind entweder keine Artikel im Projekt oder `erp_exists` wurde noch nicht gesetzt. Erst **Artikel-Sync** ausführen.
- **Abteilung wird nicht übernommen**: wenn `abteilung_lieferant` nicht exakt einem erlaubten Namen entspricht, wird auf **03 Auswärtsfertigung** gesetzt.
- **Encoding-Probleme (Umlaute)**: Export ist Windows-1252 (cp1252). Falls euer HUGWAWI-Import irgendwann UTF-8 sauber unterstützt, kann der Export wieder umgestellt werden.

