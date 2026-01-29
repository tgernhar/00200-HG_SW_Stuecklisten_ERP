/**
 * Paperless Documents Panel Component
 *
 * Displays documents from Paperless-ngx linked to various ERP entities.
 * Supports document upload and viewing.
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
}) => {
  const [documents, setDocuments] = useState<PaperlessDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

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

  // Handle document row click
  const handleRowClick = (doc: PaperlessDocument) => {
    if (onDocumentClick) {
      onDocumentClick(doc);
    } else if (doc.download_url) {
      window.open(doc.download_url, '_blank');
    }
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
        <div style={{ ...styles.content, maxHeight }}>
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
          ) : (
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
                      ...(hoveredRowId === doc.id ? styles.rowHover : {}),
                    }}
                    onMouseEnter={() => setHoveredRowId(doc.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    onClick={() => handleRowClick(doc)}
                  >
                    <td style={styles.td}>
                      {doc.thumbnail_url ? (
                        <img
                          src={doc.thumbnail_url}
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
                          if (doc.download_url) {
                            window.open(doc.download_url, '_blank');
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
