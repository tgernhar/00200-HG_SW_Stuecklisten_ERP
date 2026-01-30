/**
 * Paperless Search Page
 * 
 * Full-featured document search interface similar to Paperless-ngx frontend.
 * Supports fulltext search, multiple filters, and document preview.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  PaperlessDocument,
  PaperlessSearchParams,
  PaperlessCorrespondent,
  PaperlessDocumentType,
  PaperlessTag,
} from '../services/paperlessTypes';
import {
  searchDocuments,
  getCorrespondents,
  getDocumentTypes,
  getTags,
  getFileIcon,
  formatDate,
} from '../services/paperlessApi';

// Sorting options
const SORT_OPTIONS = [
  { value: '-created', label: 'Erstellt (neueste zuerst)' },
  { value: 'created', label: 'Erstellt (älteste zuerst)' },
  { value: '-modified', label: 'Geändert (neueste zuerst)' },
  { value: 'title', label: 'Titel (A-Z)' },
  { value: '-title', label: 'Titel (Z-A)' },
  { value: 'correspondent__name', label: 'Korrespondent (A-Z)' },
  { value: 'document_type__name', label: 'Dokumenttyp (A-Z)' },
];

const styles = {
  container: {
    padding: '16px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#333',
    marginBottom: '12px',
  },
  searchRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  searchInputWrapper: {
    display: 'flex',
    flex: 1,
    maxWidth: '600px',
  },
  searchTypeSelect: {
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRight: 'none',
    borderRadius: '4px 0 0 4px',
    fontSize: '13px',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer',
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '0 4px 4px 0',
    fontSize: '13px',
  },
  searchButton: {
    padding: '8px 16px',
    backgroundColor: '#228b22',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold' as const,
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    marginBottom: '12px',
    alignItems: 'center',
  },
  filterButton: {
    padding: '6px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  filterButtonActive: {
    backgroundColor: '#e6ffe6',
    borderColor: '#228b22',
    color: '#228b22',
  },
  filterDropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 1000,
    minWidth: '200px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
  },
  filterOption: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    borderBottom: '1px solid #eee',
  },
  filterOptionHover: {
    backgroundColor: '#f5f5f5',
  },
  filterOptionSelected: {
    backgroundColor: '#e6ffe6',
  },
  dateInputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  dateInput: {
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '12px',
    width: '130px',
  },
  resetButton: {
    padding: '6px 12px',
    border: '1px solid #dc3545',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#dc3545',
    cursor: 'pointer',
    fontSize: '12px',
  },
  resultsInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #ddd',
    marginBottom: '8px',
  },
  resultsCount: {
    fontSize: '13px',
    color: '#666',
  },
  sortSelect: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'white',
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    gap: '16px',
    overflow: 'hidden',
  },
  tableContainer: {
    flex: 1,
    overflow: 'auto',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px',
  },
  th: {
    padding: '10px 8px',
    textAlign: 'left' as const,
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #ddd',
    fontWeight: 'bold' as const,
    color: '#333',
    position: 'sticky' as const,
    top: 0,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #eee',
    color: '#333',
    verticalAlign: 'middle' as const,
  },
  row: {
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  rowHover: {
    backgroundColor: '#f5f5f5',
  },
  rowSelected: {
    backgroundColor: '#e6ffe6',
  },
  titleCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  fileIcon: {
    fontSize: '14px',
  },
  titleLink: {
    color: '#228b22',
    textDecoration: 'none',
    fontWeight: 500,
  },
  previewIcon: {
    color: '#999',
    fontSize: '12px',
  },
  typeBadge: {
    display: 'inline-block',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '10px',
  },
  tagBadge: {
    display: 'inline-block',
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '10px',
    marginRight: '4px',
  },
  previewPanel: {
    width: '400px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#fafafa',
  },
  previewHeader: {
    padding: '12px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
  },
  previewTitle: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#333',
    marginBottom: '4px',
  },
  previewMeta: {
    fontSize: '11px',
    color: '#666',
  },
  previewContent: {
    flex: 1,
    padding: '0',
    overflow: 'hidden',
  },
  previewIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  previewPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    fontSize: '13px',
  },
  previewActions: {
    padding: '8px 12px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    gap: '8px',
  },
  actionButton: {
    padding: '6px 12px',
    border: '1px solid #228b22',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#228b22',
    cursor: 'pointer',
    fontSize: '12px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#666',
  },
  error: {
    padding: '16px',
    backgroundColor: '#fee',
    color: '#c00',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  filterWrapper: {
    position: 'relative' as const,
  },
  erpFilterRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  erpInput: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '12px',
    width: '150px',
  },
};

export default function PaperlessSearchPage() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'content' | 'title'>('content');
  
  // Filter state
  const [selectedCorrespondent, setSelectedCorrespondent] = useState<number | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [erpOrderNumber, setErpOrderNumber] = useState('');
  const [erpArticleNumber, setErpArticleNumber] = useState('');
  
  // Sorting and pagination
  const [ordering, setOrdering] = useState('-created');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  
  // Results
  const [documents, setDocuments] = useState<PaperlessDocument[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<PaperlessDocument | null>(null);
  
  // Metadata for filters
  const [correspondents, setCorrespondents] = useState<PaperlessCorrespondent[]>([]);
  const [documentTypes, setDocumentTypes] = useState<PaperlessDocumentType[]>([]);
  const [tags, setTags] = useState<PaperlessTag[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  
  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Load metadata on mount
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-CORR-API',location:'PaperlessSearchPage:loadMetadata',message:'loading metadata started',timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
        // #endregion
        const [corr, types, tagsList] = await Promise.all([
          getCorrespondents(),
          getDocumentTypes(),
          getTags(),
        ]);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-CORR-API',location:'PaperlessSearchPage:loadMetadata',message:'metadata loaded',data:{correspondentsCount:corr.length,typesCount:types.length,tagsCount:tagsList.length,correspondents:corr.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
        // #endregion
        setCorrespondents(corr);
        setDocumentTypes(types);
        setTags(tagsList);
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-CORR-API',location:'PaperlessSearchPage:loadMetadata',message:'metadata load error',data:{error:String(err)},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
        // #endregion
        console.error('Error loading metadata:', err);
      }
    };
    loadMetadata();
  }, []);

  // Search function
  const performSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: PaperlessSearchParams = {
        page,
        page_size: pageSize,
        ordering,
      };
      
      if (searchQuery) {
        params.q = searchQuery;
      }
      if (selectedCorrespondent) {
        params.correspondent_id = selectedCorrespondent;
      }
      if (selectedDocType) {
        params.document_type_id = selectedDocType;
      }
      if (selectedTags.length > 0) {
        params.tag_ids = selectedTags;
      }
      if (dateFrom) {
        params.created_after = dateFrom;
      }
      if (dateTo) {
        params.created_before = dateTo;
      }
      if (erpOrderNumber) {
        params.erp_order_number = erpOrderNumber;
      }
      if (erpArticleNumber) {
        params.erp_article_number = erpArticleNumber;
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-SEARCH',location:'PaperlessSearchPage:performSearch',message:'search params',data:{params,searchQuery},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      
      const result = await searchDocuments(params);
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-SEARCH',location:'PaperlessSearchPage:performSearch',message:'search result',data:{itemsCount:result.items.length,total:result.total},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      
      setDocuments(result.items);
      setTotalCount(result.total);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hypothesisId:'H-SEARCH',location:'PaperlessSearchPage:performSearch',message:'search error',data:{error:String(err)},timestamp:Date.now(),sessionId:'debug-session'})}).catch(()=>{});
      // #endregion
      setError(err instanceof Error ? err.message : 'Fehler bei der Suche');
      setDocuments([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCorrespondent, selectedDocType, selectedTags, dateFrom, dateTo, erpOrderNumber, erpArticleNumber, ordering, page, pageSize]);

  // Initial search and on filter change
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCorrespondent(null);
    setSelectedDocType(null);
    setSelectedTags([]);
    setDateFrom('');
    setDateTo('');
    setErpOrderNumber('');
    setErpArticleNumber('');
    setOrdering('-created');
    setPage(1);
  };

  // Handle search on Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1);
      performSearch();
    }
  };

  // Toggle tag selection
  const toggleTag = (tagId: number) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Get auth token for preview URLs
  const getAuthToken = (): string => {
    return localStorage.getItem('auth_token') || '';
  };

  // Add token to proxy URL
  const addTokenToUrl = (url: string | null): string => {
    if (!url) return '';
    const token = getAuthToken();
    return token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;
  };

  // Check if file is previewable (PDF/Images)
  const isPreviewable = (fileName: string | null): boolean => {
    if (!fileName) return false;
    const ext = fileName.toLowerCase();
    return ext.endsWith('.pdf') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || 
           ext.endsWith('.png') || ext.endsWith('.gif') || ext.endsWith('.webp');
  };

  // Check if file is an email
  const isEmail = (fileName: string | null): boolean => {
    if (!fileName) return false;
    return fileName.toLowerCase().endsWith('.eml');
  };

  // Download document
  const handleDownload = (doc: PaperlessDocument) => {
    const isEml = doc.original_file_name?.toLowerCase().endsWith('.eml');
    const downloadUrl = isEml ? doc.original_download_url : doc.download_url;
    if (downloadUrl) {
      window.open(addTokenToUrl(downloadUrl), '_blank');
    }
  };

  // Get correspondent name
  const getCorrespondentName = (id: number | null) => {
    if (!id) return '-';
    const corr = correspondents.find(c => c.id === id);
    return corr?.name || '-';
  };

  // Get document type name
  const getDocTypeName = (id: number | null) => {
    if (!id) return '-';
    const type = documentTypes.find(t => t.id === id);
    return type?.name || '-';
  };

  // Check if any filter is active
  const hasActiveFilters = selectedCorrespondent || selectedDocType || selectedTags.length > 0 || 
                           dateFrom || dateTo || erpOrderNumber || erpArticleNumber;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Dokumente</h1>
        
        {/* Search Row */}
        <div style={styles.searchRow}>
          <div style={styles.searchInputWrapper}>
            <select
              style={styles.searchTypeSelect}
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'content' | 'title')}
            >
              <option value="content">Titel & Inhalt</option>
              <option value="title">Nur Titel</option>
            </select>
            <input
              type="text"
              style={styles.searchInput}
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <button
            style={styles.searchButton}
            onClick={() => { setPage(1); performSearch(); }}
          >
            Suchen
          </button>
        </div>

        {/* Filter Row */}
        <div style={styles.filterRow}>
          {/* Tags Filter */}
          <div style={styles.filterWrapper}>
            <button
              style={{
                ...styles.filterButton,
                ...(selectedTags.length > 0 ? styles.filterButtonActive : {}),
              }}
              onClick={() => setActiveDropdown(activeDropdown === 'tags' ? null : 'tags')}
            >
              🏷️ Tags {selectedTags.length > 0 && `(${selectedTags.length})`} ▾
            </button>
            {activeDropdown === 'tags' && (
              <div style={styles.filterDropdown}>
                {tags.map(tag => (
                  <div
                    key={tag.id}
                    style={{
                      ...styles.filterOption,
                      ...(selectedTags.includes(tag.id) ? styles.filterOptionSelected : {}),
                    }}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {selectedTags.includes(tag.id) ? '☑' : '☐'} {tag.name} ({tag.document_count})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Correspondent Filter */}
          <div style={styles.filterWrapper}>
            <button
              style={{
                ...styles.filterButton,
                ...(selectedCorrespondent ? styles.filterButtonActive : {}),
              }}
              onClick={() => setActiveDropdown(activeDropdown === 'correspondent' ? null : 'correspondent')}
            >
              👤 Korrespondent {selectedCorrespondent && `(1)`} ▾
            </button>
            {activeDropdown === 'correspondent' && (
              <div style={styles.filterDropdown}>
                <div
                  style={styles.filterOption}
                  onClick={() => { setSelectedCorrespondent(null); setActiveDropdown(null); }}
                >
                  Alle
                </div>
                {correspondents.map(corr => (
                  <div
                    key={corr.id}
                    style={{
                      ...styles.filterOption,
                      ...(selectedCorrespondent === corr.id ? styles.filterOptionSelected : {}),
                    }}
                    onClick={() => { setSelectedCorrespondent(corr.id); setActiveDropdown(null); }}
                  >
                    {corr.name} ({corr.document_count})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document Type Filter */}
          <div style={styles.filterWrapper}>
            <button
              style={{
                ...styles.filterButton,
                ...(selectedDocType ? styles.filterButtonActive : {}),
              }}
              onClick={() => setActiveDropdown(activeDropdown === 'doctype' ? null : 'doctype')}
            >
              📁 Dokumenttyp {selectedDocType && `(1)`} ▾
            </button>
            {activeDropdown === 'doctype' && (
              <div style={styles.filterDropdown}>
                <div
                  style={styles.filterOption}
                  onClick={() => { setSelectedDocType(null); setActiveDropdown(null); }}
                >
                  Alle
                </div>
                {documentTypes.map(type => (
                  <div
                    key={type.id}
                    style={{
                      ...styles.filterOption,
                      ...(selectedDocType === type.id ? styles.filterOptionSelected : {}),
                    }}
                    onClick={() => { setSelectedDocType(type.id); setActiveDropdown(null); }}
                  >
                    {type.name} ({type.document_count})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date Filter */}
          <div style={styles.dateInputGroup}>
            <span style={{ fontSize: '12px', color: '#666' }}>📅 Datum:</span>
            <input
              type="date"
              style={styles.dateInput}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="Von"
            />
            <span style={{ fontSize: '12px', color: '#666' }}>-</span>
            <input
              type="date"
              style={styles.dateInput}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Bis"
            />
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button style={styles.resetButton} onClick={resetFilters}>
              ✕ Filter zurücksetzen
            </button>
          )}
        </div>

        {/* ERP Filter Row */}
        <div style={styles.erpFilterRow}>
          <input
            type="text"
            style={styles.erpInput}
            placeholder="Auftragsnummer"
            value={erpOrderNumber}
            onChange={(e) => setErpOrderNumber(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <input
            type="text"
            style={styles.erpInput}
            placeholder="Artikelnummer"
            value={erpArticleNumber}
            onChange={(e) => setErpArticleNumber(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Results Info */}
      <div style={styles.resultsInfo}>
        <span style={styles.resultsCount}>
          {loading ? 'Suche...' : `${totalCount} Dokumente`}
        </span>
        <select
          style={styles.sortSelect}
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Results Table */}
        <div style={styles.tableContainer}>
          {loading ? (
            <div style={styles.loading}>Lade Dokumente...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Korrespondent</th>
                  <th style={styles.th}>Titel</th>
                  <th style={styles.th}>Dokumenttyp</th>
                  <th style={styles.th}>Erstellt</th>
                  <th style={styles.th}>Tags</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr
                    key={doc.id}
                    style={{
                      ...styles.row,
                      ...(hoveredRow === doc.id ? styles.rowHover : {}),
                      ...(selectedDoc?.id === doc.id ? styles.rowSelected : {}),
                    }}
                    onMouseEnter={() => setHoveredRow(doc.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <td style={styles.td}>{doc.correspondent_name || '-'}</td>
                    <td style={styles.td}>
                      <div style={styles.titleCell}>
                        <span style={styles.fileIcon}>{getFileIcon(doc.original_file_name)}</span>
                        <span style={styles.titleLink}>{doc.title}</span>
                        {isPreviewable(doc.original_file_name) && (
                          <span style={styles.previewIcon}>👁</span>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {doc.document_type_name && (
                        <span style={styles.typeBadge}>{doc.document_type_name}</span>
                      )}
                    </td>
                    <td style={styles.td}>{formatDate(doc.created)}</td>
                    <td style={styles.td}>
                      {doc.tag_names.map((tag, idx) => (
                        <span key={idx} style={styles.tagBadge}>{tag}</span>
                      ))}
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} style={{ ...styles.td, textAlign: 'center', padding: '40px' }}>
                      Keine Dokumente gefunden
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Preview Panel */}
        <div style={styles.previewPanel}>
          {selectedDoc ? (
            <>
              <div style={styles.previewHeader}>
                <div style={styles.previewTitle}>{selectedDoc.title}</div>
                <div style={styles.previewMeta}>
                  {selectedDoc.correspondent_name && `${selectedDoc.correspondent_name} • `}
                  {selectedDoc.document_type_name && `${selectedDoc.document_type_name} • `}
                  {formatDate(selectedDoc.created)}
                </div>
              </div>
              <div style={styles.previewContent}>
                {isPreviewable(selectedDoc.original_file_name) && selectedDoc.download_url ? (
                  <iframe
                    src={addTokenToUrl(selectedDoc.download_url)}
                    style={styles.previewIframe}
                    title="Dokumentvorschau"
                  />
                ) : isEmail(selectedDoc.original_file_name) && selectedDoc.content ? (
                  /* Email text content preview */
                  <div style={{ padding: '16px', width: '100%', height: '100%', overflow: 'auto', backgroundColor: 'white' }}>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
                      📧 {selectedDoc.original_file_name}
                    </div>
                    <pre style={{ 
                      whiteSpace: 'pre-wrap', 
                      wordWrap: 'break-word', 
                      fontFamily: 'monospace', 
                      fontSize: '12px',
                      lineHeight: '1.4',
                      margin: 0,
                      color: '#333'
                    }}>
                      {selectedDoc.content}
                    </pre>
                  </div>
                ) : (
                  <div style={styles.previewPlaceholder}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                        {getFileIcon(selectedDoc.original_file_name)}
                      </div>
                      <div>{selectedDoc.original_file_name || 'Dokument'}</div>
                      <div style={{ marginTop: '8px', fontSize: '11px' }}>
                        Keine Vorschau verfügbar
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={styles.previewActions}>
                <button
                  style={styles.actionButton}
                  onClick={() => handleDownload(selectedDoc)}
                >
                  ⬇️ Download
                </button>
                <button
                  style={styles.actionButton}
                  onClick={() => window.open(`/api/paperless/documents/${selectedDoc.id}`, '_blank')}
                >
                  🔗 In Paperless öffnen
                </button>
              </div>
            </>
          ) : (
            <div style={styles.previewPlaceholder}>
              Dokument auswählen für Vorschau
            </div>
          )}
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {activeDropdown && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
}
