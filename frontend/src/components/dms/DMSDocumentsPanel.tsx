/**
 * DMS Documents Panel Component
 * 
 * Displays documents from HUGWAWI DMS linked to various entities
 * (orders, articles, BOM items, operations, etc.)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  DMSDocument,
  DMSDocumentListResponse,
  DMSEntityType,
} from '../../services/dmsTypes';
import {
  getOrderDocuments,
  getArticleDocuments,
  getOrderArticleDocuments,
  getBomItemDocuments,
  getOperationDocuments,
  getCustomerDocuments,
  downloadDocument,
  getFileIcon,
  formatDate,
  getDocumentDownloadUrl,
} from '../../services/dmsApi';

interface DMSDocumentsPanelProps {
  /** Entity type to fetch documents for */
  entityType: DMSEntityType;
  /** Entity ID */
  entityId: number;
  /** Panel title (optional, auto-generated if not provided) */
  title?: string;
  /** Show as collapsed by default */
  defaultCollapsed?: boolean;
  /** Max height for scrollable area */
  maxHeight?: number;
  /** Callback when a document is clicked */
  onDocumentClick?: (doc: DMSDocument) => void;
}

const styles = {
  container: {
    marginTop: '8px',
    marginBottom: '8px',
    backgroundColor: '#fff9f0',
    border: '1px solid #f5e6d3',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#faf0e6',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#8b6914',
    borderBottom: '1px solid #f5e6d3',
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
    backgroundColor: '#d4a574',
    color: 'white',
    borderRadius: '10px',
    padding: '1px 6px',
    fontSize: '10px',
    fontWeight: 'bold' as const,
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
    backgroundColor: '#fef8f0',
    borderBottom: '1px solid #f5e6d3',
    fontWeight: 'bold' as const,
    color: '#8b6914',
    position: 'sticky' as const,
    top: 0,
  },
  td: {
    padding: '5px 8px',
    borderBottom: '1px solid #faf0e6',
    color: '#333333',
    verticalAlign: 'middle' as const,
  },
  row: {
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  rowHover: {
    backgroundColor: '#fef5e7',
  },
  fileIcon: {
    fontSize: '14px',
    marginRight: '6px',
  },
  filename: {
    fontWeight: 500 as const,
    color: '#333',
  },
  description: {
    color: '#666',
    fontSize: '10px',
    maxWidth: '200px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tag: {
    display: 'inline-block',
    backgroundColor: '#e8dcc8',
    color: '#6b5a3e',
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
    color: '#4a90d9',
    borderRadius: '3px',
    transition: 'background-color 0.15s',
  },
  loading: {
    padding: '15px',
    textAlign: 'center' as const,
    color: '#8b6914',
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
};

const entityTitles: Record<DMSEntityType, string> = {
  order: 'Auftragsdokumente',
  article: 'Artikeldokumente',
  order_article: 'Auftragsartikeldokumente',
  bom_item: 'Stücklistendokumente',
  operation: 'Arbeitsgangdokumente',
  customer: 'Kundendokumente',
};

const DMSDocumentsPanel: React.FC<DMSDocumentsPanelProps> = ({
  entityType,
  entityId,
  title,
  defaultCollapsed = true,
  maxHeight = 300,
  onDocumentClick,
}) => {
  const [documents, setDocuments] = useState<DMSDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);

  // Fetch documents based on entity type
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let response: DMSDocumentListResponse;

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
        case 'customer':
          response = await getCustomerDocuments(entityId);
          break;
        default:
          throw new Error(`Unbekannter Entity-Typ: ${entityType}`);
      }

      setDocuments(response.items);
    } catch (err) {
      console.error('DMS fetch error:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Dokumente');
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
  const handleRowClick = (doc: DMSDocument) => {
    if (onDocumentClick) {
      onDocumentClick(doc);
    }
  };

  // Handle download button click
  const handleDownload = (e: React.MouseEvent, doc: DMSDocument) => {
    e.stopPropagation();
    downloadDocument(doc.id);
  };

  // Handle preview button click (open in new tab)
  const handlePreview = (e: React.MouseEvent, doc: DMSDocument) => {
    e.stopPropagation();
    const url = getDocumentDownloadUrl(doc.id);
    window.open(url, '_blank');
  };

  const displayTitle = title || entityTitles[entityType];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header} onClick={handleHeaderClick}>
        <div style={styles.headerLeft}>
          <span style={styles.expandIcon}>{collapsed ? '▶' : '▼'}</span>
          <span>📁 {displayTitle}</span>
          {!loading && documents.length > 0 && (
            <span style={styles.badge}>{documents.length}</span>
          )}
        </div>
        {!collapsed && (
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
            <div style={styles.empty}>Keine Dokumente vorhanden</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Dokument</th>
                  <th style={styles.th}>Typ</th>
                  <th style={styles.th}>Hochgeladen</th>
                  <th style={styles.th}>Version</th>
                  <th style={{ ...styles.th, width: '80px', textAlign: 'center' as const }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div>
                          <span style={styles.fileIcon}>{getFileIcon(doc.filename)}</span>
                          <span style={styles.filename}>{doc.filename || 'Unbenannt'}</span>
                          {doc.tag && <span style={styles.tag}>{doc.tag}</span>}
                        </div>
                        {doc.description && (
                          <div style={styles.description} title={doc.description}>
                            {doc.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {doc.type_name && (
                        <span style={styles.typeBadge}>{doc.type_name}</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontSize: '10px' }}>
                        {formatDate(doc.upload_time)}
                        {doc.uploader_name && (
                          <div style={{ color: '#888', fontSize: '9px' }}>
                            von {doc.uploader_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '10px', color: '#666' }}>
                        v{doc.version}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' as const }}>
                      <button
                        style={styles.actionButton}
                        onClick={(e) => handlePreview(e, doc)}
                        title="Vorschau"
                      >
                        👁️
                      </button>
                      <button
                        style={styles.actionButton}
                        onClick={(e) => handleDownload(e, doc)}
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
    </div>
  );
};

export default DMSDocumentsPanel;
