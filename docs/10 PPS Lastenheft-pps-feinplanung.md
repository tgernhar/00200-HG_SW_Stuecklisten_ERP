# Lastenheft – PPS Feinplanungstool (Web, ERP/MariaDB)

**Version:** 0.1 (Entwurf)  
**Datum:** 2026-01-24  
**Zeitzone:** Europe/Berlin  
**Quelle/ERP:** MariaDB (direkter DB-Zugriff, Read-only)

---

## Inhaltsverzeichnis
1. [Ziel, Zweck, Scope](#1-ziel-zweck-scope)  
2. [Rollen & Benutzergruppen](#2-rollen--benutzergruppen)  
3. [Domänenmodell / Begriffe](#3-domänenmodell--begriffe)  
4. [Datenintegration (ERP via MariaDB)](#4-datenintegration-erp-via-mariadb)  
5. [ToDo-Erzeugung und -Verwaltung](#5-todo-erzeugung-und--verwaltung)  
6. [Ressourcen- und Kalenderlogik](#6-ressourcen--und-kalenderlogik)  
7. [Planung (Gantt/Planboard)](#7-planung-ganttplanboard)  
8. [Konfliktmanagement (statt harter Verbote)](#8-konfliktmanagement-statt-harter-verbote)  
9. [Qualifikationsmatrix (Soft-Check)](#9-qualifikationsmatrix-soft-check)  
10. [IST-Rückmeldung / Statusableitung aus Zeitbuchungen](#10-ist-rückmeldung--statusableitung-aus-zeitbuchungen)  
11. [Nicht-funktionale Anforderungen](#11-nicht-funktionale-anforderungen)  
12. [Datenhaltung im PPS-Tool (konzeptionell)](#12-datenhaltung-im-pps-tool-konzeptionell)  
13. [Abnahmekriterien (Testszenarien)](#13-abnahmekriterien-testszenarien)  
14. [Offene Punkte & Defaults](#14-offene-punkte--defaults)

---

## 1. Ziel, Zweck, Scope

### 1.1 Ziel
Das System dient zur **Feinplanung von Produktions-ToDos** (Arbeitsvorgänge) aus einem bestehenden ERP-System. Planer sollen ToDos flexibel aus Aufträgen ableiten und diese **visuell (Gantt/Planboard)** auf Abteilungen, Maschinen und Mitarbeiter einplanen und umplanen können.

### 1.2 Systemgrenzen
- **ERP ist führend** für: Artikel, Stücklisten, Arbeitspläne/Arbeitsgänge, Maschinen, Mitarbeiter, Qualifikationen, Mitarbeiter-Arbeitszeiten, Aufträge inkl. Revisionsstand.
- Das PPS-Tool ist führend für: **Planung (Soll-Termine), Zuweisungen, Konfliktanzeigen, Plan-UI**.
- **IST-Status** wird aus der **Zeiterfassung/Zeitenbuchung** der Mitarbeiter abgeleitet (Start/Stop/Erledigt).

### 1.3 Auftragstypen
- Relevant: **Kundenauftrag** (ERP).

### 1.4 Planungsprinzipien (festgelegt)
- **Zeitgranularität:** 15 Minuten.
- **Planungsziel:** Liefertermin ist wichtigste Zielgröße; Durchlaufzeiten sollen planbar werden.
- **Splitting:** ToDos dürfen gesplittet werden.
- **Arbeitsgänge:** üblicherweise sequenziell, in Ausnahmefällen parallel möglich.
- **Ressourcenbindung:** meist Maschine + Mitarbeiter gleichzeitig; teils abhängig von Maschine unabhängig.
- **Alternativmaschinen:** nein.
- **Qualifikationen:** Qualifikationsmatrix vorhanden, nicht hart zu prüfen (Soft-Check/Warnung).
- **Überlappungen:** erlaubt, werden nur angezeigt (Konflikte), nicht verhindert.
- **Verschieben:** optional auswählbar, standardmäßig sollen abhängige ToDos mitverschoben werden.
- **Endgeräte:** PC und Tablet.

---

## 2. Rollen & Benutzergruppen

| Rolle | Rechte (Kurz) |
|---|---|
| Admin | Ressourcen/Kalender konfigurieren, ERP-Mapping, Benutzer/Rollen |
| Planer | ToDos erzeugen, planen, verschieben, Konflikte bearbeiten |
| Teamleiter | Planung/Status eigener Abteilung einsehen, ggf. umplanen (optional) |
| Mitarbeiter | Eigene ToDos sehen; Status wird primär über Zeitbuchungen abgeleitet; ggf. UI-Hinweise/Statusbuttons (optional) |
| Viewer | Nur lesen |

**REQ-SEC-001 (MUSS):** Rollenbasierte Rechte (RBAC) und Bereichsfilter (z. B. Abteilung).

---

## 3. Domänenmodell / Begriffe

### 3.1 ERP-Objekte
- Auftrag (Kundenauftrag) inkl. **Revisionsstand**
- Auftragsposition (Artikel, Menge)
- Stückliste (BOM) mit Positionen
- Arbeitsplan / Arbeitsgänge (inkl. Rüstzeit + Stückzeit)
- Ressourcen: Abteilungen, Maschinen, Mitarbeiter
- Qualifikationsmatrix
- Mitarbeiter-Arbeitszeiten/Kalender (aus ERP)
- Zeiterfassung (Zeitbuchungen mit Start/Stop/Erledigt)

### 3.2 PPS-Objekte (neu)
**ToDo** = planbare Einheit (Balken). Typen:
- **ToDo-Container** (optional planbar): Auftrag, Auftragsposition, Stücklistenknoten
- **ToDo-Operation** (Hauptfall): Arbeitsgang/Operation (mit Rüst-/Laufzeiten)

**REQ-DOM-001 (MUSS):** Container dienen primär Struktur/Filter; operative Planung erfolgt auf Operation-ToDos.

### 3.3 Ressourcenmodell
- **Abteilung** = Kapazitätspool/organisatorische Zuordnung
- **Maschine** = konkrete Ressource (typisch 1 Vorgang gleichzeitig)
- **Mitarbeiter** = konkrete Ressource mit Verfügbarkeit (aus ERP) und Qualifikationen

---

## 4. Datenintegration (ERP via MariaDB)

### 4.1 Zugriff
**REQ-INT-001 (MUSS):** Direkte Anbindung via **MariaDB** an ERP-Datenbank.  
**REQ-INT-002 (MUSS):** Zugriff über einen **Read-only DB-User** (keine Änderungen im ERP).  
**REQ-INT-003 (MUSS):** Zugriff über **Views** oder klar definierte Tabellen-/Feldlisten (Schemaänderungen isolierbar).

### 4.2 Import- und Sync-Strategie
**REQ-INT-010 (MUSS):** Initialer Import (Stammdaten + offene Aufträge).  
**REQ-INT-011 (MUSS):** Inkrementeller Sync (Delta) zyklisch (Intervall konfigurierbar).  
**REQ-INT-012 (SOLL):** Delta-Ermittlung per `updated_at` / Änderungsnummer / Trigger-Tabellen (falls verfügbar).

### 4.3 Revisionsstand
**REQ-REV-001 (MUSS):** Pro Auftrag ist der Revisionsstand definiert; BOM/Arbeitsplan werden für diesen Stand importiert.  
**REQ-REV-002 (MUSS):** Bei Revisionsänderung im ERP: Warnung im Tool + definierte Handlung.

Standard-Verhalten (Default):
- **REQ-REV-003 (MUSS):** Planung bleibt unverändert; das Tool zeigt Hinweis „Revision geändert“.
- **REQ-REV-004 (KANN):** Option „Neu generieren“ (Regen der ToDo-Struktur mit Delta-Vergleich).

### 4.4 Rückgabe ans ERP
Da IST aus Zeitbuchung kommt, ist Write-back optional.

**REQ-EXP-001 (KANN):** Export geplanter Start-/Endtermine je Arbeitsgang ins ERP (sofern ERP-Schnittstelle/Tabellen dies unterstützen).

---

## 5. ToDo-Erzeugung und -Verwaltung

### 5.1 ToDo-Definition (Granularität)
Planer können ToDos definieren aus:
- gesamtem Auftrag
- Auftragsposition(en)
- Stücklistenposition(en)
- Arbeitsgängen zu Stücklistenartikeln

**REQ-TODO-001 (MUSS):** Operation-ToDos können aus ERP-Arbeitsgängen erzeugt werden.  
**REQ-TODO-002 (MUSS):** Jedes ToDo ist eindeutig auf ERP-Objekte referenzierbar (Traceability).

### 5.2 ToDo-Felder (MUSS)
Minimalfelder:
- ToDo-ID (intern)
- ERP-Referenzen: Auftrag-ID, Position-ID, BOM-Knoten-ID, Arbeitsgang-ID
- Bezeichnung (Artikel/Arbeitsgang)
- Menge
- Zeiten:
  - Rüstzeit (Minuten)
  - Stückzeit (Minuten)
  - berechnete Gesamtdauer (Minuten)
- Planwerte: geplanter Start, geplantes Ende
- Zuweisung: Abteilung, Maschine, Mitarbeiter (je nach Modus)
- Status: Neu / Geplant / In Arbeit / Erledigt / Blockiert (Blockiergrund)
- Lieferterminbezug (Auftragstermin)
- Priorität (aus ERP oder manuell)
- Notizen/Anhänge (optional)

**REQ-TODO-010 (MUSS):** Alle Planwerte werden in 15-Minuten Raster gespeichert/gerundet.

### 5.3 Dauerlogik
**REQ-TIME-001 (MUSS):** Dauerberechnung aus ERP-Zeiten: `Rüstzeit + Menge * Stückzeit`.  
**REQ-TIME-002 (MUSS):** Dauer kann manuell überschrieben werden (Flag „manuell“).  
**REQ-TIME-003 (SOLL):** getrennte Darstellung von Rüst- und Laufanteil.

---

## 6. Ressourcen- und Kalenderlogik

### 6.1 Zeitraster
**REQ-CAL-001 (MUSS):** Planungsraster = **15 Minuten** (Snapping beim Drag & Drop + Speicherung).

### 6.2 Kalenderquellen
- Mitarbeiter-Arbeitszeiten kommen aus ERP.
- Maschinenlaufzeiten können abweichend (z. B. 24/7) abbildbar sein.

**REQ-CAL-010 (MUSS):** Kalender je Ressource (Mitarbeiter / Maschine / Abteilung) mit:
- Arbeitszeiten/Verfügbarkeiten
- Abwesenheiten/Feiertage
- Zeitzone Europe/Berlin (Sommerzeit korrekt)

### 6.3 Maschinenlauf außerhalb Mitarbeiterzeit (Empfehlung)
**REQ-CAL-020 (SOLL):** Phasenmodell pro Operation:
- Phase 1: Rüsten/Start (bindet Mitarbeiter + Maschine)
- Phase 2: Laufzeit (bindet Maschine; Mitarbeiter optional)
- Optional Phase 3: Nacharbeit/Prüfen (bindet Mitarbeiter)

**Alternative (MVP-vereinfachung):**
- **REQ-CAL-021 (MUSS):** Wenn ein ToDo gleichzeitig Maschine+Mitarbeiter bindet und außerhalb Verfügbarkeit liegt, wird ein Kalenderkonflikt angezeigt.

---

## 7. Planung (Gantt/Planboard)

### 7.1 Planungsansichten
**REQ-UI-001 (MUSS):** Gantt nach Ressource (Zeilen: Abteilung → Maschine → Mitarbeiter; filterbar).  
**REQ-UI-002 (MUSS):** Auftragsstrukturansicht (Baum: Auftrag → Position → BOM → Arbeitsgänge) mit Mehrfachauswahl und Übergabe an Gantt.  
**REQ-UI-003 (SOLL):** Auslastungs-/Load-Ansicht pro Tag/Woche.

### 7.2 Interaktionen (Drag & Drop)
**REQ-UI-010 (MUSS):**
- Balken verschieben (Zeit) und (wenn erlaubt) auf andere Ressource ziehen.
- Balkenlänge ändern (wenn manuelle Dauer aktiv).
- Snapping auf 15 Minuten.

**REQ-UI-011 (MUSS):** Überlappungen werden **nicht verhindert**, sondern als Konflikt markiert.

### 7.3 Splitting (Unterbrechen) von ToDos
**REQ-SPL-001 (MUSS):** ToDos dürfen gesplittet werden (z. B. 6h heute + 2h morgen).  
**REQ-SPL-002 (MUSS):** Splits in 15-Minuten-Schritten.  
**REQ-SPL-003 (MUSS):** Segmente sind UI-seitig sichtbar (mehrere Segmente, gleiche ToDo-ID).

### 7.4 Abhängigkeiten & automatisches Mitverschieben
**REQ-DEP-001 (MUSS):** Abhängigkeiten (mind. Finish-to-Start) werden aus Arbeitsplanreihenfolge erzeugt.  
**REQ-DEP-002 (MUSS):** Parallelausführung möglich (Abhängigkeit deaktivierbar bzw. Typ wählbar).  
**REQ-DEP-010 (MUSS):** Beim Verschieben gibt es Option:
- „Abhängige ToDos mitverschieben“ (Standard: aktiv)
- „Nur dieses ToDo verschieben“

---

## 8. Konfliktmanagement (statt harter Verbote)

### 8.1 Konflikttypen (MUSS)
**REQ-CON-001 (MUSS):** Ressourcenkonflikt (Überlappung auf Maschine/Mitarbeiter).  
**REQ-CON-002 (MUSS):** Kalenderkonflikt (außerhalb Verfügbarkeit).  
**REQ-CON-003 (MUSS):** Abhängigkeitskonflikt (Nachfolger startet vor Ende Vorgänger).  
**REQ-CON-004 (MUSS):** Termin-/Lieferkonflikt (Ende nach Liefertermin).  
**REQ-CON-005 (MUSS):** Qualifikationswarnung (Soft, kein Blocker).

### 8.2 Darstellung (MUSS)
**REQ-CON-010 (MUSS):** Konflikte visuell am Balken markieren + zentrale Konfliktliste.  
**REQ-CON-011 (MUSS):** Klick auf Konflikt springt zur betroffenen Stelle im Gantt.

### 8.3 Konfliktauflösung (SOLL)
**REQ-CON-020 (SOLL):** „Automatisch auflösen“ (Heuristik) mit Optionen:
- nur Ressource
- inkl. Abhängigkeiten
- nur nach hinten schieben

---

## 9. Qualifikationsmatrix (Soft-Check)

**REQ-QUAL-001 (MUSS):** Import der Qualifikationsmatrix aus ERP.  
**REQ-QUAL-002 (MUSS):** Bei Mitarbeiterzuweisung wird qualifiziert/nicht qualifiziert angezeigt (Warnung, kein Blocker).  
**REQ-QUAL-003 (SOLL):** Filter „nur qualifizierte Mitarbeiter anzeigen“.

---

## 10. IST-Rückmeldung / Statusableitung aus Zeitbuchungen

### 10.1 Quelle
**REQ-IST-001 (MUSS):** IST-Zustand wird aus **Zeitenbuchungen** der Mitarbeiter abgeleitet.

### 10.2 Mapping
**REQ-IST-010 (MUSS):** Zeitbuchungen müssen einem ToDo zuordenbar sein über mindestens:
- Auftrag + Arbeitsgang (oder eindeutige ERP-Operation-ID)
- optional Mitarbeiter-ID

### 10.3 Statuslogik (MUSS)
**REQ-IST-020 (MUSS):**
- Start erkannt → Status „In Arbeit“, IST-Start setzen
- Stop erkannt → Status „In Arbeit“ oder „Unterbrochen“ (SOLL), IST-Zeit aktualisieren
- Erledigt erkannt → Status „Erledigt“, IST-Ende setzen

**REQ-IST-030 (SOLL):** Soll/Ist Abweichungen (Dauer, Start, Ende) anzeigen.

### 10.4 Endgeräte
**REQ-UX-001 (MUSS):** Responsive UI für PC und Tablet, Touch-Drag&Drop.

---

## 11. Nicht-funktionale Anforderungen

### 11.1 Performance
**REQ-NFR-001 (MUSS):** Gantt performant bei großen Datenmengen (tausende ToDos).  
**REQ-NFR-002 (MUSS):** Lazy Loading / Virtualisierung (nur sichtbarer Zeitraum/Zeilen).  

### 11.2 Mehrbenutzerbetrieb
**REQ-NFR-010 (MUSS):** Parallelbetrieb mehrerer Nutzer; transaktionales Speichern.  
**REQ-NFR-011 (MUSS):** Optimistic Locking (Row-Version) + Hinweis bei Konflikt.

### 11.3 Audit Trail
**REQ-NFR-020 (MUSS):** Planänderungen protokollieren: wer/wann/was (Start/Ende/Ressource/Dauer/Split).  

### 11.4 Sicherheit / Datenschutz
**REQ-NFR-030 (MUSS):** Login + Rollenrechte.  
**REQ-NFR-031 (MUSS):** Zugriff auf Mitarbeiterdaten nach Rolle einschränken.  
**REQ-NFR-032 (MUSS):** Basis-Logging und Backups.

### 11.5 Zeitzonen/Sommerzeit
**REQ-NFR-040 (MUSS):** Europe/Berlin inkl. Sommerzeit korrekt.

---

## 12. Datenhaltung im PPS-Tool (konzeptionell)

**REQ-DB-001 (MUSS):** Eigene Datenhaltung für Planung (Balken/Segmente/Abhängigkeiten), da ERP nicht führend für Planung ist.

### 12.1 Kerntabellen (Beispiel)
- `todo` (Kopf)
- `todo_segment` (Splits: start/end je Segment)
- `todo_dependency` (Vorgänger/Nachfolger)
- `resource_cache` (Maschine/Mitarbeiter/Abteilung – aus ERP gecacht)
- `calendar_cache` / `calendar_exception` (aus ERP importiert + lokale Ergänzungen)
- `audit_log`
- `conflict` (oder on-the-fly berechnet)

### 12.2 ID-Strategie
**REQ-DB-010 (MUSS):** ERP-IDs unverändert speichern + interne IDs; vollständige Traceability.

---

## 13. Abnahmekriterien (Testszenarien)

### AK-01 Raster
Wenn ein Balken verschoben wird, dann liegt Start/Ende immer auf 15-Minuten Raster.

### AK-02 Überlappung anzeigen
Wenn zwei ToDos auf derselben Maschine zeitlich überschneiden:
- beide Balken sind als Konflikt markiert
- Konflikt erscheint in Konfliktliste

### AK-03 Splitting
Ein ToDo mit Dauer 8h kann in zwei Segmente (z. B. 5h + 3h) gesplittet werden.  
Segmente bleiben dem selben ToDo zugeordnet.

### AK-04 Mitverschieben Abhängigkeiten (Default)
Wenn ToDo A Vorgänger von ToDo B ist und A um +2h verschoben wird, dann verschiebt das System B standardmäßig um mindestens +2h, sofern Option aktiv ist.

### AK-05 Kalenderkonflikt Mitarbeiter
Wenn ein ToDo einem Mitarbeiter zugewiesen wird, aber außerhalb seiner ERP-Arbeitszeit liegt, dann wird ein Kalenderkonflikt angezeigt.

### AK-06 IST-Ableitung
Wenn für Auftrag X / Arbeitsgang Y eine Zeitbuchung „Start“ eingeht, dann wird das passende ToDo innerhalb von spätestens X Minuten auf Status „In Arbeit“ gesetzt.

---

## 14. Offene Punkte & Defaults

Diese Punkte sind noch final zu bestätigen; Defaults sind für eine zügige Umsetzung vorgeschlagen:

1) **Planungshorizont**
- Default: **6 Wochen**, UI-konfigurierbar (2–12 Wochen).

2) **Maschine läuft ohne Mitarbeiter**
- Default (SOLL): Phasenmodell (Rüstzeit bindet MA+Maschine; Laufzeit bindet Maschine).

3) **Parallelität von Arbeitsgängen**
- Default: Dependencies aus ERP; Planer kann Abhängigkeit deaktivieren oder Paralleltyp setzen.

4) **Abteilungskapazität**
- Default: Abteilung als Pool (Kapazität konfigurierbar), Maschine/Mitarbeiter Kapazität = 1.

---

*Ende des Dokuments.*
