/**
 * Project Header Component
 */
import React from 'react'
import { Bom, Project } from '../services/types'

interface ProjectHeaderProps {
  project: Project | null
  boms: Bom[]
  selectedBomId: number | null
  onSelectBom: (bomId: number) => void
  onImportSolidworks: () => void
  onCreateBestellartikel: () => void
  onCheckERP: () => void
  onSyncOrders: () => void
  onCreateDocuments: () => void
  onCheckDocuments: () => void
  onPrintPDFQueueMerged: () => void
  onExport: () => void
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  boms,
  selectedBomId,
  onSelectBom,
  onImportSolidworks,
  onCreateBestellartikel,
  onCheckERP,
  onSyncOrders,
  onCreateDocuments,
  onCheckDocuments,
  onPrintPDFQueueMerged,
  onExport
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
            <a href={project.project_path} target="_blank" rel="noopener noreferrer">
              Projektpfad
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
        <button onClick={onImportSolidworks}>Import SOLIDWORKS</button>
        <button onClick={onCreateBestellartikel} style={{ fontWeight: 'bold' }}>
          Bestellartikel erstellen
        </button>
        <button onClick={onCheckERP}>ERP-Abgleich</button>
        <button onClick={onSyncOrders}>Sync ERP</button>
        <button onClick={onCreateDocuments} style={{ fontWeight: 'bold' }}>
          Dokumente erstellen
        </button>
        <button onClick={onCheckDocuments}>Dokumente prüfen</button>
        <button onClick={onPrintPDFQueueMerged} style={{ fontWeight: 'bold' }}>PDF drucken</button>
        <button onClick={onExport}>Export</button>
      </div>
    </div>
  )
}
