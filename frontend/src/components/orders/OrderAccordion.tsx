/**
 * Order Accordion Component
 * Single order row with expand/collapse functionality - Level 1
 */
import React, { useState, useEffect } from 'react'
import { OrderOverviewItem, HierarchyRemark} from '../../services/types'
import OrderArticlesPanel from './OrderArticlesPanel'
import remarksApi from '../../services/remarksApi'

interface OrderAccordionProps {
  order: OrderOverviewItem
  isExpanded: boolean
  isSelected: boolean
  onToggle: () => void
  onSelect: (selected: boolean) => void
  preloadedRemark?: HierarchyRemark
  onRemarkChange?: (remark: HierarchyRemark | null) => void
}

const styles = {
  container: {
    marginBottom: '1px'
  },
  row: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    border: '1px solid #e0e0e0',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  rowExpanded: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#f8f9fa',
    border: '1px solid #c0c0c0',
    borderRadius: '3px 3px 0 0',
    cursor: 'pointer'
  },
  checkboxCell: {
    width: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
    borderRight: '1px solid #e0e0e0'
  },
  expandCell: {
    width: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRight: '1px solid #e0e0e0',
    fontSize: '12px',
    color: '#666666'
  },
  expandCellEmpty: {
    width: '30px',
    backgroundColor: '#f5f5f5',
    borderRight: '1px solid #e0e0e0'
  },
  cell: {
    padding: '8px 10px',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    color: '#333333',
    borderRight: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'center'
  },
  cellPos: {
    width: '45px',
    textAlign: 'center' as const,
    color: '#999999',
    fontSize: '11px'
  },
  cellAuftrag: {
    width: '120px',
    fontWeight: 'bold' as const,
    color: '#333333'
  },
  cellKunde: {
    width: '150px'
  },
  cellText: {
    flex: 1,
    minWidth: '150px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  cellDate: {
    width: '95px',
    textAlign: 'center' as const
  },
  cellResponsible: {
    width: '80px',
    textAlign: 'center' as const
  },
  cellStatus: {
    width: '100px'
  },
  cellRemark: {
    width: '200px',
    fontSize: '11px'
  },
  remarkText: {
    fontWeight: 'bold' as const,
    color: '#666666',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '180px',
    display: 'inline-block'
  },
  remarkInput: {
    width: '100%',
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '4px 6px',
    fontSize: '11px'
  },
  detailPanel: {
    backgroundColor: '#fafafa',
    border: '1px solid #c0c0c0',
    borderTop: 'none',
    borderRadius: '0 0 3px 3px',
    padding: '10px'
  },
  dateOverdue: {
    backgroundColor: '#ffcccc',
    padding: '2px 6px',
    borderRadius: '3px'
  },
  dateWarning: {
    backgroundColor: '#ffe0b3',
    padding: '2px 6px',
    borderRadius: '3px'
  },
  dateSoon: {
    backgroundColor: '#ffffcc',
    padding: '2px 6px',
    borderRadius: '3px'
  }
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

const getDateStyle = (dateStr: string | null) => {
  if (!dateStr) return {}
  try {
    const date = new Date(dateStr)
    const today = new Date()
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return styles.dateOverdue
    if (diffDays <= 7) return styles.dateWarning
    if (diffDays <= 14) return styles.dateSoon
    return {}
  } catch {
    return {}
  }
}

