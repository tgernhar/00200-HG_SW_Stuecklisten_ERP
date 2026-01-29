/**
 * Paperless Upload Dialog Component
 *
 * Dialog for uploading documents to Paperless-ngx with metadata.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  PaperlessDocumentType,
  PaperlessTag,
  PaperlessCorrespondent,
} from '../../services/paperlessTypes';
import {
  uploadDocument,
  getDocumentTypes,
  getTags,
  getCorrespondents,
} from '../../services/paperlessApi';

interface PaperlessUploadDialogProps {
  onClose: () => void;
  onUploadComplete: () => void;
  defaultParams?: Record<string, number | string | undefined>;
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '500px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    backgroundColor: '#32cd32',
    color: 'white',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  content: {
    padding: '16px',
    overflowY: 'auto' as const,
    flex: 1,
  },
  formGroup: {
    marginBottom: '14px',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
    backgroundColor: 'white',
  },
  fileInput: {
    display: 'none',
  },
  fileButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '20px',
    border: '2px dashed #90ee90',
    borderRadius: '8px',
    backgroundColor: '#f0fff0',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '12px',
    color: '#228b22',
  },
  fileButtonHover: {
    borderColor: '#32cd32',
    backgroundColor: '#e6ffe6',
  },
  fileButtonActive: {
    borderColor: '#32cd32',
    backgroundColor: '#d4ffd4',
    borderStyle: 'solid',
  },
  fileName: {
    fontSize: '11px',
    color: '#666',
    marginTop: '8px',
    wordBreak: 'break-all' as const,
  },
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginTop: '6px',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: '1px solid #ccc',
    backgroundColor: '#f5f5f5',
    color: '#333',
  },
  tagSelected: {
    backgroundColor: '#32cd32',
    borderColor: '#228b22',
    color: 'white',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  button: {
    padding: '8px 16px',
    fontSize: '12px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: 'none',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    color: '#333',
  },
  uploadButton: {
    backgroundColor: '#32cd32',
    color: 'white',
  },
  uploadButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  error: {
    backgroundColor: '#fff0f0',
    color: '#cc0000',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '12px',
    marginBottom: '14px',
  },
  success: {
    backgroundColor: '#f0fff0',
    color: '#228b22',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '12px',
    marginBottom: '14px',
  },
  erpInfo: {
    backgroundColor: '#f8f8f8',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '10px',
    fontSize: '11px',
    color: '#666',
    marginBottom: '14px',
  },
  erpInfoItem: {
    marginBottom: '4px',
  },
};

const PaperlessUploadDialog: React.FC<PaperlessUploadDialogProps> = ({
  onClose,
  onUploadComplete,
  defaultParams = {},
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState<number | ''>('');
  const [correspondentId, setCorrespondentId] = useState<number | ''>('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [documentTypes, setDocumentTypes] = useState<PaperlessDocumentType[]>([]);
  const [correspondents, setCorrespondents] = useState<PaperlessCorrespondent[]>([]);
  const [tags, setTags] = useState<PaperlessTag[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load metadata on mount
  useEffect(() => {
    const loadMetadata = async () => {
      setLoading(true);
      try {
        const [types, corrs, tgs] = await Promise.all([
          getDocumentTypes(),
          getCorrespondents(),
          getTags(),
        ]);
        setDocumentTypes(types);
        setCorrespondents(corrs);
        setTags(tgs);
        
        // Auto-select document type if defaultDocumentTypeName is provided
        if (defaultParams.defaultDocumentTypeName && types.length > 0) {
          const defaultType = types.find(
            t => t.name.toLowerCase() === String(defaultParams.defaultDocumentTypeName).toLowerCase()
          );
          if (defaultType) {
            setDocumentTypeId(defaultType.id);
          }
        }
      } catch (err) {
        console.error('Failed to load metadata:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMetadata();
  }, [defaultParams.defaultDocumentTypeName]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    if (!title) {
      // Auto-fill title from filename without extension
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
    setError(null);
    setSuccess(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Bitte wählen Sie eine Datei aus');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadDocument({
        file,
        title: title || file.name,
        document_type_id: documentTypeId || undefined,
        correspondent_id: correspondentId || undefined,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        erp_order_id: defaultParams.erp_order_id as number | undefined,
        erp_order_number: defaultParams.erp_order_number as string | undefined,
        erp_article_id: defaultParams.erp_article_id as number | undefined,
        erp_article_number: defaultParams.erp_article_number as string | undefined,
        erp_order_article_id: defaultParams.erp_order_article_id as number | undefined,
        erp_bom_item_id: defaultParams.erp_bom_item_id as number | undefined,
        erp_operation_id: defaultParams.erp_operation_id as number | undefined,
      });

      if (result.success) {
        setSuccess('Dokument wird verarbeitet...');
        setTimeout(() => {
          onUploadComplete();
        }, 1500);
      } else {
        setError(result.message || 'Upload fehlgeschlagen');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  // Format ERP info for display
  const erpInfoItems = Object.entries(defaultParams)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const labels: Record<string, string> = {
        erp_order_id: 'Auftrags-ID',
        erp_order_number: 'Auftragsnummer',
        erp_article_id: 'Artikel-ID',
        erp_article_number: 'Artikelnummer',
        erp_order_article_id: 'Auftragsartikel-ID',
        erp_bom_item_id: 'BOM-Item-ID',
        erp_operation_id: 'Arbeitsgang-ID',
      };
      return { label: labels[k] || k, value: v };
    });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span>🌿 Dokument zu Paperless hochladen</span>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Error/Success Messages */}
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          {/* ERP Info */}
          {erpInfoItems.length > 0 && (
            <div style={styles.erpInfo}>
              <strong>Verknüpfung mit:</strong>
              {erpInfoItems.map((item, i) => (
                <div key={i} style={styles.erpInfoItem}>
                  {item.label}: {item.value}
                </div>
              ))}
            </div>
          )}

          {/* File Selection */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Datei *</label>
            <input
              ref={fileInputRef}
              type="file"
              style={styles.fileInput}
              onChange={handleFileInputChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv"
            />
            <div
              style={{
                ...styles.fileButton,
                ...(dragOver ? styles.fileButtonHover : {}),
                ...(file ? styles.fileButtonActive : {}),
              }}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {file ? (
                <>
                  <span>📄</span>
                  <span>{file.name}</span>
                  <span style={{ color: '#888' }}>
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </>
              ) : (
                <>
                  <span>📁</span>
                  <span>Datei auswählen oder hierher ziehen</span>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Titel</label>
            <input
              type="text"
              style={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dokumenttitel (optional)"
            />
          </div>

          {/* Document Type */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Dokumenttyp</label>
            <select
              style={styles.select}
              value={documentTypeId}
              onChange={(e) =>
                setDocumentTypeId(e.target.value ? Number(e.target.value) : '')
              }
              disabled={loading}
            >
              <option value="">-- Kein Typ --</option>
              {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Correspondent */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Korrespondent</label>
            <select
              style={styles.select}
              value={correspondentId}
              onChange={(e) =>
                setCorrespondentId(e.target.value ? Number(e.target.value) : '')
              }
              disabled={loading}
            >
              <option value="">-- Kein Korrespondent --</option>
              {correspondents.map((corr) => (
                <option key={corr.id} value={corr.id}>
                  {corr.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Tags</label>
              <div style={styles.tagContainer}>
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    style={{
                      ...styles.tag,
                      ...(selectedTagIds.includes(tag.id) ? styles.tagSelected : {}),
                      ...(tag.color && !selectedTagIds.includes(tag.id)
                        ? { borderColor: tag.color }
                        : {}),
                    }}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.cancelButton }}
            onClick={onClose}
            disabled={uploading}
          >
            Abbrechen
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.uploadButton,
              ...(!file || uploading ? styles.uploadButtonDisabled : {}),
            }}
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? 'Wird hochgeladen...' : '⬆️ Hochladen'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaperlessUploadDialog;
