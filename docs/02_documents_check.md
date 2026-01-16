# Dokumentenprüfung (Projektweit)

## Ziel
Für alle Artikel eines Projekts sollen zugehörige Dateien im Dateisystem geprüft werden. Das Ergebnis wird in der DB gespeichert und im Grid angezeigt.

## Endpunkt
- `POST /api/projects/{project_id}/check-documents-batch`

## Pfadregeln / Namensregeln
Grundlage ist immer `sldasm_sldprt_pfad` des Artikels:
- **Ordner**: Ordner von `sldasm_sldprt_pfad`
- **Basename**: Dateiname ohne Endung von `sldasm_sldprt_pfad`
- **Bestell‑Dateien**: zusätzlich werden Varianten wie `… bestellversion.pdf/.dxf` und `… Bestellzng.pdf/.dxf` berücksichtigt (Projekt‑Praxis)

## Dokumenttypen
Geprüft werden (jeweils im selben Ordner wie `sldasm_sldprt_pfad`):
- `PDF`: `<basename>.pdf`
- `Bestell_PDF`: `<basename>_Bestell.pdf` **oder** `<basename> bestellversion.pdf` **oder** `<basename> Bestellzng.pdf`
- `DXF`: `<basename>.dxf`
- `Bestell_DXF`: `<basename>_Bestell.dxf` **oder** `<basename> bestellversion.dxf` **oder** `<basename> Bestellzng.dxf`
- `STEP`: `<basename>.stp` oder `<basename>.step`
- `X_T`: `<basename>.x_t`
- `STL`: `<basename>.stl` oder Fallback: irgendeine `.stl`, die den Basename enthält
- `SW_DRW`: wenn `slddrw_pfad` gesetzt, dieser Pfad; sonst `<basename>.SLDDRW`
- `SW_Part_ASM`: `sldasm_sldprt_pfad` selbst
- `ESP`: `<basename>.esp`

## DB‑Update / Flag‑Verhalten
- `documents` Tabelle: pro Artikel & Dokumenttyp wird `exists` und `file_path` gepflegt.
- Flags (Block B) werden **nur bei Existenz** auf `"x"` gesetzt. Wenn Datei nicht existiert, bleiben Flags unverändert (wichtig: `"1"` bleibt `"1"`).

