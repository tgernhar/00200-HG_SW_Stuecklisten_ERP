# Changelog

## [1.0.0] - 2024-01-01

### Initial Release

#### Backend
- FastAPI Backend mit vollständiger API
- MySQL-Datenbank mit SQLAlchemy Models
- Alembic für Datenbank-Migrationen
- ERP-Integration (MySQL-Verbindung)
- Dokumentenverwaltung
- PDF-Druck-Funktionalität

#### Frontend
- React 18 + TypeScript
- AG Grid für Excel-ähnliche Tabelle
- Projekt-Header mit Toolbar
- Custom Cell Renderer für Dokumentstatus
- ERP-Abgleich mit Farbcodierung

#### SOLIDWORKS-Connector
- Windows Service für SOLIDWORKS COM API
- Assembly-Reader für Teile und Properties
- 3D-Dokument-Generierung (STEP, X_T, STL)

#### Features
- SOLIDWORKS-Assembly Import
- Artikelnummer-Prüfung gegen ERP
- Batch-Dokumentgenerierung
- Batch-PDF-Druck
- Inline-Editing in Tabelle
- Horizontales Scrolling
- Gedrehte Header für Dokumentstatus-Spalten
