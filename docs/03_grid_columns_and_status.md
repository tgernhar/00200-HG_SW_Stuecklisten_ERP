# Grid: Spalten & Dokumentstatus

## Überblick
Das Frontend nutzt AG Grid zur Anzeige der Stückliste. Relevante Themen:
- Spaltenreihenfolge (Pos‑Nr/H+G Artikelnummer vor Benennung)
- Dokumentstatus‑Spalten (Icons/Farben)
- PDF‑Format‑Spalte (A0–A4)
- Tastatur‑Navigation & Inline‑Editing

## Spaltenreihenfolge
Im Block „Stücklisteninformationen“ stehen:
- `pos_nr` (Pos‑Nr)
- `hg_artikelnummer` (H+G Artikelnummer)
- `benennung`

## Editierbare Felder (Stücklisteninformationen)
Viele Spalten sind reine Status-/Existenzfelder und daher nicht editierbar. Editierbar sind insbesondere:
- **Custom‑Property Felder (werden in SOLIDWORKS zurückgeschrieben)**:
  - `hg_artikelnummer` (H+G Artikelnummer)
  - `teilenummer` (Teilenummer)
  - `werkstoff` (Material/Werkstoff)
  - `werkstoff_nr` (Werkstoffgruppe)
  - `abteilung_lieferant` (HUGWAWI - Abteilung)
  - `oberflaeche` (Oberfläche; Sonderregel `.SLDASM` → Oberfläche_ZSB beim Zurückschreiben)
  - `oberflaechenschutz` (Oberflächenschutz)
  - `farbe` (Farbe)
  - `lieferzeit` (Lieferzeit - geschätzt)
  - `teiletyp_fertigungsplan` (Teiletyp Fertigungsplan)
- **Produktionsmenge**:
  - `p_menge` (P‑Menge, editierbar)

## Menge (SOLIDWORKS) vs. P‑Menge (Produktion)
- **`menge`**: Menge aus SOLIDWORKS (read‑only) und **standardmäßig ausgeblendet** (kann im Column‑Sidebar wieder eingeblendet werden).
- **`p_menge`**: Produktionsmenge (editierbar), initial aus `menge` vorbelegt (Import).

## Tastatur‑Navigation & Inline‑Editing
Ziel: schnelle Bearbeitung ohne Maus (Fokus bewegen + Werte eingeben).

### Fokus bewegen (Navigation)
- **Pfeiltasten**: bewegen den Fokus zur nächsten/vorherigen Zelle.
  - Nicht editierbare Zellen werden (soweit möglich) **übersprungen**.
  - Am Rand (erste/letzte Zeile/Spalte) bleibt der Fokus stehen.
- **Tab**: Fokus nach rechts (zum nächsten editierbaren Feld).
- **Shift+Tab**: Fokus nach links (zum vorherigen editierbaren Feld).

### Editieren/Bestätigen (Commit)
- **Tippen** in einer fokussierten editierbaren Zelle startet die Bearbeitung.
- **Enter**: Bearbeitung wird **abgeschlossen** (Wert wird übernommen) und der **Fokus bleibt** auf der Zelle.
- **Blur (Fokusverlust)**: Bearbeitung wird ebenfalls **abgeschlossen**.

### Pfeiltasten im Edit‑Modus
Wenn eine Zelle gerade bearbeitet wird (Cursor im Eingabefeld):
- **Pfeiltaste** beendet zuerst die Bearbeitung (wie Enter), **bestätigt** den Wert und navigiert dann zur nächsten Zelle in Pfeilrichtung.

### Hinweis zur Stabilität beim Speichern
Beim Speichern/Reload der Artikeldaten bleibt das Grid im UI gemountet (Loading als Overlay), damit der aktuelle Fokus nicht durch ein Unmount verloren geht.

## Dokumentstatus‑Renderer
Renderer‑Logik (vereinfacht):
- **grün**: `value == 'x'` und Datei existiert (`*_exists == true`)
- **gelb**: `value == '1'` (Neugenerierung/Druck anfordern)
- **rot**: sonst

### Legende (Wert/Symbol)
- **Wert = `1`** (gelb): Dokument erstellen
- **Wert = `-`** (rot): Dokument fehlt
- **Wert = `x`** (grün): Dokument vorhanden

Klick‑Verhalten:
- PDF/Bestell_PDF: öffnet die PDF über Backend‑HTTP (`/api/documents/open-pdf?path=...`)
- andere Dokumenttypen: öffnet den Ordnerpfad der SOLIDWORKS‑Datei (Best‑Effort, Browser‑Policy abhängig)

## Existence/Path Felder
Damit alle Dokumentspalten konsistent rendern, liefert das Backend zusätzlich pro Dokumenttyp:
- `*_exists` (bool) und `*_path` (string)

## PDF‑Format‑Spalte
Neue Spalte `pdf_format`:
- Backend liest `mediabox` der PDF (Seite 1), konvertiert in mm und mappt auf A‑Reihe:
  - A4/A3/A2/A1/A0 oder `Custom`

