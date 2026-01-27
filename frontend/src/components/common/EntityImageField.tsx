/**
 * Entity Image Field
 * 
 * Reusable component for displaying and managing entity images.
 * Shows thumbnail preview, allows upload, and opens original file on click.
 */
import React, { useState, useEffect } from 'react'
import { getEntityImage, uploadEntityImage, deleteEntityImage, getOriginalFileUrl } from '../../services/imageApi'
import ImageUploadDialog from './ImageUploadDialog'

interface EntityImageFieldProps {
  entityType: 'article' | 'bom_item' | 'workstep'
  entityId?: number
  entityReference?: string
  size?: 'small' | 'medium' | 'large'
  width?: number  // Custom width in pixels (overrides size-based width)
  height?: number  // Custom height in pixels (overrides size-based height)
  editable?: boolean
  style?: React.CSSProperties
}

interface ImageData {
  id: number
  thumbnail_base64: string | null
  original_filepath: string
  original_filename: string | null
  file_type: string | null
  thumbnail_width: number | null
  thumbnail_height: number | null
}

const EntityImageField: React.FC<EntityImageFieldProps> = ({
  entityType,
  entityId,
  entityReference,
  size = 'medium',
  width: customWidth,
  height: customHeight,
  editable = true,
  style,
}) => {
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Determine container size - use custom dimensions if provided, else size prop
  const containerSizes = {
    small: { width: 80, height: 80 },
    medium: { width: 150, height: 150 },
    large: { width: 250, height: 250 },
  }
  const baseSize = containerSizes[size]
  const containerSize = {
    width: customWidth || baseSize.width,
    height: customHeight || baseSize.height,
  }

  // Load image on mount and when entity changes
  useEffect(() => {
    const loadImage = async () => {
      if (!entityId && !entityReference) {
        setImageData(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const data = await getEntityImage(entityType, entityId, entityReference)
        setImageData(data)
      } catch (err: any) {
        // 404 is expected when no image exists
        if (err.response?.status !== 404) {
          console.error('Error loading image:', err)
        }
        setImageData(null)
      } finally {
        setLoading(false)
      }
    }

    loadImage()
  }, [entityType, entityId, entityReference])

  const handleUpload = async (filepath: string, thumbnailSize: 'small' | 'medium' | 'large') => {
    const result = await uploadEntityImage({
      entity_type: entityType,
      entity_id: entityId,
      entity_reference: entityReference,
      filepath,
      thumbnail_size: thumbnailSize,
    })

    // Reload image after upload
    if (result) {
      const data = await getEntityImage(entityType, entityId, entityReference)
      setImageData(data)
    }
  }

  const handleDelete = async () => {
    if (!imageData?.id) return
    
    if (!window.confirm('Bild wirklich löschen?')) return

    setDeleting(true)
    try {
      await deleteEntityImage(imageData.id)
      setImageData(null)
    } catch (err: any) {
      setError('Fehler beim Löschen: ' + (err.message || 'Unbekannter Fehler'))
    } finally {
      setDeleting(false)
    }
  }

  const handleImageClick = () => {
    if (!imageData?.original_filepath) return
    
    // Open original file in new tab
    const url = getOriginalFileUrl(imageData.original_filepath)
    window.open(url, '_blank')
  }

  const styles: Record<string, React.CSSProperties> = {
    container: {
      width: containerSize.width,
      height: containerSize.height,
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      backgroundColor: '#f9f9f9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    },
    image: {
      maxWidth: '100%',
      maxHeight: containerSize.height - 40, // Leave room for buttons and filename
      objectFit: 'contain',
      cursor: 'pointer',
    },
    placeholder: {
      fontSize: size === 'small' ? '10px' : '12px',
      color: '#999',
      textAlign: 'center',
      padding: '10px',
    },
    loading: {
      fontSize: '11px',
      color: '#666',
    },
    error: {
      fontSize: '10px',
      color: '#cc0000',
      textAlign: 'center',
      padding: '5px',
    },
    buttonContainer: {
      display: 'flex',
      gap: '4px',
      marginTop: '4px',
      position: 'absolute',
      bottom: '4px',
    },
    button: {
      padding: size === 'small' ? '2px 4px' : '3px 8px',
      fontSize: size === 'small' ? '9px' : '10px',
      border: '1px solid',
      borderRadius: '3px',
      backgroundColor: '#fff',
      cursor: 'pointer',
    },
    uploadButton: {
      borderColor: '#5cb85c',
      color: '#5cb85c',
    },
    changeButton: {
      borderColor: '#4a90d9',
      color: '#4a90d9',
    },
    deleteButton: {
      borderColor: '#d9534f',
      color: '#d9534f',
    },
    hoverOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.05)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0,
      transition: 'opacity 0.2s',
    },
    fileInfo: {
      fontSize: '9px',
      color: '#666',
      marginTop: '2px',
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      padding: '0 4px',
    },
  }

  // No entity reference provided
  if (!entityId && !entityReference) {
    return (
      <div style={styles.container}>
        <span style={styles.placeholder}>
          Kein Artikel verknüpft
        </span>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <span style={styles.loading}>Lade Bild...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <span style={styles.error}>{error}</span>
        {editable && (
          <button
            style={{ ...styles.button, ...styles.uploadButton }}
            onClick={() => setShowUploadDialog(true)}
          >
            Erneut versuchen
          </button>
        )}
        <ImageUploadDialog
          isOpen={showUploadDialog}
          onClose={() => setShowUploadDialog(false)}
          onUpload={handleUpload}
          entityType={entityType}
          entityId={entityId}
          entityReference={entityReference}
        />
      </div>
    )
  }

  // Image exists
  if (imageData?.thumbnail_base64) {
    return (
      <div style={styles.container}>
        <img
          src={`data:image/jpeg;base64,${imageData.thumbnail_base64}`}
          alt={imageData.original_filename || 'Artikelbild'}
          style={styles.image}
          onClick={handleImageClick}
          title="Klicken zum Öffnen der Originaldatei"
        />
        
        {size !== 'small' && imageData.original_filename && (
          <div style={styles.fileInfo} title={imageData.original_filename}>
            {imageData.original_filename}
          </div>
        )}

        {editable && (
          <div style={styles.buttonContainer}>
            <button
              style={{ ...styles.button, ...styles.changeButton }}
              onClick={() => setShowUploadDialog(true)}
              title="Bild ändern"
            >
              Ändern
            </button>
            <button
              style={{ ...styles.button, ...styles.deleteButton }}
              onClick={handleDelete}
              disabled={deleting}
              title="Bild löschen"
            >
              {deleting ? '...' : 'Löschen'}
            </button>
          </div>
        )}

        <ImageUploadDialog
          isOpen={showUploadDialog}
          onClose={() => setShowUploadDialog(false)}
          onUpload={handleUpload}
          entityType={entityType}
          entityId={entityId}
          entityReference={entityReference}
        />
      </div>
    )
  }

  // No image - show upload option
  return (
    <div style={styles.container}>
      <span style={styles.placeholder}>
        Kein Bild
      </span>
      
      {editable && (
        <button
          style={{ ...styles.button, ...styles.uploadButton, marginTop: '8px' }}
          onClick={() => setShowUploadDialog(true)}
        >
          + Bild hochladen
        </button>
      )}

      <ImageUploadDialog
        isOpen={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUpload={handleUpload}
        entityType={entityType}
        entityId={entityId}
        entityReference={entityReference}
      />
    </div>
  )
}

export default EntityImageField
