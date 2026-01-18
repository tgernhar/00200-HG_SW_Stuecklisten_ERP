# Manuelle Zeilen & BN‑Sync

## Manuelle Zeilen
Im Grid gibt es zwei Buttons:
- **„Zeile manuell hinzufügen“**: fügt eine leere Zeile in der aktuellen BOM ein.
- **„Zeilen löschen“**: löscht ausgewählte Zeilen **nur**, wenn sie **nicht** aus SOLIDWORKS importiert wurden.

**Löschen ist geschützt**: Passwort **`1`** erforderlich.

Eine Zeile gilt als SOLIDWORKS‑importiert, wenn einer der Pfade gesetzt ist:
`pfad`, `sldasm_sldprt_pfad`, `slddrw_pfad`.

## BN‑Sync (Bestellungen)
Beim **BN‑Sync** werden Bestellungen aus HUGWAWI synchronisiert.
Falls zu einer Bestellung **kein Artikel** existiert, wird eine zusätzliche Zeile als Artikel angelegt:
- **Bestellinformationen** sind befüllt (`HG‑BNR`, `BNR‑Status`, `BNR‑Menge`, `Bestellkommentar`, `HG‑LT`, `Bestätigter LT`)
- **Bezeichnung** bleibt leer und ist editierbar

## Menge‑Spalte
Im Grid gibt es eine zusätzliche Spalte **„Menge“**:
- **nicht editierbar**
- standardmäßig ausgeblendet
- in der Toolbar über **„Menge anzeigen“** einblendbar

Die Spaltenköpfe **Menge** und **P‑Menge** sind um 90° gedreht (wie Pos‑Nr).
