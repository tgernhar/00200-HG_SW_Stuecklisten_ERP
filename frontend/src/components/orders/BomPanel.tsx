/**
 * BOM Panel Component
 * Displays Stückliste (Bill of Materials) for an order article - Level 3
 */
import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { BomItem } from '../../services/types'
import WorkplanPanel from './WorkplanPanel'

interface BomPanelProps {
  orderArticleId: number
}

const styles = {
  container: {
    marginLeft: '30px',
    marginTop: '8px',
    marginBottom: '8px',
    backgroundColor: '#f0f7ff',
    border: '1px solid #cce0f5',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  header: {
    backgroundColor: '#e6f0fa',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#666666',
    borderBottom: '1px solid #cce0f5'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px'
  },
  th: {
    padding: '6px 8px',
    textAlign: 'left' as const,
    backgroundColor: '#f5faff',
    borderBottom: '1px solid #cce0f5',
    fontWeight: 'bold' as const,
    color: '#666666'
  },
  td: {
    padding: '5px 8px',
    borderBottom: '1px solid #e6f0fa',
    color: '#333333',
    verticalAlign: 'top' as const
  },
  expandButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 4px',
    fontSize: '12px',
    color: '#4a90d9'
  },
  loading: {
    padding: '10px',
    textAlign: 'center' as const,
    color: '#666666',
    fontSize: '11px'
  },
  empty: {
    padding: '10px',
    textAlign: 'center' as const,
    color: '#999999',
    fontSize: '11px',
    fontStyle: 'italic' as const
  },
  error: {
    padding: '10px',
    color: '#cc0000',
    fontSize: '11px'
  },
  levelIndicator: {
    display: 'inline-block',
    width: '12px',
    textAlign: 'center' as const
  }
}

export default function BomPanel({ orderArticleId }: BomPanelProps) {
  const [items, setItems] = useState<BomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  useEffect(() => {
    const loadBom = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(`/order-articles/${orderArticleId}/bom`)
        setItems(response.data.items || [])
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Fehler beim Laden')
        console.error('Error loading BOM:', err)
      } finally {
        setLoading(false)
      }
    }

    loadBom()
  }, [orderArticleId])

  const toggleExpand = (detailId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(detailId)) {
        next.delete(detailId)
      } else {
        next.add(detailId)
      }
      return next
    })
  }

  // Calculate nesting level from lft/rgt values
  const calculateLevel = (item: BomItem, allItems: BomItem[]): number => {
    if (!item.lft || !item.rgt) return 0
    let level = 0
    for (const other of allItems) {
      if (other.lft && other.rgt && other.lft < item.lft && other.rgt > item.rgt) {
        level++
      }
    }
    return level
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Stückliste...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>Keine Stückliste vorhanden</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Stückliste ({items.length} Positionen)</div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '30px' }}></th>
            <th style={{ ...styles.th, width: '80px' }}>Pos</th>
            <th style={{ ...styles.th, width: '120px' }}>Artikelnummer</th>
            <th style={styles.th}>Artikelbezeichnung</th>
            <th style={{ ...styles.th, width: '80px', textAlign: 'right' as const }}>AU-Menge</th>
            <th style={{ ...styles.th, width: '70px', textAlign: 'right' as const }}>Länge</th>
            <th style={{ ...styles.th, width: '70px', textAlign: 'right' as const }}>Breite</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const level = calculateLevel(item, items)
            const hasDetailId = item.detail_id !== null
            const isExpanded = item.detail_id ? expandedItems.has(item.detail_id) : false
            
            return (
              <React.Fragment key={item.detail_id || index}>
                <tr>
                  <td style={styles.td}>
                    {hasDetailId && (
                      <button
                        style={styles.expandButton}
                        onClick={() => item.detail_id && toggleExpand(item.detail_id)}
                        title={isExpanded ? 'Arbeitsplan ausblenden' : 'Arbeitsplan anzeigen'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                  </td>
                  <td style={{ ...styles.td, paddingLeft: `${8 + level * 12}px` }}>
                    {item.pos || '-'}
                  </td>
                  <td style={styles.td}>{item.articlenumber || '-'}</td>
                  <td style={styles.td}>{item.description || '-'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {item.cascaded_quantity !== null ? item.cascaded_quantity.toFixed(2) : '-'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {item.mass1 !== null ? item.mass1.toFixed(1) : '-'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {item.mass2 !== null ? item.mass2.toFixed(1) : '-'}
                  </td>
                </tr>
                {isExpanded && item.detail_id && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0, backgroundColor: '#f5faff' }}>
                      <WorkplanPanel detailId={item.detail_id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
