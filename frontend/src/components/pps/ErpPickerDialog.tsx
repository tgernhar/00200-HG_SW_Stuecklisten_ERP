/**
 * ERP Picker Dialog - Modal for selecting ERP items to create todos from
 * 
 * Used to select:
 * - Auftragsartikel (order articles)
 * - Stücklistenartikel (BOM items)
 * - Arbeitsgänge (worksteps)
 */
import React, { useState, useEffect } from 'react'
import {
  OrderArticleOption,
  BomItemOption,
  WorkstepOption,
} from '../../services/ppsTypes'
import {
  getOrderArticles,
  getArticleBomItems,
  getBomWorksteps,
} from '../../services/ppsApi'

export type PickerType = 'article' | 'bom' | 'workstep'

interface ErpPickerDialogProps {
  type: PickerType
  parentId: number  // order_id for articles, article_id for bom, bom_id for worksteps
  onClose: () => void
  onSelect: (selectedIds: number[], selectedItems: Array<OrderArticleOption | BomItemOption | WorkstepOption>) => void
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,  // Higher than TodoEditDialog
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '500px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '12px 16px',
    backgroundColor: '#2196f3',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  body: {
    padding: '16px',
    overflow: 'auto',
    flex: 1,
  },
  listContainer: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  listItemHover: {
    backgroundColor: '#f5f5f5',
  },
  listItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  listItemDisabled: {
    backgroundColor: '#fafafa',
    color: '#999',
    cursor: 'not-allowed',
  },
  checkbox: {
    marginRight: '12px',
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontWeight: 500,
    marginBottom: '2px',
  },
  itemSubtitle: {
    fontSize: '12px',
    color: '#666',
  },
  hasTodoBadge: {
    fontSize: '11px',
    padding: '2px 6px',
    backgroundColor: '#4caf50',
    color: 'white',
    borderRadius: '10px',
    marginLeft: '8px',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCount: {
    fontSize: '14px',
    color: '#666',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    border: 'none',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    color: '#333',
    border: '1px solid #ddd',
  },
  selectButton: {
    backgroundColor: '#4caf50',
    color: 'white',
  },
  selectButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  loading: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#666',
  },
  empty: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#999',
  },
}

export default function ErpPickerDialog({
  type,
  parentId,
  onClose,
  onSelect,
}: ErpPickerDialogProps) {
  const [items, setItems] = useState<Array<OrderArticleOption | BomItemOption | WorkstepOption>>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  // Load items based on type
  useEffect(() => {
    const loadItems = async () => {
      setLoading(true)
      setError(null)
      try {
        let data: Array<OrderArticleOption | BomItemOption | WorkstepOption> = []
        switch (type) {
          case 'article':
            data = await getOrderArticles(parentId)
            break
          case 'bom':
            data = await getArticleBomItems(parentId)
            break
          case 'workstep':
            data = await getBomWorksteps(parentId)
            break
        }
        setItems(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden')
      } finally {
        setLoading(false)
      }
    }
    loadItems()
  }, [type, parentId])

  const getTitle = () => {
    switch (type) {
      case 'article':
        return 'Auftragsartikel auswählen'
      case 'bom':
        return 'Stücklistenartikel auswählen'
      case 'workstep':
        return 'Arbeitsgänge auswählen'
    }
  }

  const getEmptyMessage = () => {
    switch (type) {
      case 'article':
        return 'Keine Auftragsartikel gefunden'
      case 'bom':
        return 'Keine Stücklistenartikel gefunden'
      case 'workstep':
        return 'Keine Arbeitsgänge gefunden'
    }
  }

  const toggleSelection = (id: number, hasTodo: boolean) => {
    if (hasTodo) return  // Don't allow selecting items that already have todos
    
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    const newSelected = new Set<number>()
    items.forEach(item => {
      if (!item.has_todo) {
        newSelected.add(item.id)
      }
    })
    setSelectedIds(newSelected)
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleConfirm = () => {
    const selectedItems = items.filter(item => selectedIds.has(item.id))
    onSelect(Array.from(selectedIds), selectedItems)
  }

  const renderItem = (item: OrderArticleOption | BomItemOption | WorkstepOption) => {
    const isSelected = selectedIds.has(item.id)
    const isHovered = hoveredId === item.id
    
    let itemStyle = { ...styles.listItem }
    if (item.has_todo) {
      itemStyle = { ...itemStyle, ...styles.listItemDisabled }
    } else if (isSelected) {
      itemStyle = { ...itemStyle, ...styles.listItemSelected }
    } else if (isHovered) {
      itemStyle = { ...itemStyle, ...styles.listItemHover }
    }

    // Get display info based on type
    let title = ''
    let subtitle = ''
    
    if ('articlenumber' in item) {
      // OrderArticleOption or BomItemOption
      title = `${item.position ? `Pos ${item.position}: ` : ''}${item.articlenumber}`
      subtitle = item.description || ''
      if (item.quantity) {
        subtitle += subtitle ? ` | Menge: ${item.quantity}` : `Menge: ${item.quantity}`
      }
    } else if ('name' in item) {
      // WorkstepOption
      title = `${item.position ? `AG ${item.position}: ` : ''}${item.name}`
      if (item.machine_name) {
        title += ` (${item.machine_name})`
      }
      const times: string[] = []
      if (item.setuptime) times.push(`Rüstzeit: ${item.setuptime} min`)
      if (item.unittime) times.push(`Stückzeit: ${item.unittime} min`)
      subtitle = times.join(' | ')
    }

    return (
      <div
        key={item.id}
        style={itemStyle}
        onClick={() => toggleSelection(item.id, item.has_todo)}
        onMouseEnter={() => setHoveredId(item.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={item.has_todo}
          onChange={() => toggleSelection(item.id, item.has_todo)}
          style={styles.checkbox}
        />
        <div style={styles.itemContent}>
          <div style={styles.itemTitle}>
            {title}
            {item.has_todo && <span style={styles.hasTodoBadge}>Todo existiert</span>}
          </div>
          {subtitle && <div style={styles.itemSubtitle}>{subtitle}</div>}
        </div>
      </div>
    )
  }

  const availableCount = items.filter(i => !i.has_todo).length

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.headerText}>{getTitle()}</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {loading && <div style={styles.loading}>Lade...</div>}
          
          {error && <div style={{ ...styles.empty, color: '#f44336' }}>{error}</div>}
          
          {!loading && !error && items.length === 0 && (
            <div style={styles.empty}>{getEmptyMessage()}</div>
          )}
          
          {!loading && !error && items.length > 0 && (
            <>
              {/* Select all / Deselect all */}
              <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                <button
                  style={{ ...styles.button, ...styles.cancelButton, padding: '4px 8px', fontSize: '12px' }}
                  onClick={selectAll}
                  disabled={availableCount === 0}
                >
                  Alle auswählen
                </button>
                <button
                  style={{ ...styles.button, ...styles.cancelButton, padding: '4px 8px', fontSize: '12px' }}
                  onClick={deselectAll}
                  disabled={selectedIds.size === 0}
                >
                  Auswahl aufheben
                </button>
              </div>
              
              <div style={styles.listContainer}>
                {items.map(renderItem)}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.selectedCount}>
            {selectedIds.size} von {availableCount} ausgewählt
          </span>
          <div style={styles.buttonGroup}>
            <button
              style={{ ...styles.button, ...styles.cancelButton }}
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              style={{
                ...styles.button,
                ...styles.selectButton,
                ...(selectedIds.size === 0 ? styles.selectButtonDisabled : {}),
              }}
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
            >
              Todos erstellen ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
