/**
 * Order Articles Panel Component
 * Displays order articles (Auftragsartikel) for an order - Level 2
 */
import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { OrderArticleItem, HierarchyRemark } from '../../services/types'
import BomPanel from './BomPanel'
import remarksApi from '../../services/remarksApi'

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
    borderBottom: '1px solid #dddddd',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
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
    verticalAlign: 'middle' as const
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
  },
  remarkText: {
    fontWeight: 'bold' as const,
    color: '#666666',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
    display: 'inline-block',
    fontSize: '11px'
  },
  remarkInput: {
    width: '100%',
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '3px 5px',
    fontSize: '11px'
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

const truncateText = (text: string, maxLength: number = 40): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export default function OrderArticlesPanel({ orderId }: OrderArticlesPanelProps) {
  const [items, setItems] = useState<OrderArticleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [remarks, setRemarks] = useState<Map<number, HierarchyRemark>>(new Map())
  const [editingRemark, setEditingRemark] = useState<number | null>(null)
  const [remarkText, setRemarkText] = useState('')

  useEffect(() => {
    let isMounted = true
    const MAX_RETRIES = 3
    const RETRY_DELAY = 500 // ms
    
    const loadArticles = async (retryCount = 0) => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(`/orders/${orderId}/articles`)
        
        // Check if component is still mounted
        if (!isMounted) return
        
        const loadedItems = response.data.items || []
        setItems(loadedItems)

        // Load remarks for all items
        const ids = loadedItems
          .map((i: OrderArticleItem) => i.order_article_id)
          .filter((id: number | null): id is number => id !== null)
        if (ids.length > 0 && isMounted) {
          const remarksResponse = await remarksApi.getRemarksByLevel('order_article', ids)
          if (isMounted) {
            const remarksMap = new Map<number, HierarchyRemark>()
            remarksResponse.items.forEach(r => remarksMap.set(r.hugwawi_id, r))
            setRemarks(remarksMap)
          }
        }
        if (isMounted) setLoading(false)
      } catch (err: any) {
        // Check if component is still mounted
        if (!isMounted) return
        
        // Retry on Network Error (timing issues)
        if (retryCount < MAX_RETRIES && (err.message === 'Network Error' || err.code === 'ERR_NETWORK')) {
          setTimeout(() => {
            if (isMounted) loadArticles(retryCount + 1)
          }, RETRY_DELAY * (retryCount + 1))
          return
        }
        
        setError(err.response?.data?.detail || 'Fehler beim Laden')
        console.error('Error loading order articles:', err)
        setLoading(false)
      }
    }

    loadArticles()
    
    // Cleanup function to prevent state updates on unmounted component
    return () => { isMounted = false }
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

  const toggleSelect = (orderArticleId: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(orderArticleId)) {
        next.delete(orderArticleId)
      } else {
        next.add(orderArticleId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set())
    } else {
      const allIds = items
        .map(i => i.order_article_id)
        .filter((id): id is number => id !== null)
      setSelectedItems(new Set(allIds))
    }
  }

  const handleRemarkSave = async (orderArticleId: number) => {
    if (remarkText.trim()) {
      const saved = await remarksApi.saveRemark({
        level_type: 'order_article',
        hugwawi_id: orderArticleId,
        remark: remarkText.trim()
      })
      setRemarks(prev => new Map(prev).set(orderArticleId, saved))
    } else {
      const existing = remarks.get(orderArticleId)
      if (existing) {
        await remarksApi.deleteRemark(existing.id)
        setRemarks(prev => {
          const next = new Map(prev)
          next.delete(orderArticleId)
          return next
        })
      }
    }
    setEditingRemark(null)
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
      <div style={styles.header}>
        <input
          type="checkbox"
          checked={selectedItems.size === items.length && items.length > 0}
          onChange={toggleSelectAll}
          title="Alle auswählen"
        />
        <span>Auftragsartikel ({items.length} Positionen)</span>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '30px' }}></th>
            <th style={{ ...styles.th, width: '30px' }}></th>
            <th style={{ ...styles.th, width: '60px' }}>Pos.</th>
            <th style={{ ...styles.th, width: '130px' }}>Artikelnummer</th>
            <th style={styles.th}>Bezeichnung</th>
            <th style={{ ...styles.th, width: '120px' }}>Teilenummer</th>
            <th style={{ ...styles.th, width: '70px', textAlign: 'right' as const }}>Los</th>
            <th style={{ ...styles.th, width: '100px' }}>Status</th>
            <th style={{ ...styles.th, width: '170px' }}>Bemerkung</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const hasBom = item.has_bom
            const isExpanded = item.order_article_id ? expandedItems.has(item.order_article_id) : false
            const isSelected = item.order_article_id ? selectedItems.has(item.order_article_id) : false
            const remark = item.order_article_id ? remarks.get(item.order_article_id) : null
            const isEditingThis = editingRemark === item.order_article_id
            
            return (
              <React.Fragment key={item.order_article_id || index}>
                <tr style={{ backgroundColor: isExpanded ? '#f0f0f0' : 'transparent' }}>
                  {/* Checkbox */}
                  <td style={styles.td}>
                    {item.order_article_id && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.order_article_id!)}
                      />
                    )}
                  </td>
                  {/* Expand Button - only if has_bom */}
                  <td style={styles.td}>
                    {hasBom && item.order_article_id && (
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
                  {/* Remark Cell */}
                  <td style={styles.td}>
                    {isEditingThis ? (
                      <input
                        type="text"
                        style={styles.remarkInput}
                        value={remarkText}
                        onChange={(e) => setRemarkText(e.target.value)}
                        onBlur={() => item.order_article_id && handleRemarkSave(item.order_article_id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && item.order_article_id) handleRemarkSave(item.order_article_id)
                          if (e.key === 'Escape') setEditingRemark(null)
                        }}
                        autoFocus
                        placeholder="Bemerkung..."
                      />
                    ) : (
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setRemarkText(remark?.remark || '')
                          setEditingRemark(item.order_article_id)
                        }}
                      >
                        {remark ? (
                          <span style={styles.remarkText} title={remark.remark}>
                            **{truncateText(remark.remark)}**
                          </span>
                        ) : (
                          <span style={{ color: '#ccc', fontSize: '11px' }}>+ Bem.</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
                {isExpanded && item.order_article_id && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0, backgroundColor: '#fafafa' }}>
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
