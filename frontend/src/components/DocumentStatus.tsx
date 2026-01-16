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
  const isOk = value === 'x' && exists
  const isCreate = value === '1'

  const getStyle = () => {
    if (isOk) {
      return { backgroundColor: '#90EE90', color: '#000' } // Grün
    } else if (isCreate) {
      return { backgroundColor: '#FFD700', color: '#000' } // Gelb/Orange
    } else {
      return { backgroundColor: '#FFB6C1', color: '#000' } // Rot
    }
  }

  const getIcon = () => {
    if (isOk) {
      return '✓'
    } else if (isCreate) {
      return '⚠'
    } else {
      return '✗'
    }
  }

  const handleClick = async () => {
    if (!isOk) return

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
        cursor: isOk ? 'pointer' : 'default',
        userSelect: 'none'
      }}
      title={
        isOk
          ? openMode === 'openPdf'
            ? (filePath || 'PDF öffnen')
            : (getDirFromPath(solidworksPath) || solidworksPath || 'Ordner öffnen')
          : ''
      }
    >
      {(() => {
        const icon = getIcon()
        const text = isCreate ? '1' : '' // nie "x" neben dem grünen Haken anzeigen

        // #region agent log
        if (isOk || isCreate) {
          fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'frontend/src/components/DocumentStatus.tsx:render',message:'doc status render',data:{value,exists,isOk,isCreate,icon,text},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'L1'})}).catch(()=>{});
        }
        // #endregion agent log

        return (
          <>
            {icon}
            {text ? ` ${text}` : ''}
          </>
        )
      })()}
    </div>
  )
}