const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export default function OrderAccordion({ order, isExpanded, isSelected, onToggle, onSelect, preloadedRemark, onRemarkChange }: OrderAccordionProps) {
  // Use preloaded remark if available, otherwise local state
  const [localRemark, setLocalRemark] = useState<HierarchyRemark | null>(null)
  const remark = preloadedRemark !== undefined ? preloadedRemark : localRemark
  const [editingRemark, setEditingRemark] = useState(false)
  const [remarkText, setRemarkText] = useState('')

  // Only fetch remark if not preloaded (fallback for backwards compatibility)
  useEffect(() => {
    // Skip if preloaded remark is available
    if (preloadedRemark !== undefined) return
    
    if (order.order_id) {
      remarksApi.getRemark('order', order.order_id).then((r) => {
        setLocalRemark(r)
      }).catch(() => {
        // Silently ignore errors for individual remark fetch
      })
    }
  }, [order.order_id, preloadedRemark])

  // Helper to update remark (either via callback or local state)
  const updateRemark = (newRemark: HierarchyRemark | null) => {
    if (onRemarkChange) {
      onRemarkChange(newRemark)
    } else {
      setLocalRemark(newRemark)
    }
  }

  const handleRemarkSave = async () => {
    if (!order.order_id) return
    if (remarkText.trim()) {
      const saved = await remarksApi.saveRemark({
        level_type: 'order',
        hugwawi_id: order.order_id,
        remark: remarkText.trim()
      })
      updateRemark(saved)
    } else if (remark) {
      await remarksApi.deleteRemark(remark.id)
      updateRemark(null)
    }
    setEditingRemark(false)
  }

  const handleRemarkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRemarkText(remark?.remark || '')
    setEditingRemark(true)
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div style={styles.container}>
      <div
        style={isExpanded ? styles.rowExpanded : styles.row}
        onClick={onToggle}
        onMouseEnter={(e) => {
          if (!isExpanded) {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5'
          }
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'
          }
        }}
      >
        {/* Checkbox */}
        <div style={styles.checkboxCell} onClick={handleCheckboxClick}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
          />
        </div>

        {/* Expand Arrow - only show if has_articles */}
        {order.has_articles ? (
          <div style={styles.expandCell}>
            {isExpanded ? '▼' : '▶'}
          </div>
        ) : (
          <div style={styles.expandCellEmpty} />
        )}
        
        <div style={{ ...styles.cell, ...styles.cellPos }}>
          {order.pos}
        </div>
        
        <div style={{ ...styles.cell, ...styles.cellAuftrag }}>
          {order.auftrag || '-'}
        </div>
        
        <div style={{ ...styles.cell, ...styles.cellKunde }}>
          {order.kunde || '-'}
        </div>
        
        <div style={{ ...styles.cell, ...styles.cellText }} title={order.au_text || ''}>
          {order.au_text || '-'}
        </div>
        
        <div style={{ ...styles.cell, ...styles.cellDate }}>
          <span style={getDateStyle(order.lt_hg_bestaetigt)}>
            {formatDate(order.lt_hg_bestaetigt)}
          </span>
        </div>
        
        <div style={{ ...styles.cell, ...styles.cellDate }}>
          {formatDate(order.lt_kundenwunsch)}
        </div>
        
        <div style={{ ...styles.cell, ...styles.cellResponsible }}>
          {order.au_verantwortlich || '-'}
        </div>
        
        <div style={{ ...styles.cell, ...styles.cellStatus }}>
          {order.status_name || '-'}
        </div>

        {/* Remark Cell */}
        <div style={{ ...styles.cell, ...styles.cellRemark, borderRight: 'none' }} onClick={handleRemarkClick}>
          {editingRemark ? (
            <input
              type="text"
              style={styles.remarkInput}
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              onBlur={handleRemarkSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRemarkSave()
                if (e.key === 'Escape') setEditingRemark(false)
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              placeholder="Bemerkung eingeben..."
            />
          ) : remark ? (
            <span style={styles.remarkText} title={remark.remark}>
              **{truncateText(remark.remark)}**
            </span>
          ) : (
            <span style={{ color: '#ccc', fontSize: '11px' }}>+ Bemerkung</span>
          )}
        </div>
      </div>
      
      {isExpanded && order.order_id && order.has_articles && (
        <div style={styles.detailPanel}>
          <OrderArticlesPanel orderId={order.order_id} />
        </div>
      )}
    </div>
  )
}
