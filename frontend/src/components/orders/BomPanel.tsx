/**
 * BOM Panel Component
 * Displays Stückliste (Bill of Materials) for an order article - Level 3
 */
import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { BomItem, HierarchyRemark } from '../../services/types'
import WorkplanPanel from './WorkplanPanel'
import remarksApi from '../../services/remarksApi'

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
    borderBottom: '1px solid #cce0f5',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
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
    verticalAlign: 'middle' as const
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
  remarkText: {
    fontWeight: 'bold' as const,
    color: '#666666',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '130px',
    display: 'inline-block',
    fontSize: '10px'
  },
  remarkInput: {
    width: '100%',
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '2px 4px',
    fontSize: '10px'
  }
}

const truncateText = (text: string, maxLength: number = 35): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export default function BomPanel({ orderArticleId }: BomPanelProps) {
  const [items, setItems] = useState<BomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [remarks, setRemarks] = useState<Map<number, HierarchyRemark>>(new Map())
  const [editingRemark, setEditingRemark] = useState<number | null>(null)
  const [remarkText, setRemarkText] = useState('')

  useEffect(() => {
    const loadBom = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(`/order-articles/${orderArticleId}/bom`)
        const loadedItems = response.data.items || []
        setItems(loadedItems)

        // Load remarks for all items
        const ids = loadedItems
          .map((i: BomItem) => i.detail_id)
          .filter((id: number | null): id is number => id !== null)
        if (ids.length > 0) {
          const remarksResponse = await remarksApi.getRemarksByLevel('bom_detail', ids)
          const remarksMap = new Map<number, HierarchyRemark>()
          remarksResponse.items.forEach(r => remarksMap.set(r.hugwawi_id, r))
          setRemarks(remarksMap)
        }
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

  const toggleSelect = (detailId: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(detailId)) {
        next.delete(detailId)
      } else {
        next.add(detailId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set())
    } else {
      const allIds = items
        .map(i => i.detail_id)
        .filter((id): id is number => id !== null)
      setSelectedItems(new Set(allIds))
    }
  }

  const handleRemarkSave = async (detailId: number) => {
    if (remarkText.trim()) {
      const saved = await remarksApi.saveRemark({
        level_type: 'bom_detail',
        hugwawi_id: detailId,
        remark: remarkText.trim()
      })
      setRemarks(prev => new Map(prev).set(detailId, saved))
    } else {
      const existing = remarks.get(detailId)
      if (existing) {
        await remarksApi.deleteRemark(existing.id)
        setRemarks(prev => {
          const next = new Map(prev)
          next.delete(detailId)
          return next
        })
      }
    }
    setEditingRemark(null)
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
      <div style={styles.header}>
        <input
          type="checkbox"
          checked={selectedItems.size === items.length && items.length > 0}
          onChange={toggleSelectAll}
          title="Alle auswählen"
        />
        <span>Stückliste ({items.length} Positionen)</span>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '25px' }}></th>
            <th style={{ ...styles.th, width: '25px' }}></th>
            <th style={{ ...styles.th, width: '70px' }}>Pos</th>
            <th style={{ ...styles.th, width: '110px' }}>Artikelnummer</th>
            <th style={styles.th}>Artikelbezeichnung</th>
            <th style={{ ...styles.th, width: '70px', textAlign: 'right' as const }}>AU-Menge</th>
            <th style={{ ...styles.th, width: '60px', textAlign: 'right' as const }}>Länge</th>
            <th style={{ ...styles.th, width: '60px', textAlign: 'right' as const }}>Breite</th>
            <th style={{ ...styles.th, width: '150px' }}>Bemerkung</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const level = calculateLevel(item, items)
            const hasWorkplan = item.has_workplan
            const isExpanded = item.detail_id ? expandedItems.has(item.detail_id) : false
            const isSelected = item.detail_id ? selectedItems.has(item.detail_id) : false
            const remark = item.detail_id ? remarks.get(item.detail_id) : null
            const isEditingThis = editingRemark === item.detail_id
            
            return (
              <React.Fragment key={item.detail_id || index}>
                <tr>
                  {/* Checkbox */}
                  <td style={styles.td}>
                    {item.detail_id && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.detail_id!)}
                      />
                    )}
                  </td>
                  {/* Expand Button - only if has_workplan */}
                  <td style={styles.td}>
                    {hasWorkplan && item.detail_id && (
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
                  {/* Remark Cell */}
                  <td style={styles.td}>
                    {isEditingThis ? (
                      <input
                        type="text"
                        style={styles.remarkInput}
                        value={remarkText}
                        onChange={(e) => setRemarkText(e.target.value)}
                        onBlur={() => item.detail_id && handleRemarkSave(item.detail_id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && item.detail_id) handleRemarkSave(item.detail_id)
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
                          setEditingRemark(item.detail_id)
                        }}
                      >
                        {remark ? (
                          <span style={styles.remarkText} title={remark.remark}>
                            **{truncateText(remark.remark)}**
                          </span>
                        ) : (
                          <span style={{ color: '#ccc', fontSize: '10px' }}>+ Bem.</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
                {isExpanded && item.detail_id && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0, backgroundColor: '#f5faff' }}>
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
