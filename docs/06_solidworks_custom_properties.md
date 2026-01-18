# SOLIDWORKS Custom Properties: Import & Zurückschreiben

## Überblick
Dieses Projekt unterstützt:
- **Import** von SOLIDWORKS Custom Properties aus Parts/Assemblies in die Datenbank (und Anzeige im Frontend‑Grid)
- **Zurückschreiben** editierter Werte aus dem Frontend zurück in die SOLIDWORKS‑Dateien

Wichtig: Import und Zurückschreiben verwenden **dieselbe Feldliste / dasselbe Mapping** als Single‑Source‑of‑Truth:
- `backend/app/services/solidworks_property_mapping.py`

## Import (SOLIDWORKS → DB)
- Importiert werden sowohl Parts (`.SLDPRT`) als auch Assemblies (`.SLDASM`) aus der Baugruppe.
- Der Import läuft **rekursiv über alle Ebenen** (Unterbaugruppen + Teile).
- Custom Properties werden normalisiert (z.B. Umlaute/Sonderzeichen) und dann über das zentrale Mapping in DB‑Felder geschrieben.

## Zurückschreiben (Frontend/DB → SOLIDWORKS)

### Backend Endpunkt
- `POST /api/projects/{project_id}/push-solidworks`

Der Endpunkt nimmt die Artikel eines Projekts, mappt relevante DB‑Felder auf SOLIDWORKS‑Custom‑Properties und ruft den SOLIDWORKS‑Connector auf.

### Connector Endpunkt
- `POST /api/solidworks/set-custom-properties`

### Regeln beim Schreiben
- **Nur konfigurationsspezifisch (config-only)**: es wird ausschließlich in die Ziel‑Konfiguration geschrieben (kein globaler Fallback).
- **Keine Leerwerte überschreiben**: `None` oder `""` werden nicht geschrieben, damit vorhandene SOLIDWORKS‑Werte nicht mit Leerstring überschrieben werden.
- **Bereits geöffnete Dokumente**: wenn ein Dokument in der verbundenen SOLIDWORKS‑Instanz bereits offen ist, wird es „in place“ aktualisiert und nicht geschlossen.

### Sonderregel „Oberfläche“
Je nach Dateityp wird in unterschiedliche SOLIDWORKS‑Custom‑Properties geschrieben:
- **Assembly (`.SLDASM`)**: `Oberfläche_ZSB`
- **Part (`.SLDPRT`)**: `Oberfläche`

Im Backend landet beides im Feld `oberflaeche`.

## Feldliste / Mapping (auszug)
Die eigentliche Quelle ist `backend/app/services/solidworks_property_mapping.py`. Auszug:
- `hg_artikelnummer` → `H+G Artikelnummer`
- `teilenummer` → `Teilenummer`
- `werkstoff` → `Material`
- `werkstoff_nr` → `Werkstoffgruppe`
- `abteilung_lieferant` → `HUGWAWI - Abteilung`
- `oberflaeche` → `Oberfläche` (Part) oder `Oberfläche_ZSB` (Assembly)
- `oberflaechenschutz` → `Oberflächenschutz`
- `farbe` → `Farbe`
- `lieferzeit` → `Lieferzeit - geschätzt`
- `teiletyp_fertigungsplan` → `Teiletyp Fertigungsplan`

## Hinweise zur Verifikation
Wenn ein Wert „nicht ankommt“:
- prüfen, ob in SOLIDWORKS die **richtige Konfiguration** aktiv ist
- prüfen, ob das Property ggf. als **global** statt konfigurationsspezifisch betrachtet wird (dieses Projekt schreibt config-only)

