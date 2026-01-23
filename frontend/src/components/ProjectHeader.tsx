/**
 * Project Header Component
 */
import React from 'react'
import { Bom, Project } from '../services/types'

interface ProjectHeaderProps {
  project: Project | null
  boms: Bom[]
  selectedBomId: number | null
  isImporting: boolean
  isCheckingDocuments: boolean
  isCreatingDocuments: boolean
  isLoadingArticles?: boolean
  onSelectBom: (bomId: number) => void
  onImportSolidworks: () => void
  onCreateBestellartikel: () => void
  onCheckERP: () => void
  onLoadArticles?: () => void
  onSyncOrders: () => void
  onCreateDocuments: () => void
  onCheckDocuments: () => void
  onPrintPDFQueueMerged: () => void
  onExport: () => void
  onGoHome: () => void
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  boms,
  selectedBomId,
  isImporting,
  isCheckingDocuments,
  isCreatingDocuments,
  isLoadingArticles,
  onSelectBom,
  onImportSolidworks,
  onCreateBestellartikel,
  onCheckERP,
  onLoadArticles,
  onSyncOrders,
  onCreateDocuments,
  onCheckDocuments,
  onPrintPDFQueueMerged,
  onExport,
  onGoHome
}) => {
  if (!project) {
    return <div>Kein Projekt ausgewählt</div>
  }

  return (
    <div style={{ padding: '20px', borderBottom: '1px solid #ccc', backgroundColor: '#f5f5f5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <strong>AU-NR:</strong> {project.au_nr}
        </div>
        <div>
          {project.project_path && (
            <a
              href={project.project_path.replace(/[/\\][^/\\]+$/, '')}
              target="_blank"
              rel="noopener noreferrer"
            >
              Projektordner
            </a>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <strong>Stückliste:</strong>
        <select
          value={selectedBomId ?? ''}
          onChange={(e) => onSelectBom(Number(e.target.value))}
          disabled={!boms?.length}
        >
          {(boms || []).map((b) => {
            const label = b.hugwawi_articlenumber
              ? `${b.hugwawi_articlenumber} (OrderArticleId ${b.hugwawi_order_article_id})`
              : `Legacy-BOM ${b.id}`
            return (
              <option key={b.id} value={b.id}>
                {label}
              </option>
            )
          })}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={onGoHome}
          title="Zurück zur Projektübersicht"
        >
          Zur Startseite
        </button>
        <button 
          onClick={onImportSolidworks} 
          disabled={isImporting}
          title="Importiert die Stückliste aus einer SOLIDWORKS Baugruppe. Die Baugruppe muss in SOLIDWORKS geöffnet sein."
        >
          {isImporting ? 'Import läuft...' : 'Import SOLIDWORKS'}
        </button>
        <button 
          onClick={onCreateBestellartikel} 
          style={{ fontWeight: 'bold' }}
          title="Erstellt einen neuen Bestellartikel als Unterposition zum ausgewählten Artikel"
        >
          Bestellartikel erstellen
        </button>
        <button 
          onClick={onCheckERP}
          title="Prüft alle Artikelnummern gegen die HUGWAWI-Datenbank und markiert ob sie dort existieren"
        >
          Artikel-Sync
        </button>
        <button 
          onClick={onLoadArticles} 
          disabled={isLoadingArticles} 
          style={{ fontWeight: 'bold' }}
          title="Lädt Custom Properties aus HUGWAWI, zeigt Differenzen an, füllt leere Felder automatisch und sucht erweiterte Artikel (mit _ Suffix)"
        >
          {isLoadingArticles ? 'Laden...' : 'Artikel laden'}
        </button>
        <button 
          onClick={onSyncOrders}
          title="Synchronisiert Bestellnummern und Bestellpositionen mit der HUGWAWI-Datenbank"
        >
          BN-Sync
        </button>
        <button 
          onClick={onCreateDocuments} 
          style={{ fontWeight: 'bold' }} 
          disabled={isCreatingDocuments}
          title="Erstellt PDF-Zeichnungen und STEP-Dateien für alle markierten Artikel über SOLIDWORKS"
        >
          {isCreatingDocuments ? 'Dokumente erstellen...' : 'Dokumente erstellen'}
        </button>
        <button 
          onClick={onCheckDocuments} 
          disabled={isCheckingDocuments}
          title="Prüft ob PDF-Zeichnungen und STEP-Dateien für alle Artikel vorhanden sind"
        >
          {isCheckingDocuments ? 'Dokumente prüfen...' : 'Dokumente prüfen'}
        </button>
        <button 
          onClick={onPrintPDFQueueMerged} 
          style={{ fontWeight: 'bold' }}
          title="Erstellt eine zusammengefasste PDF-Datei aus allen Zeichnungen der Stückliste zum Drucken"
        >
          PDF drucken
        </button>
        <button 
          onClick={onExport}
          title="Exportiert alle Artikel die noch nicht in HUGWAWI existieren als CSV-Datei für den Import ins ERP-System"
        >
          ERP-Artikel-Export
        </button>
      </div>
    </div>
  )
}
