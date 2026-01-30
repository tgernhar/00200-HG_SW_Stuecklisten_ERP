/**
 * Paperless Documents Panel Component
 *
 * Displays documents from Paperless-ngx linked to various ERP entities.
 * Supports document upload and viewing with multiple view modes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  PaperlessDocument,
  PaperlessDocumentListResponse,
  PaperlessEntityType,
} from '../../services/paperlessTypes';
import {
  getOrderDocuments,
  getArticleDocuments,
  getOrderArticleDocuments,
  getBomItemDocuments,
  getOperationDocuments,
  getFileIcon,
  formatDate,
} from '../../services/paperlessApi';
import PaperlessUploadDialog from './PaperlessUploadDialog';

// View modes like Paperless-ngx frontend
type ViewMode = 'list' | 'small-icons' | 'preview';

interface PaperlessDocumentsPanelProps {
  /** Entity type to fetch documents for */
  entityType: PaperlessEntityType;
  /** Entity ID */
  entityId: number;
  /** Additional entity info for upload context */
  entityNumber?: string;
  /** Panel title (optional) */
  title?: string;
  /** Show as collapsed by default */
  defaultCollapsed?: boolean;
  /** Max height for scrollable area */
  maxHeight?: number;
  /** Callback when a document is clicked */
  onDocumentClick?: (doc: PaperlessDocument) => void;
  /** Default document type name to preselect in upload dialog */
  defaultDocumentTypeName?: string;
}

