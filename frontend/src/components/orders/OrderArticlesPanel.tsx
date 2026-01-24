/**
 * Order Articles Panel Component
 * Displays order articles (Auftragsartikel) for an order - Level 2
 */
import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { OrderArticleItem } from '../../services/types'
import BomPanel from './BomPanel'

interface OrderArticlesPanelProps {
  orderId: number
}

const styles = {
  container: {
    marginLeft: '20px',
    marginTop: '8px',
    marginBottom: '8px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #dddddd',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  header: {
    backgroundColor: '#eeeeee',
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#555555',
    borderBottom: '1px solid #dddddd'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px'
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left' as const,
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #dddddd',
    fontWeight: 'bold' as const,
    color: '#666666'
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid #eeeeee',
    color: '#333333',
    verticalAlign: 'top' as const
  },
  expandButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 6px',
    fontSize: '14px',
    color: '#4a90d9'
  },
  loading: {
    padding: '15px',
    textAlign: 'center' as const,
    color: '#666666',
    fontSize: '12px'
  },
  empty: {
    padding: '15px',
    textAlign: 'center' as const,
    color: '#999999',
    fontSize: '12px',
    fontStyle: 'italic' as const
  },
  error: {
    padding: '15px',
    color: '#cc0000',
    fontSize: '12px'
  },
  statusBadge: {
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 'bold' as const
  }
}

const getStatusStyle = (status: string | null) => {
  if (!status) return { backgroundColor: '#e0e0e0', color: '#666666' }
  const lower = status.toLowerCase()
  if (lower.includes('fertig') || lower.includes('geliefert')) {
    return { backgroundColor: '#d4edda', color: '#155724' }
  }
  if (lower.includes('offen') || lower.includes('neu')) {
    return { backgroundColor: '#fff3cd', color: '#856404' }
  }
  if (lower.includes('fertigung') || lower.includes('arbeit')) {
    return { backgroundColor: '#cce5ff', color: '#004085' }
  }
  return { backgroundColor: '#e0e0e0', color: '#666666' }
}

export default function OrderArticlesPanel({ orderId }: OrderArticlesPanelProps) {
  const [items, setItems] = useState<OrderArticleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(`/orders/${orderId}/articles`)
        setItems(response.data.items || [])
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Fehler beim Laden')
        console.error('Error loading order articles:', err)
      } finally {
        setLoading(false)
      }
    }

    loadArticles()
  }, [orderId])

  const toggleExpand = (orderArticleId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(orderArticleId)) {
        next.delete(orderArticleId)
      } else {
        next.add(orderArticleId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Auftragsartikel...</div>
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
        <div style={styles.empty}>Keine Auftragsartikel vorhanden</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Auftragsartikel ({items.length} Positionen)</div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '30px' }}></th>
            <th style={{ ...styles.th, width: '60px' }}>Pos.</th>
            <th style={{ ...styles.th, width: '130px' }}>Artikelnummer</th>
            <th style={styles.th}>Bezeichnung</th>
            <th style={{ ...styles.th, width: '120px' }}>Teilenummer</th>
            <th style={{ ...styles.th, width: '70px', textAlign: 'right' as const }}>Los</th>
            <th style={{ ...styles.th, width: '110px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const hasPackingNote = item.packingnoteid !== null
            const isExpanded = item.order_article_id ? expandedItems.has(item.order_article_id) : false
            
            return (
              <React.Fragment key={item.order_article_id || index}>
                <tr style={{ backgroundColor: isExpanded ? '#f0f0f0' : 'transparent' }}>
                  <td style={styles.td}>
                    {hasPackingNote && item.order_article_id && (
                      <button
                        style={styles.expandButton}
                        onClick={() => toggleExpand(item.order_article_id!)}
                        title={isExpanded ? 'Stückliste ausblenden' : 'Stückliste anzeigen'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                  </td>
                  <td style={styles.td}>{item.pos || '-'}</td>
                  <td style={styles.td}>{item.articlenumber || '-'}</td>
                  <td style={styles.td}>{item.description || '-'}</td>
                  <td style={styles.td}>{item.sparepart || '-'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {item.batchsize !== null ? item.batchsize : '-'}
                  </td>
                  <td style={styles.td}>
                    {item.status_name && (
                      <span style={{ ...styles.statusBadge, ...getStatusStyle(item.status_name) }}>
                        {item.status_name}
                      </span>
                    )}
                  </td>
                </tr>
                {isExpanded && item.order_article_id && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0, backgroundColor: '#fafafa' }}>
                      <BomPanel orderArticleId={item.order_article_id} />
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
