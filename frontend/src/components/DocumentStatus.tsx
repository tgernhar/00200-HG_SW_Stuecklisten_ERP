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
  const getStyle = () => {
    if (value === 'x' && exists) {
      return { backgroundColor: '#90EE90', color: '#000' } // Grün
    } else if (value === '1') {
      return { backgroundColor: '#FFD700', color: '#000' } // Gelb/Orange
    } else {
      return { backgroundColor: '#FFB6C1', color: '#000' } // Rot
    }
  }

  const getIcon = () => {
    if (value === 'x' && exists) {
      return '✓'
    } else if (value === '1') {
      return '⚠'
    } else {
      return '✗'
    }
  }

  const handleClick = async () => {
    if (!(value === 'x' && exists)) return

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
      onClick={handleClick}
      style={{
        ...getStyle(),
        padding: '2px',
        textAlign: 'center',
        cursor: value === 'x' && exists ? 'pointer' : 'default',
        userSelect: 'none'
      }}
      title={
        value === 'x' && exists
          ? openMode === 'openPdf'
            ? (filePath || 'PDF öffnen')
            : (getDirFromPath(solidworksPath) || solidworksPath || 'Ordner öffnen')
          : ''
      }
    >
      {getIcon()} {value || ''}
    </div>
  )
}