const styles = {
  container: {
    marginTop: '8px',
    marginBottom: '8px',
    backgroundColor: '#f0fff0',
    border: '1px solid #90ee90',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#e6ffe6',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#228b22',
    borderBottom: '1px solid #90ee90',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    backgroundColor: '#32cd32',
    color: 'white',
    borderRadius: '10px',
    padding: '1px 6px',
    fontSize: '10px',
    fontWeight: 'bold' as const,
  },
  headerActions: {
    display: 'flex',
    gap: '4px',
  },
  content: {
    maxHeight: '300px',
    overflowY: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px',
  },
  th: {
    padding: '6px 8px',
    textAlign: 'left' as const,
    backgroundColor: '#f5fff5',
    borderBottom: '1px solid #90ee90',
    fontWeight: 'bold' as const,
    color: '#228b22',
    position: 'sticky' as const,
    top: 0,
  },
  td: {
    padding: '5px 8px',
    borderBottom: '1px solid #e6ffe6',
    color: '#333333',
    verticalAlign: 'middle' as const,
  },
  row: {
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  rowHover: {
    backgroundColor: '#e0ffe0',
  },
  fileIcon: {
    fontSize: '14px',
    marginRight: '6px',
  },
  filename: {
    fontWeight: 500 as const,
    color: '#333',
  },
  tag: {
    display: 'inline-block',
    backgroundColor: '#98fb98',
    color: '#006400',
    borderRadius: '3px',
    padding: '1px 4px',
    fontSize: '9px',
    marginLeft: '4px',
  },
  typeBadge: {
    display: 'inline-block',
    backgroundColor: '#d4edda',
    color: '#155724',
    borderRadius: '3px',
    padding: '1px 5px',
    fontSize: '9px',
  },
  actionButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    fontSize: '12px',
    color: '#228b22',
    borderRadius: '3px',
    transition: 'background-color 0.15s',
  },
  uploadButton: {
    backgroundColor: '#32cd32',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    padding: '3px 8px',
    fontSize: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  loading: {
    padding: '15px',
    textAlign: 'center' as const,
    color: '#228b22',
    fontSize: '11px',
  },
  empty: {
    padding: '15px',
    textAlign: 'center' as const,
    color: '#999999',
    fontSize: '11px',
    fontStyle: 'italic' as const,
  },
  error: {
    padding: '10px',
    color: '#cc0000',
    fontSize: '11px',
    backgroundColor: '#fff0f0',
    borderRadius: '4px',
    margin: '8px',
  },
  expandIcon: {
    fontSize: '10px',
    marginRight: '4px',
  },
  thumbnail: {
    width: '32px',
    height: '32px',
    objectFit: 'cover' as const,
    borderRadius: '2px',
    backgroundColor: '#f0f0f0',
  },
  // Split view styles
  splitContainer: {
    display: 'flex',
    gap: '8px',
  },
  listPane: {
    flex: '1',
    minWidth: '300px',
    maxHeight: '400px',
    overflowY: 'auto' as const,
  },
  previewPane: {
    flex: '1',
    minWidth: '300px',
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid #90ee90',
    borderRadius: '4px',
    backgroundColor: '#fafff9',
    overflow: 'hidden',
  },
  previewHeader: {
    padding: '8px 12px',
    backgroundColor: '#e6ffe6',
    borderBottom: '1px solid #90ee90',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#228b22',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    minHeight: '350px',
  },
  previewIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    minHeight: '350px',
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '350px',
    objectFit: 'contain' as const,
  },
  previewPlaceholder: {
    color: '#999',
    fontSize: '12px',
    textAlign: 'center' as const,
    padding: '20px',
  },
  previewActions: {
    display: 'flex',
    gap: '8px',
  },
  selectedRow: {
    backgroundColor: '#d4edda',
    borderLeft: '3px solid #28a745',
  },
  // View mode switcher
  viewModeSwitcher: {
    display: 'flex',
    gap: '2px',
    marginRight: '8px',
  },
  viewModeButton: {
    background: 'none',
    border: '1px solid #90ee90',
    borderRadius: '3px',
    padding: '3px 6px',
    fontSize: '11px',
    cursor: 'pointer',
    color: '#228b22',
    transition: 'all 0.15s',
  },
  viewModeButtonActive: {
    backgroundColor: '#32cd32',
    color: 'white',
    borderColor: '#32cd32',
  },
  // Small icons grid
  smallIconsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '8px',
    padding: '8px',
  },
  smallIconCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    textAlign: 'center' as const,
  },
  smallIconCardHover: {
    backgroundColor: '#e0ffe0',
  },
  smallIconCardSelected: {
    backgroundColor: '#d4edda',
    border: '2px solid #28a745',
  },
  smallIconThumbnail: {
    width: '48px',
    height: '48px',
    objectFit: 'cover' as const,
    borderRadius: '4px',
    backgroundColor: '#f0f0f0',
    marginBottom: '4px',
  },
  smallIconTitle: {
    fontSize: '9px',
    color: '#333',
    wordBreak: 'break-word' as const,
    maxWidth: '70px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  },
  // Preview cards grid
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
    padding: '12px',
  },
  previewCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid #ddd',
    borderRadius: '6px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.15s',
    backgroundColor: 'white',
  },
  previewCardHover: {
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    borderColor: '#90ee90',
  },
  previewCardSelected: {
    border: '2px solid #28a745',
    boxShadow: '0 2px 8px rgba(40,167,69,0.3)',
  },
  previewCardThumbnail: {
    width: '100%',
    height: '120px',
    objectFit: 'cover' as const,
    backgroundColor: '#f5f5f5',
  },
  previewCardThumbnailPlaceholder: {
    width: '100%',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    fontSize: '48px',
  },
  previewCardBody: {
    padding: '10px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  previewCardTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  previewCardMeta: {
    fontSize: '10px',
    color: '#666',
    marginBottom: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewCardContent: {
    fontSize: '10px',
    color: '#888',
    lineHeight: 1.4,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const,
    flex: 1,
  },
  previewCardActions: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px',
    borderTop: '1px solid #eee',
    paddingTop: '8px',
  },
  // Full content area styles
  contentArea: {
    maxHeight: '450px',
    overflowY: 'auto' as const,
  },
};

