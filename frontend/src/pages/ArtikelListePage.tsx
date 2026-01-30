/**
 * Artikel Liste Page
 * Such- und Auflistungsseite für Artikel aus HUGWAWI.
 * Supports split view with article details.
 */
import React, { useState } from 'react'
import ArtikelDataTable from '../components/artikel/ArtikelDataTable'
import ArtikelDetailView from '../components/artikel/ArtikelDetailView'

type ViewMode = 'table' | 'split' | 'fullscreen'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  },
  tablePanel: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  tablePanelSplit: {
    flex: '0 0 50%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #ddd',
  },
  detailPanel: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  detailPanelSplit: {
    flex: '0 0 50%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}

export default function ArtikelListePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null)

  const handleArticleSelect = (articleId: number) => {
    setSelectedArticleId(articleId)
    setViewMode('split')
  }

  const handleCloseDetail = () => {
    setSelectedArticleId(null)
    setViewMode('table')
  }

  const handleToggleFullscreen = () => {
    setViewMode(prev => prev === 'fullscreen' ? 'split' : 'fullscreen')
  }

  // Fullscreen mode: only show detail view
  if (viewMode === 'fullscreen' && selectedArticleId) {
    return (
      <div style={styles.container}>
        <div style={styles.detailPanel}>
          <ArtikelDetailView
            articleId={selectedArticleId}
            onClose={handleCloseDetail}
            onToggleFullscreen={handleToggleFullscreen}
            isFullscreen={true}
          />
        </div>
      </div>
    )
  }

  // Split mode: table on left, detail on right
  if (viewMode === 'split' && selectedArticleId) {
    return (
      <div style={styles.container}>
        <div style={styles.tablePanelSplit}>
          <ArtikelDataTable
            mode="articles"
            pageTitle="Artikel Liste"
            onArticleSelect={handleArticleSelect}
            selectedArticleId={selectedArticleId}
          />
        </div>
        <div style={styles.detailPanelSplit}>
          <ArtikelDetailView
            articleId={selectedArticleId}
            onClose={handleCloseDetail}
            onToggleFullscreen={handleToggleFullscreen}
            isFullscreen={false}
          />
        </div>
      </div>
    )
  }

  // Table mode: only show table
  return (
    <div style={styles.container}>
      <div style={styles.tablePanel}>
        <ArtikelDataTable
          mode="articles"
          pageTitle="Artikel Liste"
          onArticleSelect={handleArticleSelect}
        />
      </div>
    </div>
  )
}
