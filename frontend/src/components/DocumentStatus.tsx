/**
 * Document Status Cell Renderer
 */
import React from 'react'

interface DocumentStatusProps {
  value?: string
  exists?: boolean
  filePath?: string
  openMode?: 'openPdf' | 'openSwDir'
  solidworksPath?: string
  apiBaseUrl?: string
}

function getDirFromPath(p?: string): string | undefined {
  if (!p) return undefined
  const normalized = p.replace(/\//g, '\\')
  const idx = normalized.lastIndexOf('\\')
  if (idx <= 0) return undefined
  return normalized.slice(0, idx)
}

function toFileUrl(path: string): string {
  // Best effort: file URLs are often blocked by browser policies.
  const normalized = path.replace(/\\/g, '/')
  return `file:///${encodeURI(normalized)}`
}

async function fallbackCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    alert(`Pfad kopiert:\n${text}`)
  } catch {
    alert(`Pfad:\n${text}`)
  }
}

export const DocumentStatusRenderer: React.FC<DocumentStatusProps> = ({ value, exists, filePath, openMode, solidworksPath, apiBaseUrl }) => {
  const isCreate = value === '1'
  const isPresent = !!exists && !isCreate

  // UX:
  // - "1" (gelb): Dokument erstellen
  // - "x" (grün): Dokument vorhanden
  // - "-" (rot): Dokument fehlt
  const displayText = isCreate ? '1' : isPresent ? 'x' : '-'

  const getStyle = () => {
    if (isCreate) {
      return { backgroundColor: '#FFD700', color: '#000' } // Gelb/Orange
    } else if (isPresent) {
      return { backgroundColor: '#90EE90', color: '#000' } // Grün
    } else {
      return { backgroundColor: '#FFB6C1', color: '#000' } // Rot
    }
  }

  const handleOpen = async () => {
    // Allow open only when document exists (green).
    if (!exists) return

    // PDFs: open the file directly
    if (openMode === 'openPdf') {
      if (filePath) {
        const apiBase = (typeof apiBaseUrl === 'string' && apiBaseUrl.length > 0) ? apiBaseUrl : ''
        const openUrl = `${apiBase}/documents/open-pdf?path=${encodeURIComponent(filePath)}`
        const win = window.open(openUrl, '_blank')
        // Fallback: in manchen Browsern sind Popups blockiert → dann im selben Tab öffnen (statt Pfad kopieren)
        if (!win) window.location.assign(openUrl)
      }
      return
    }

    // Non-PDFs: open SOLIDWORKS folder (all documents are located there)
    const dir = getDirFromPath(solidworksPath)
    if (dir) {
      const win = window.open(toFileUrl(dir), '_blank')
      if (!win) await fallbackCopy(dir)
      return
    }

    if (solidworksPath) await fallbackCopy(solidworksPath)
  }

  return (
    <div
      onMouseDown={(e) => {
        // Keep cells editable: normal click should edit; open via modifier click.
        const modifier = (e.altKey || e.ctrlKey || e.metaKey) && !!exists
        if (!modifier) return
        e.preventDefault()
        e.stopPropagation()
        handleOpen()
      }}
      style={{
        ...getStyle(),
        padding: '0px',
        fontSize: '12px',
        lineHeight: '13px',
        textAlign: 'center',
        cursor: 'default',
        userSelect: 'none'
      }}
      title={
        exists
          ? openMode === 'openPdf'
            ? `${filePath || 'PDF öffnen'}\nAlt+Klick (oder Strg+Klick) zum Öffnen`
            : `${getDirFromPath(solidworksPath) || solidworksPath || 'Ordner öffnen'}\nAlt+Klick (oder Strg+Klick) zum Öffnen`
          : ''
      }
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Keep cell editable: open via small hotspot icon on the right edge. */}
        {exists ? (
          <span
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleOpen()
            }}
            title={exists ? 'Öffnen' : ''}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 12,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              lineHeight: '10px',
              cursor: 'pointer'
            }}
          >
            ↗
          </span>
        ) : null}
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {displayText}
        </div>
      </div>
    </div>
  )
}
