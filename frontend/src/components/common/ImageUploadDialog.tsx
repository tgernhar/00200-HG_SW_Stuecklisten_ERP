/**
 * Image Upload Dialog
 * 
 * Modal dialog for uploading images to entities (articles, BOM items, worksteps).
 * Supports file path input via copy/paste or drag & drop with path combination.
 */
import React, { useState } from 'react'

interface ImageUploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (filepath: string, thumbnailSize: 'small' | 'medium' | 'large') => Promise<void>
  entityType: string
  entityId?: number
  entityReference?: string
  basePath?: string  // Base folder path from database (e.g., order_article_path)
}

const ImageUploadDialog: React.FC<ImageUploadDialogProps> = ({
  isOpen,
  onClose,
  onUpload,
  entityType,
  entityId,
  entityReference,
  basePath,
}) => {
  const [filepath, setFilepath] = useState('')
  const [thumbnailSize, setThumbnailSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  if (!isOpen) return null

  // Handle drag & drop - combine basePath with dropped filename
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!uploading) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (uploading) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      const filename = file.name

      // Validate file extension
      const ext = filename.toLowerCase().split('.').pop()
      const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']
      if (!ext || !validExtensions.includes(ext)) {
        setError(`Ungültiger Dateityp: ${filename}. Unterstützt: ${validExtensions.join(', ').toUpperCase()}`)
        return
      }

      if (basePath) {
        // Combine basePath with filename
        // Ensure basePath ends with a separator
        let fullPath = basePath
        if (!fullPath.endsWith('\\') && !fullPath.endsWith('/')) {
          fullPath += '\\'
        }
        fullPath += filename
        setFilepath(fullPath)
        setError(null)
      } else {
        // No basePath available - just show the filename
        setFilepath(filename)
        setError('Kein Basispfad verfügbar. Bitte vollständigen Pfad manuell eingeben.')
      }
    }
  }

  const handleUpload = async () => {
    if (!filepath.trim()) {
      setError('Bitte geben Sie einen Dateipfad ein')
      return
    }

    // Validate file extension
    const ext = filepath.toLowerCase().split('.').pop()
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']
    if (!ext || !validExtensions.includes(ext)) {
      setError(`Ungültiger Dateityp. Unterstützt: ${validExtensions.join(', ').toUpperCase()}`)
      return
    }

    setUploading(true)
    setError(null)

    try {
      await onUpload(filepath.trim(), thumbnailSize)
      setFilepath('')
      onClose()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Hochladen des Bildes')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setFilepath('')
      setError(null)
      onClose()
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    },
    dialog: {
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      width: '500px',
      maxWidth: '90vw',
    },
    header: {
      backgroundColor: '#ff9900',
      color: '#fff',
      padding: '12px 16px',
      borderRadius: '8px 8px 0 0',
      fontWeight: 'bold',
      fontSize: '14px',
    },
    content: {
      padding: '20px',
    },
    formGroup: {
      marginBottom: '16px',
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      fontWeight: '500',
      fontSize: '13px',
      color: '#333',
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '13px',
      boxSizing: 'border-box' as const,
    },
    select: {
      width: '100%',
      padding: '10px 12px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '13px',
      backgroundColor: '#fff',
    },
    hint: {
      fontSize: '11px',
      color: '#666',
      marginTop: '4px',
    },
    error: {
      backgroundColor: '#fff3f3',
      border: '1px solid #ffcccc',
      color: '#cc0000',
      padding: '10px',
      borderRadius: '4px',
      fontSize: '12px',
      marginBottom: '16px',
    },
    footer: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      padding: '16px 20px',
      borderTop: '1px solid #e0e0e0',
    },
    button: {
      padding: '10px 20px',
      borderRadius: '4px',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      border: 'none',
    },
    buttonPrimary: {
      backgroundColor: '#ff9900',
      color: '#fff',
    },
    buttonSecondary: {
      backgroundColor: '#f0f0f0',
      color: '#333',
      border: '1px solid #ccc',
    },
    buttonDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
    infoBox: {
      backgroundColor: '#f5f5f5',
      padding: '10px',
      borderRadius: '4px',
      fontSize: '12px',
      color: '#666',
      marginBottom: '16px',
    },
    dropZone: {
      border: '2px dashed #ccc',
      borderRadius: '8px',
      padding: '20px',
      textAlign: 'center' as const,
      marginBottom: '16px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      backgroundColor: '#fafafa',
    },
    dropZoneActive: {
      border: '2px dashed #ff9900',
      backgroundColor: '#fff8e6',
    },
    dropZoneDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    dropZoneIcon: {
      fontSize: '32px',
      marginBottom: '8px',
    },
    dropZoneText: {
      fontSize: '13px',
      color: '#666',
      marginBottom: '4px',
    },
    dropZoneHint: {
      fontSize: '11px',
      color: '#999',
    },
    basePathInfo: {
      backgroundColor: '#e8f4e8',
      border: '1px solid #c8e6c8',
      padding: '8px 10px',
      borderRadius: '4px',
      fontSize: '11px',
      color: '#2e7d32',
      marginBottom: '12px',
      wordBreak: 'break-all' as const,
    },
  }

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          Bild hochladen
        </div>

        <div style={styles.content}>
          <div style={styles.infoBox}>
            <strong>Entity:</strong> {entityType} {entityId ? `(ID: ${entityId})` : ''} {entityReference ? `(${entityReference})` : ''}
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {/* Drag & Drop Zone - only shown when basePath is available */}
          {basePath && (
            <>
              <div style={styles.basePathInfo}>
                <strong>Basispfad:</strong> {basePath}
              </div>
              <div
                style={{
                  ...styles.dropZone,
                  ...(isDragOver ? styles.dropZoneActive : {}),
                  ...(uploading ? styles.dropZoneDisabled : {}),
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div style={styles.dropZoneIcon}>📁</div>
                <div style={styles.dropZoneText}>
                  {isDragOver ? 'Datei hier ablegen...' : 'Datei hierher ziehen'}
                </div>
                <div style={styles.dropZoneHint}>
                  Der Dateiname wird mit dem Basispfad kombiniert
                </div>
              </div>
            </>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>Dateipfad</label>
            <input
              type="text"
              value={filepath}
              onChange={e => setFilepath(e.target.value)}
              placeholder={basePath ? "Pfad wird bei Drag & Drop automatisch ausgefüllt" : "Z.B. G:\\Arbeitsunterlagen\\Bilder\\artikel.pdf"}
              style={styles.input}
              disabled={uploading}
            />
            <div style={styles.hint}>
              {basePath 
                ? 'Datei per Drag & Drop ablegen oder Pfad manuell eingeben/einfügen.'
                : 'Vollständigen Pfad zur Datei eingeben oder per Copy/Paste einfügen.'
              }
              {' '}Unterstützte Formate: PDF, PNG, JPG, GIF, WebP
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Vorschaubild-Größe</label>
            <select
              value={thumbnailSize}
              onChange={e => setThumbnailSize(e.target.value as 'small' | 'medium' | 'large')}
              style={styles.select}
              disabled={uploading}
            >
              <option value="small">Klein (150x150px) - für Listenansichten</option>
              <option value="medium">Mittel (300x300px) - Standard</option>
              <option value="large">Groß (600x600px) - für Druckvorschau</option>
            </select>
            <div style={styles.hint}>
              Größere Vorschaubilder benötigen mehr Speicherplatz in der Datenbank.
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.buttonSecondary }}
            onClick={handleClose}
            disabled={uploading}
          >
            Abbrechen
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.buttonPrimary,
              ...(uploading ? styles.buttonDisabled : {}),
            }}
            onClick={handleUpload}
            disabled={uploading || !filepath.trim()}
          >
            {uploading ? 'Wird hochgeladen...' : 'Hochladen'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImageUploadDialog
