/**
 * CRM Search Page
 * Full-text search across communications
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchCommunications } from '../services/crmApi'
import { SearchResult, SearchResponse } from '../services/crmTypes'

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1000px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    marginBottom: '20px',
    color: '#333',
  },
  searchBox: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  searchInput: {
    flex: 1,
    padding: '12px 16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
  },
  searchButton: {
    padding: '12px 24px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  filters: {
    display: 'flex',
    gap: '15px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  filterSelect: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
  },
  filterInput: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    width: '140px',
  },
  results: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  resultsHeader: {
    padding: '12px 15px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f9f9f9',
    fontSize: '13px',
    color: '#666',
  },
  resultItem: {
    padding: '15px',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
  },
  resultItemHover: {
    backgroundColor: '#f5f5f5',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  resultSubject: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  },
  resultDate: {
    fontSize: '12px',
    color: '#666',
    flexShrink: 0,
    marginLeft: '15px',
  },
  resultPreview: {
    fontSize: '13px',
    color: '#555',
    lineHeight: '1.5',
  },
  resultHighlight: {
    backgroundColor: '#fff59d',
    padding: '0 2px',
  },
  resultMeta: {
    display: 'flex',
    gap: '15px',
    marginTop: '8px',
    fontSize: '12px',
    color: '#666',
  },
  resultType: {
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 500,
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#666',
  },
  loading: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#666',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    padding: '15px',
    borderTop: '1px solid #eee',
  },
  pageButton: {
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    backgroundColor: '#fff',
  },
  pageButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}

const typeColors: Record<string, { bg: string; color: string }> = {
  email_in: { bg: '#e3f2fd', color: '#1565c0' },
  email_out: { bg: '#e8f5e9', color: '#2e7d32' },
  phone: { bg: '#fff3e0', color: '#ef6c00' },
  meeting: { bg: '#f3e5f5', color: '#7b1fa2' },
  note: { bg: '#f5f5f5', color: '#616161' },
}

const typeLabels: Record<string, string> = {
  email_in: 'E-Mail Eingang',
  email_out: 'E-Mail Ausgang',
  phone: 'Telefonat',
  meeting: 'Meeting',
  note: 'Notiz',
}

export default function CRMSearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<number | null>(null)
  
  // Filters
  const [entryType, setEntryType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const limit = 20

  const handleSearch = async (newOffset = 0) => {
    if (query.length < 2) return

    setLoading(true)
    setOffset(newOffset)
    try {
      const response = await searchCommunications({
        q: query,
        entry_types: entryType || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit,
        offset: newOffset,
      })
      setResults(response.items)
      setTotal(response.total)
      setSearched(true)
    } catch (err) {
      console.error('Error searching:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(0)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Kommunikation durchsuchen</h2>

      <div style={styles.searchBox}>
        <input
          type="text"
          placeholder="Suchbegriff eingeben (mind. 2 Zeichen)..."
          style={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button style={styles.searchButton} onClick={() => handleSearch(0)}>
          Suchen
        </button>
      </div>

      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label>Typ:</label>
          <select
            style={styles.filterSelect}
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
          >
            <option value="">Alle</option>
            <option value="email_in,email_out">Nur E-Mails</option>
            <option value="email_in">E-Mail Eingang</option>
            <option value="email_out">E-Mail Ausgang</option>
            <option value="phone">Telefonate</option>
            <option value="meeting">Meetings</option>
            <option value="note">Notizen</option>
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label>Von:</label>
          <input
            type="date"
            style={styles.filterInput}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div style={styles.filterGroup}>
          <label>Bis:</label>
          <input
            type="date"
            style={styles.filterInput}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>Suche läuft...</div>
      ) : !searched ? (
        <div style={styles.emptyState}>
          Geben Sie einen Suchbegriff ein, um Kommunikationseinträge zu finden.
        </div>
      ) : results.length === 0 ? (
        <div style={styles.emptyState}>
          Keine Ergebnisse für "{query}" gefunden.
        </div>
      ) : (
        <div style={styles.results}>
          <div style={styles.resultsHeader}>
            {total} Ergebnis{total !== 1 ? 'se' : ''} gefunden
          </div>
          
          {results.map((result) => (
            <div
              key={result.id}
              style={{
                ...styles.resultItem,
                ...(hoveredItem === result.id ? styles.resultItemHover : {}),
              }}
              onMouseEnter={() => setHoveredItem(result.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div style={styles.resultHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      ...styles.resultType,
                      backgroundColor: typeColors[result.entry_type]?.bg || '#f5f5f5',
                      color: typeColors[result.entry_type]?.color || '#333',
                    }}
                  >
                    {typeLabels[result.entry_type] || result.entry_type}
                  </span>
                  <span style={styles.resultSubject}>
                    {result.subject || '(Kein Betreff)'}
                  </span>
                </div>
                <span style={styles.resultDate}>{formatDate(result.date)}</span>
              </div>
              
              {result.highlight ? (
                <div
                  style={styles.resultPreview}
                  dangerouslySetInnerHTML={{
                    __html: result.highlight.replace(
                      new RegExp(`(${query})`, 'gi'),
                      '<span style="background-color: #fff59d;">$1</span>'
                    ),
                  }}
                />
              ) : result.body_preview ? (
                <div style={styles.resultPreview}>{result.body_preview}</div>
              ) : null}
              
              <div style={styles.resultMeta}>
                {result.sender && <span>Von: {result.sender}</span>}
                {result.customer_name && <span>Kunde: {result.customer_name}</span>}
                {result.supplier_name && <span>Lieferant: {result.supplier_name}</span>}
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                style={{
                  ...styles.pageButton,
                  ...(currentPage === 1 ? styles.pageButtonDisabled : {}),
                }}
                onClick={() => handleSearch(offset - limit)}
                disabled={currentPage === 1}
              >
                Zurück
              </button>
              <span style={{ padding: '6px 12px', fontSize: '13px' }}>
                Seite {currentPage} von {totalPages}
              </span>
              <button
                style={{
                  ...styles.pageButton,
                  ...(currentPage === totalPages ? styles.pageButtonDisabled : {}),
                }}
                onClick={() => handleSearch(offset + limit)}
                disabled={currentPage === totalPages}
              >
                Weiter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