const entityTitles: Record<PaperlessEntityType, string> = {
  order: 'Paperless Dokumente (Auftrag)',
  article: 'Paperless Dokumente (Artikel)',
  order_article: 'Paperless Dokumente (Auftragsartikel)',
  bom_item: 'Paperless Dokumente (Stückliste)',
  operation: 'Paperless Dokumente (Arbeitsgang)',
};

const PaperlessDocumentsPanel: React.FC<PaperlessDocumentsPanelProps> = ({
  entityType,
  entityId,
  entityNumber,
  title,
  defaultCollapsed = true,
  maxHeight = 300,
  onDocumentClick,
  defaultDocumentTypeName,
}) => {
  const [documents, setDocuments] = useState<PaperlessDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<PaperlessDocument | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Fetch documents based on entity type
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let response: PaperlessDocumentListResponse;

      switch (entityType) {
        case 'order':
          response = await getOrderDocuments(entityId);
          break;
        case 'article':
          response = await getArticleDocuments(entityId);
          break;
        case 'order_article':
          response = await getOrderArticleDocuments(entityId);
          break;
        case 'bom_item':
          response = await getBomItemDocuments(entityId);
          break;
        case 'operation':
          response = await getOperationDocuments(entityId);
          break;
        default:
          throw new Error(`Unbekannter Entity-Typ: ${entityType}`);
      }

      setDocuments(response.items);
    } catch (err) {
      console.error('Paperless fetch error:', err);
      // Don't show error if just not connected
      if (err instanceof Error && err.message.includes('401')) {
        setError('Nicht authentifiziert');
      } else {
        setError('Paperless nicht verfügbar');
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (!collapsed) {
      fetchDocuments();
    }
  }, [fetchDocuments, collapsed]);

  // Handle header click to toggle collapse
  const handleHeaderClick = () => {
    setCollapsed(!collapsed);
  };

  // Handle document row click - show preview
  const handleRowClick = (doc: PaperlessDocument) => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H1-H4',location:'PaperlessDocumentsPanel:handleRowClick',message:'doc clicked',data:{docId:doc.id,download_url:doc.download_url,original_download_url:doc.original_download_url,thumbnail_url:doc.thumbnail_url,fileName:doc.original_file_name,hasContent:!!doc.content},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
    // #endregion
    if (onDocumentClick) {
      onDocumentClick(doc);
    } else {
      // Toggle selection or select new document
      setSelectedDoc(selectedDoc?.id === doc.id ? null : doc);
    }
  };

  // Check if file is previewable (PDF or image)
  const isPreviewable = (fileName: string | null): boolean => {
    if (!fileName) return false;
    const ext = fileName.toLowerCase().split('.').pop();
    return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext || '');
  };

  // Check if file is an image
  const isImage = (fileName: string | null): boolean => {
    if (!fileName) return false;
    const ext = fileName.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext || '');
  };

  // Check if file is an email
  const isEmail = (fileName: string | null): boolean => {
    if (!fileName) return false;
    return fileName.toLowerCase().endsWith('.eml');
  };

  // Get auth token for proxy URLs (iframes/images can't send headers)
  const getAuthToken = (): string => {
    return localStorage.getItem('auth_token') || '';
  };

  // Add token to proxy URL for iframe/img use
  const addTokenToUrl = (url: string | null): string => {
    if (!url) return '';
    const token = getAuthToken();
    return token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;
  };

  // Truncate content for preview
  const truncateContent = (content: string | null, maxLength: number = 150): string => {
    if (!content) return '';
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength) + '...';
  };

  // Handle upload complete
  const handleUploadComplete = () => {
    setShowUploadDialog(false);
    fetchDocuments();
  };

  const displayTitle = title || entityTitles[entityType];

  // Build upload params based on entity type
  const getUploadParams = () => {
    const params: Record<string, number | string | undefined> = {};

    switch (entityType) {
      case 'order':
        params.erp_order_id = entityId;
        params.erp_order_number = entityNumber;
        break;
      case 'article':
        params.erp_article_id = entityId;
        params.erp_article_number = entityNumber;
        break;
      case 'order_article':
        params.erp_order_article_id = entityId;
        break;
      case 'bom_item':
        params.erp_bom_item_id = entityId;
        break;
      case 'operation':
        params.erp_operation_id = entityId;
        break;
    }

    // Add default document type name if provided
    if (defaultDocumentTypeName) {
      params.defaultDocumentTypeName = defaultDocumentTypeName;
    }

    return params;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header} onClick={handleHeaderClick}>
        <div style={styles.headerLeft}>
          <span style={styles.expandIcon}>{collapsed ? '▶' : '▼'}</span>
          <span>🌿 {displayTitle}</span>
          {!loading && documents.length > 0 && (
            <span style={styles.badge}>{documents.length}</span>
          )}
        </div>
        {!collapsed && (
          <div style={styles.headerActions}>
            {/* View Mode Switcher */}
            <div style={styles.viewModeSwitcher}>
              <button
                style={{
                  ...styles.viewModeButton,
                  ...(viewMode === 'list' ? styles.viewModeButtonActive : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('list');
                }}
                title="Listenansicht"
              >
                ☰
              </button>
              <button
                style={{
                  ...styles.viewModeButton,
                  ...(viewMode === 'small-icons' ? styles.viewModeButtonActive : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('small-icons');
                }}
                title="Kleine Symbole"
              >
                ⊞
              </button>
              <button
                style={{
                  ...styles.viewModeButton,
                  ...(viewMode === 'preview' ? styles.viewModeButtonActive : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('preview');
                }}
                title="Vorschau mit Inhalt"
              >
                ▦
              </button>
            </div>
            <button
              style={styles.uploadButton}
              onClick={(e) => {
                e.stopPropagation();
                setShowUploadDialog(true);
              }}
              title="Dokument hochladen"
            >
              ⬆️ Hochladen
            </button>
            <button
              style={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation();
                fetchDocuments();
              }}
              title="Aktualisieren"
            >
              🔄
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={styles.contentArea}>
          {loading ? (
            <div style={styles.loading}>Lade Dokumente...</div>
          ) : error ? (
            <div style={styles.error}>{error}</div>
          ) : documents.length === 0 ? (
            <div style={styles.empty}>
              Keine Paperless-Dokumente vorhanden
              <br />
              <button
                style={{ ...styles.uploadButton, marginTop: '8px', display: 'inline-flex' }}
                onClick={() => setShowUploadDialog(true)}
              >
                ⬆️ Erstes Dokument hochladen
              </button>
            </div>
          ) : viewMode === 'list' ? (
            /* LIST VIEW with Preview Pane */
            <div style={styles.splitContainer}>
              <div style={styles.listPane}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '40px' }}></th>
                      <th style={styles.th}>Dokument</th>
                      <th style={styles.th}>Typ</th>
                      <th style={styles.th}>Datum</th>
                      <th style={{ ...styles.th, width: '60px', textAlign: 'center' as const }}>
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr
                        key={doc.id}
                        style={{
                          ...styles.row,
                          ...(selectedDoc?.id === doc.id ? styles.selectedRow : {}),
                          ...(hoveredRowId === doc.id && selectedDoc?.id !== doc.id ? styles.rowHover : {}),
                        }}
                        onMouseEnter={() => setHoveredRowId(doc.id)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        onClick={() => handleRowClick(doc)}
                      >
                      <td style={styles.td}>
                        {doc.thumbnail_url ? (
                          <img
                            src={addTokenToUrl(doc.thumbnail_url)}
                            alt=""
                            style={styles.thumbnail}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '20px' }}>
                            {getFileIcon(doc.original_file_name)}
                          </span>
                        )}
                      </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={styles.filename}>{doc.title}</span>
                            {doc.original_file_name && doc.original_file_name !== doc.title && (
                              <span style={{ fontSize: '9px', color: '#888' }}>
                                {doc.original_file_name}
                              </span>
                            )}
                            {doc.tag_names && doc.tag_names.length > 0 && (
                              <div>
                                {doc.tag_names.slice(0, 3).map((tag, i) => (
                                  <span key={i} style={styles.tag}>
                                    {tag}
                                  </span>
                                ))}
                                {doc.tag_names.length > 3 && (
                                  <span style={{ ...styles.tag, backgroundColor: '#ddd' }}>
                                    +{doc.tag_names.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={styles.td}>
                          {doc.document_type_name && (
                            <span style={styles.typeBadge}>{doc.document_type_name}</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontSize: '10px' }}>{formatDate(doc.created)}</span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' as const }}>
                        <button
                          style={styles.actionButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            const emlFile = isEmail(doc.original_file_name);
                            const downloadUrl = emlFile ? doc.original_download_url : doc.download_url;
                            if (downloadUrl) {
                              window.open(addTokenToUrl(downloadUrl), '_blank');
                            }
                          }}
                          title="Herunterladen"
                        >
                          ⬇️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Preview Pane */}
              <div style={styles.previewPane}>
                <div style={styles.previewHeader}>
                  <span>📄 Vorschau</span>
                  {selectedDoc && (
                    <div style={styles.previewActions}>
                      <button
                        style={styles.actionButton}
                        onClick={() => {
                          const emlFile = isEmail(selectedDoc.original_file_name);
                          const downloadUrl = emlFile ? selectedDoc.original_download_url : selectedDoc.download_url;
                          if (downloadUrl) {
                            window.open(addTokenToUrl(downloadUrl), '_blank');
                          }
                        }}
                        title="In neuem Tab öffnen"
                      >
                        🔗 Öffnen
                      </button>
                      <button
                        style={styles.actionButton}
                        onClick={() => {
                          if (selectedDoc.original_download_url) {
                            window.open(addTokenToUrl(selectedDoc.original_download_url), '_blank');
                          }
                        }}
                        title="Original herunterladen"
                      >
                        ⬇️ Download
                      </button>
                    </div>
                  )}
                </div>
                <div style={styles.previewContent}>
                  {!selectedDoc ? (
                    <div style={styles.previewPlaceholder}>
                      Wählen Sie ein Dokument aus der Liste,<br />
                      um eine Vorschau anzuzeigen.
                    </div>
                  ) : isEmail(selectedDoc.original_file_name) && selectedDoc.content ? (
                    /* Email text content preview */
                    <div style={{ padding: '16px', width: '100%', height: '100%', overflow: 'auto', backgroundColor: 'white' }}>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
                        📧 {selectedDoc.original_file_name}
                      </div>
                      <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        wordBreak: 'break-word', 
                        fontFamily: 'inherit', 
                        fontSize: '12px', 
                        lineHeight: 1.5,
                        margin: 0,
                        color: '#333'
                      }}>
                        {selectedDoc.content}
                      </pre>
                    </div>
                  ) : !isPreviewable(selectedDoc.original_file_name) ? (
                    <div style={styles.previewPlaceholder}>
                      <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>
                        {getFileIcon(selectedDoc.original_file_name)}
                      </span>
                      <strong>{selectedDoc.title}</strong>
                      <br />
                      <span style={{ color: '#666', fontSize: '11px' }}>
                        {selectedDoc.original_file_name}
                      </span>
                      <br /><br />
                      Vorschau für diesen Dateityp nicht verfügbar.
                      <br />
                      <button
                        style={{ ...styles.uploadButton, marginTop: '8px', display: 'inline-flex' }}
                        onClick={() => {
                          if (selectedDoc.original_download_url) {
                            window.open(addTokenToUrl(selectedDoc.original_download_url), '_blank');
                          }
                        }}
                      >
                        ⬇️ Datei herunterladen
                      </button>
                    </div>
                  ) : isImage(selectedDoc.original_file_name) ? (
                    <img
                      src={addTokenToUrl(selectedDoc.download_url)}
                      alt={selectedDoc.title}
                      style={styles.previewImage}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <iframe
                      src={addTokenToUrl(selectedDoc.download_url)}
                      style={styles.previewIframe}
                      title={`Vorschau: ${selectedDoc.title}`}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : viewMode === 'small-icons' ? (
            /* SMALL ICONS VIEW */
            <div style={styles.smallIconsGrid}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    ...styles.smallIconCard,
                    ...(selectedDoc?.id === doc.id ? styles.smallIconCardSelected : {}),
                    ...(hoveredRowId === doc.id && selectedDoc?.id !== doc.id ? styles.smallIconCardHover : {}),
                  }}
                  onMouseEnter={() => setHoveredRowId(doc.id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  onClick={() => handleRowClick(doc)}
                  onDoubleClick={() => {
                    const emlFile = isEmail(doc.original_file_name);
                    const downloadUrl = emlFile ? doc.original_download_url : doc.download_url;
                    if (downloadUrl) {
                      window.open(addTokenToUrl(downloadUrl), '_blank');
                    }
                  }}
                >
                  {doc.thumbnail_url ? (
                    <img
                      src={addTokenToUrl(doc.thumbnail_url)}
                      alt=""
                      style={styles.smallIconThumbnail}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '36px', marginBottom: '4px' }}>
                      {getFileIcon(doc.original_file_name)}
                    </span>
                  )}
                  <span style={styles.smallIconTitle}>{doc.title}</span>
                </div>
              ))}
            </div>
          ) : (
            /* PREVIEW CARDS VIEW */
            <div style={styles.previewGrid}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    ...styles.previewCard,
                    ...(selectedDoc?.id === doc.id ? styles.previewCardSelected : {}),
                    ...(hoveredRowId === doc.id && selectedDoc?.id !== doc.id ? styles.previewCardHover : {}),
                  }}
                  onMouseEnter={() => setHoveredRowId(doc.id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  onClick={() => handleRowClick(doc)}
                >
                  {/* Thumbnail */}
                  {doc.thumbnail_url ? (
                    <img
                      src={addTokenToUrl(doc.thumbnail_url)}
                      alt=""
                      style={styles.previewCardThumbnail}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={styles.previewCardThumbnailPlaceholder}>
                      {getFileIcon(doc.original_file_name)}
                    </div>
                  )}
                  
                  {/* Card Body */}
                  <div style={styles.previewCardBody}>
                    <div style={styles.previewCardTitle} title={doc.title}>
                      {doc.title}
                    </div>
                    <div style={styles.previewCardMeta}>
                      {doc.document_type_name && (
                        <span style={styles.typeBadge}>{doc.document_type_name}</span>
                      )}
                      <span>{formatDate(doc.created)}</span>
                    </div>
                    {/* Content Preview */}
                    {doc.content && (
                      <div style={styles.previewCardContent}>
                        {truncateContent(doc.content)}
                      </div>
                    )}
                    {/* Actions */}
                    <div style={styles.previewCardActions}>
                      <button
                        style={{ ...styles.actionButton, flex: 1, fontSize: '10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const emlFile = isEmail(doc.original_file_name);
                          const downloadUrl = emlFile ? doc.original_download_url : doc.download_url;
                          if (downloadUrl) {
                            window.open(addTokenToUrl(downloadUrl), '_blank');
                          }
                        }}
                        title="Öffnen"
                      >
                        🔗 Öffnen
                      </button>
                      <button
                        style={{ ...styles.actionButton, flex: 1, fontSize: '10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (doc.original_download_url) {
                            window.open(addTokenToUrl(doc.original_download_url), '_blank');
                          }
                        }}
                        title="Herunterladen"
                      >
                        ⬇️ Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <PaperlessUploadDialog
          onClose={() => setShowUploadDialog(false)}
          onUploadComplete={handleUploadComplete}
          defaultParams={getUploadParams()}
        />
      )}
    </div>
  );
};

export default PaperlessDocumentsPanel;
