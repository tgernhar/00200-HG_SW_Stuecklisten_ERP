/**
 * Stücklisten Table Component (Left Panel)
 * Shows list of articles that have BOMs
 */
import React, { useState } from 'react'
import { StuecklisteItem } from '../../services/stuecklistenApi'

interface StuecklistenTableProps {
  items: StuecklisteItem[]
  selectedItem: StuecklisteItem | null
  onSelect: (item: StuecklisteItem) => void
  loading: boolean
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
    overflowY: 'auto' as const
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px',
    fontFamily: 'Arial, sans-serif'
  },
  th: {
    backgroundColor: '#e8e8e8',
    padding: '6px 8px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #cccccc',
    fontWeight: 'bold' as const,
    position: 'sticky' as const,
    top: 0
  },
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid #eeeeee',
    verticalAlign: 'top' as const
  },
  row: {
    cursor: 'pointer'
  },
  rowHover: {
    backgroundColor: '#f0f7ff'
  },
  rowSelected: {
    backgroundColor: '#cce5ff'
  },
  articleCell: {
    maxWidth: '300px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '5px'
  },
  button: {
    padding: '2px 6px',
    fontSize: '10px',
    border: '1px solid #cccccc',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer'
  },
  buttonHover: {
    backgroundColor: '#e0e0e0'
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
  }
}

export default function StuecklistenTable({
  items,
  selectedItem,
  onSelect,
  loading
}: StuecklistenTableProps) {
  const [hoveredIdx, setHoveredIdx] = useState(-1)
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>Stückliste</div>
      
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Artikel</th>
              <th style={{ ...styles.th, width: '150px' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} style={styles.loading}>
                  Lade Daten...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={2} style={styles.noResults}>
                  Diese Suche brachte keine Ergebnisse!
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const isSelected = selectedItem?.packingnote_id === item.packingnote_id
                const isHovered = hoveredIdx === idx
                
                return (
                  <tr
                    key={`${item.article_id}-${item.packingnote_id}`}
                    style={{
                      ...styles.row,
                      ...(isSelected ? styles.rowSelected : {}),
                      ...(isHovered && !isSelected ? styles.rowHover : {})
                    }}
                    onClick={() => onSelect(item)}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(-1)}
                  >
                    <td style={{ ...styles.td, ...styles.articleCell }}>
                      {item.article_display} - ({item.description || ''})
                    </td>
                    <td style={styles.td}>
                      <div style={styles.buttonGroup}>
                        <button
                          style={{
                            ...styles.button,
                            ...(hoveredButton === `vorsch-${idx}` ? styles.buttonHover : {})
                          }}
                          onMouseEnter={() => setHoveredButton(`vorsch-${idx}`)}
                          onMouseLeave={() => setHoveredButton(null)}
                          onClick={e => { e.stopPropagation() }}
                        >
                          Vorsch.
                        </button>
                        <button
                          style={{
                            ...styles.button,
                            ...(hoveredButton === `open-${idx}` ? styles.buttonHover : {})
                          }}
                          onMouseEnter={() => setHoveredButton(`open-${idx}`)}
                          onMouseLeave={() => setHoveredButton(null)}
                          onClick={e => { e.stopPropagation() }}
                        >
                          Öffnen
                        </button>
                        <button
                          style={{
                            ...styles.button,
                            ...(hoveredButton === `delete-${idx}` ? styles.buttonHover : {})
                          }}
                          onMouseEnter={() => setHoveredButton(`delete-${idx}`)}
                          onMouseLeave={() => setHoveredButton(null)}
                          onClick={e => { e.stopPropagation() }}
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
