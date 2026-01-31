/**
 * BOM Content Table Component (Right Panel)
 * Shows BOM items with hierarchical position levels
 */
import React, { useState } from 'react'
import { BomContentItem } from '../../services/stuecklistenApi'

interface BomContentTableProps {
  items: BomContentItem[]
  loading: boolean
  parentArticleDisplay?: string
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#ffffff'
  },
  header: {
    backgroundColor: '#c0d8f0',
    padding: '6px 10px',
    fontWeight: 'bold' as const,
    fontSize: '12px',
    borderBottom: '1px solid #999999'
  },
  tableContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'auto' as const
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px',
    fontFamily: 'Arial, sans-serif',
    minWidth: '900px'
  },
  th: {
    backgroundColor: '#e8e8e8',
    padding: '6px 8px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #cccccc',
    fontWeight: 'bold' as const,
    position: 'sticky' as const,
    top: 0,
    whiteSpace: 'nowrap' as const
  },
  thCenter: {
    textAlign: 'center' as const
  },
  thRight: {
    textAlign: 'right' as const
  },
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid #eeeeee',
    verticalAlign: 'top' as const
  },
  tdCenter: {
    textAlign: 'center' as const
  },
  tdRight: {
    textAlign: 'right' as const
  },
  row: {
    cursor: 'default'
  },
  rowHover: {
    backgroundColor: '#f0f7ff'
  },
  checkbox: {
    width: '16px',
    height: '16px'
  },
  noResults: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#cc0000',
    fontWeight: 'bold' as const
  },
  loading: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#666666'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: '5px 10px',
    borderTop: '1px solid #cccccc',
    fontSize: '11px',
    backgroundColor: '#f5f5f5'
  }
}

// Helper to format numbers
const formatNumber = (value: number | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined) return ''
  return value.toFixed(decimals).replace('.', ',')
}

export default function BomContentTable({
  items,
  loading,
  parentArticleDisplay
}: BomContentTableProps) {
  const [hoveredIdx, setHoveredIdx] = useState(-1)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  
  const toggleRowSelection = (detailId: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(detailId)) {
        next.delete(detailId)
      } else {
        next.add(detailId)
      }
      return next
    })
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>Inhalt</div>
      
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '30px' }}></th>
              <th style={{ ...styles.th, width: '40px', ...styles.thCenter }}></th>
              <th style={{ ...styles.th, width: '40px', ...styles.thCenter }}></th>
              <th style={{ ...styles.th, width: '40px', ...styles.thCenter }}></th>
              <th style={{ ...styles.th, width: '40px', ...styles.thCenter }}></th>
              <th style={styles.th}>Artikel</th>
              <th style={{ ...styles.th, width: '70px', ...styles.thRight }}>Anzahl</th>
              <th style={{ ...styles.th, width: '90px', ...styles.thRight }}>Verschnittfal</th>
              <th style={{ ...styles.th, width: '70px', ...styles.thRight }}>EK</th>
              <th style={{ ...styles.th, width: '90px', ...styles.thRight }}>Verkaufsfakt</th>
              <th style={{ ...styles.th, width: '70px', ...styles.thRight }}>VK</th>
              <th style={{ ...styles.th, width: '70px', ...styles.thRight }}>MP</th>
              <th style={{ ...styles.th, width: '80px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} style={styles.loading}>
                  Lade Daten...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={13} style={styles.noResults}>
                  Diese Suche brachte keine Ergebnisse!
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const isHovered = hoveredIdx === idx
                const isSelected = selectedRows.has(item.detail_id)
                
                return (
                  <tr
                    key={item.detail_id}
                    style={{
                      ...styles.row,
                      ...(isHovered ? styles.rowHover : {})
                    }}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(-1)}
                  >
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        style={styles.checkbox}
                        checked={isSelected}
                        onChange={() => toggleRowSelection(item.detail_id)}
                      />
                    </td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>
                      {item.pos_level1 ?? ''}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>
                      {item.pos_level2 ?? ''}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>
                      {item.pos_level3 ?? ''}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>
                      {item.pos_level4 ?? ''}
                    </td>
                    <td style={styles.td}>
                      {item.article_display}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>
                      {formatNumber(item.nettoamount)}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>
                      {formatNumber(item.factor)}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>
                      {formatNumber(item.purchaseprice)}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>
                      {formatNumber(item.salesfactor)}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>
                      {/* VK - not mapped */}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>
                      {/* MP - not mapped */}
                    </td>
                    <td style={styles.td}>
                      {/* Status - not mapped */}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      
      <div style={styles.pagination}>
        <span>1-{items.length} of {items.length}</span>
        <span style={{ marginLeft: '20px' }}>Einträge pro Seite</span>
      </div>
    </div>
  )
}
