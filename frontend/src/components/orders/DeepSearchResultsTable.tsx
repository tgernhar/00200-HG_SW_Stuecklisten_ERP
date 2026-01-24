/**
 * Deep Search Results Table Component
 * Displays flat results for deep filter searches (article/workstep)
 */
import React, { useState } from 'react'
import { DeepSearchResultItem } from '../../services/types'

interface DeepSearchResultsTableProps {
  results: DeepSearchResultItem[]
  onClose: () => void
  onNavigateToOrder?: (orderId: number) => void
}

type SortField = 'order_name' | 'order_article_number' | 'bom_article_number' | 'bom_article_description' | 'bom_quantity' | 'einzelmass' | 'gesamtmenge' | 'einheit'
type SortDirection = 'asc' | 'desc'

const styles = {
  container: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    marginBottom: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 15px',
    backgroundColor: '#f0f7ff',
    borderBottom: '1px solid #ddd',
    borderRadius: '4px 4px 0 0'
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    color: '#1976d2'
  },
  closeButton: {
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#666'
  },
  tableContainer: {
    maxHeight: '300px',
    overflowY: 'auto' as const
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px'
  },
  th: {
    padding: '8px 10px',
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #ddd',
    textAlign: 'left' as const,
    fontWeight: 'bold' as const,
    color: '#333',
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const
  },
  thHover: {
    backgroundColor: '#e8e8e8'
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid #eee',
    color: '#333'
  },
  trHover: {
    backgroundColor: '#f5f9ff'
  },
  orderLink: {
    color: '#1976d2',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  sortIcon: {
    marginLeft: '5px',
    fontSize: '10px',
    color: '#666'
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#999',
    fontStyle: 'italic' as const
  },
  matchBadge: {
    fontSize: '10px',
    padding: '2px 5px',
    borderRadius: '3px',
    marginLeft: '5px'
  },
  matchBom: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2'
  },
  matchWorkplan: {
    backgroundColor: '#e8f5e9',
    color: '#388e3c'
  }
}

