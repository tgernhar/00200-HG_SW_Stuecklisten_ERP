/**
 * Image Upload Dialog
 * 
 * Modal dialog for uploading images to entities (articles, BOM items, worksteps).
 * Supports file path input via copy/paste or file selection.
 */
import React, { useState } from 'react'

interface ImageUploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (filepath: string, thumbnailSize: 'small' | 'medium' | 'large') => Promise<void>
  entityType: string
  entityId?: number
  entityReference?: string
}

const ImageUploadDialog: React.FC<ImageUploadDialogProps> = ({
  isOpen,
  onClose,
  onUpload,
  entityType,
  entityId,
  entityReference,
}) => {
  const [filepath, setFilepath] = useState('')
  const [thumbnailSize, setThumbnailSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

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

          <div style={styles.formGroup}>
            <label style={styles.label}>Dateipfad</label>
            <input
              type="text"
              value={filepath}
              onChange={e => setFilepath(e.target.value)}
              placeholder="Z.B. G:\Arbeitsunterlagen\Bilder\artikel.pdf"
              style={styles.input}
              disabled={uploading}
            />
            <div style={styles.hint}>
              Vollständigen Pfad zur Datei eingeben oder per Copy/Paste einfügen.
              Unterstützte Formate: PDF, PNG, JPG, GIF, WebP
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