export default function DeepSearchResultsTable({ 
  results, 
  onClose, 
  onNavigateToOrder 
}: DeepSearchResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('order_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [hoveredHeader, setHoveredHeader] = useState<SortField | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedResults = [...results].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]
    
    // Handle null values
    if (aVal === null) aVal = ''
    if (bVal === null) bVal = ''
    
    // Handle numbers
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    // Handle strings
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    
    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr, 'de')
    } else {
      return bStr.localeCompare(aStr, 'de')
    }
  })

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const getMatchBadgeStyle = (source: string) => {
    if (source === 'bom_detail') {
      return { ...styles.matchBadge, ...styles.matchBom }
    }
    return { ...styles.matchBadge, ...styles.matchWorkplan }
  }

  const getMatchLabel = (source: string) => {
    if (source === 'bom_detail') return 'SL'
    if (source === 'workplan_detail') return 'AP'
    return 'AU'
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>
          Deep-Filter Ergebnisse ({results.length} Treffer)
        </span>
        <button 
          style={styles.closeButton}
          onClick={onClose}
          onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e8e8e8'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
        >
          X Schließen
        </button>
      </div>
      
      <div style={styles.tableContainer}>
        {results.length === 0 ? (
          <div style={styles.emptyState}>
            Keine Ergebnisse gefunden
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th 
                  style={{
                    ...styles.th,
                    ...(hoveredHeader === 'order_name' ? styles.thHover : {})
                  }}
                  onClick={() => handleSort('order_name')}
                  onMouseEnter={() => setHoveredHeader('order_name')}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  Auftrag <span style={styles.sortIcon}>{getSortIcon('order_name')}</span>
                </th>
                <th 
                  style={{
                    ...styles.th,
                    ...(hoveredHeader === 'order_article_number' ? styles.thHover : {})
                  }}
                  onClick={() => handleSort('order_article_number')}
                  onMouseEnter={() => setHoveredHeader('order_article_number')}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  AU-Artikel <span style={styles.sortIcon}>{getSortIcon('order_article_number')}</span>
                </th>
                <th 
                  style={{
                    ...styles.th,
                    ...(hoveredHeader === 'bom_article_number' ? styles.thHover : {})
                  }}
                  onClick={() => handleSort('bom_article_number')}
                  onMouseEnter={() => setHoveredHeader('bom_article_number')}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  SL-Artikel <span style={styles.sortIcon}>{getSortIcon('bom_article_number')}</span>
                </th>
                <th 
                  style={{
                    ...styles.th,
                    ...(hoveredHeader === 'bom_article_description' ? styles.thHover : {})
                  }}
                  onClick={() => handleSort('bom_article_description')}
                  onMouseEnter={() => setHoveredHeader('bom_article_description')}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  Bezeichnung <span style={styles.sortIcon}>{getSortIcon('bom_article_description')}</span>
                </th>
                <th 
                  style={{
                    ...styles.th,
                    ...(hoveredHeader === 'bom_quantity' ? styles.thHover : {}),
                    textAlign: 'right' as const
                  }}
                  onClick={() => handleSort('bom_quantity')}
                  onMouseEnter={() => setHoveredHeader('bom_quantity')}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  AU-Menge <span style={styles.sortIcon}>{getSortIcon('bom_quantity')}</span>
                </th>
                <th 
                  style={{
                    ...styles.th,
                    ...(hoveredHeader === 'einzelmass' ? styles.thHover : {}),
                    textAlign: 'right' as const
                  }}
                  onClick={() => handleSort('einzelmass')}
                  onMouseEnter={() => setHoveredHeader('einzelmass')}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  Einzelmass <span style={styles.sortIcon}>{getSortIcon('einzelmass')}</span>
                </th>
                <th 
                  style={{
                    ...styles.th,
                    ...(hoveredHeader === 'gesamtmenge' ? styles.thHover : {}),
                    textAlign: 'right' as const
                  }}
                  onClick={() => handleSort('gesamtmenge')}
                  onMouseEnter={() => setHoveredHeader('gesamtmenge')}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  Gesamtmenge <span style={styles.sortIcon}>{getSortIcon('gesamtmenge')}</span>
                </th>
                <th 
                  style={{
                    ...styles.th,
                    ...(hoveredHeader === 'einheit' ? styles.thHover : {})
                  }}
                  onClick={() => handleSort('einheit')}
                  onMouseEnter={() => setHoveredHeader('einheit')}
                  onMouseLeave={() => setHoveredHeader(null)}
                >
                  Einheit <span style={styles.sortIcon}>{getSortIcon('einheit')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((item, index) => (
                <tr 
                  key={`${item.order_id}-${item.order_article_id}-${item.bom_detail_id || index}`}
                  style={hoveredRow === index ? styles.trHover : {}}
                  onMouseEnter={() => setHoveredRow(index)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={styles.td}>
                    <span 
                      style={onNavigateToOrder ? styles.orderLink : {}}
                      onClick={() => onNavigateToOrder && onNavigateToOrder(item.order_id)}
                    >
                      {item.order_name}
                    </span>
                  </td>
                  <td style={styles.td}>{item.order_article_number}</td>
                  <td style={styles.td}>
                    {item.bom_article_number || '-'}
                    <span style={getMatchBadgeStyle(item.match_source)}>
                      {getMatchLabel(item.match_source)}
                    </span>
                  </td>
                  <td style={styles.td}>{item.bom_article_description || '-'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {item.bom_quantity !== null ? item.bom_quantity.toLocaleString('de-DE') : '-'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {item.einzelmass !== null ? item.einzelmass.toFixed(2) : '-'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {item.gesamtmenge !== null ? item.gesamtmenge.toFixed(2) : '-'}
                  </td>
                  <td style={styles.td}>
                    {item.einheit || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
