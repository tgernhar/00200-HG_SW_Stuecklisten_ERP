/**
 * Todo Generator Modal - Generate todos from ERP orders
 * 
 * Allows selecting an order and generating planning todos
 */
import React, { useState, useEffect, useCallback } from 'react'
import { getAvailableOrders, generateTodos } from '../../services/ppsApi'
import { AvailableOrder } from '../../services/ppsTypes'

interface TodoGeneratorModalProps {
  onClose: () => void
  onSuccess: () => void
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
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    padding: '15px 20px',
    borderBottom: '1px solid #dddddd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#333333',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666666',
    padding: '0',
    lineHeight: 1,
  },
  body: {
    padding: '20px',
    overflow: 'auto',
    flex: 1,
  },
  searchContainer: {
    marginBottom: '15px',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #cccccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
  },
  filterRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
  },
  filterCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  orderList: {
    border: '1px solid #dddddd',
    borderRadius: '4px',
    maxHeight: '300px',
    overflow: 'auto',
  },
  orderItem: {
    padding: '10px 12px',
    borderBottom: '1px solid #eeeeee',
    cursor: 'pointer',
    fontSize: '12px',
  },
  orderItemSelected: {
    backgroundColor: '#e8f4ff',
  },
  orderItemHover: {
    backgroundColor: '#f5f5f5',
  },
  orderItemWithTodos: {
    backgroundColor: '#f9fff9',
  },
  orderName: {
    fontWeight: 'bold' as const,
    color: '#333333',
  },
  orderMeta: {
    color: '#666666',
    marginTop: '4px',
    display: 'flex',
    gap: '15px',
  },
  todosBadge: {
    backgroundColor: '#90EE90',
    color: '#333333',
    padding: '1px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    marginLeft: '8px',
  },
  noOrders: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#666666',
    fontSize: '13px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#666666',
  },
  options: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  footer: {
    padding: '15px 20px',
    borderTop: '1px solid #dddddd',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  button: {
    padding: '8px 16px',
    border: '1px solid #cccccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    backgroundColor: '#ffffff',
  },
  buttonPrimary: {
    padding: '8px 16px',
    border: '1px solid #357abd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    backgroundColor: '#4a90d9',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    padding: '10px',
    backgroundColor: '#ffeeee',
    color: '#cc0000',
    borderRadius: '4px',
    fontSize: '12px',
    marginTop: '10px',
  },
  success: {
    padding: '10px',
    backgroundColor: '#eeffee',
    color: '#006600',
    borderRadius: '4px',
    fontSize: '12px',
    marginTop: '10px',
  },
}

export default function TodoGeneratorModal({
  onClose,
  onSuccess,
}: TodoGeneratorModalProps) {
  const [orders, setOrders] = useState<AvailableOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [showOnlyNew, setShowOnlyNew] = useState(true)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set())
  const [includeWorkplan, setIncludeWorkplan] = useState(true)  // Default: on - Arbeitsgänge importieren
  const [includeBomItems, setIncludeBomItems] = useState(false)  // Default: off
  const [workplanLevel, setWorkplanLevel] = useState(1)  // Default: Level 1 (CNC-Maschinen)
  const [hoveredOrderId, setHoveredOrderId] = useState<number | null>(null)

  // Toggle order selection
  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  // Select all visible orders
  const selectAll = () => {
    setSelectedOrderIds(new Set(orders.map(o => o.order_id)))
  }

  // Deselect all
  const deselectAll = () => {
    setSelectedOrderIds(new Set())
  }

  // Load orders
  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await getAvailableOrders({
        search: search || undefined,
        has_todos: showOnlyNew ? false : undefined,
      })
      setOrders(response)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [search, showOnlyNew])

  // Load on mount and filter change
  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Handle generate - now supports multiple orders
  const handleGenerate = async () => {
    if (selectedOrderIds.size === 0) return
    
    setGenerating(true)
    setError(null)
    setSuccessMessage(null)
    
    let totalTodos = 0
    let totalDependencies = 0
    const orderNames: string[] = []
    const errors: string[] = []
    
    try {
      // Process each selected order
      for (const orderId of selectedOrderIds) {
        try {
          const result = await generateTodos({
            erp_order_id: orderId,
            include_workplan: includeWorkplan,
            include_bom_items: includeBomItems,
            workplan_level: workplanLevel,
          })
          
          if (result.success) {
            totalTodos += result.created_todos
            totalDependencies += result.created_dependencies
            if (result.order_name) {
              orderNames.push(result.order_name)
            }
          } else {
            errors.push(...result.errors)
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : `Fehler bei Auftrag ${orderId}`
          errors.push(message)
        }
      }
      
      if (errors.length > 0) {
        setError(errors.join(', '))
      }
      
      if (totalTodos > 0 || totalDependencies > 0) {
        const orderInfo = orderNames.length <= 3 
          ? orderNames.join(', ') 
          : `${orderNames.slice(0, 3).join(', ')} und ${orderNames.length - 3} weitere`
        
        setSuccessMessage(
          `Erfolgreich: ${totalTodos} ToDos und ${totalDependencies} Abhängigkeiten erstellt` +
          (orderInfo ? ` für ${orderInfo}` : '')
        )
        
        // Wait a moment then close
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Generieren'
      setError(message)
    } finally {
      setGenerating(false)
    }
  }

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('de-DE')
    } catch {
      return dateStr
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>ToDos aus Auftrag generieren</span>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Search */}
          <div style={styles.searchContainer}>
            <input
              type="text"
              placeholder="Auftrag suchen (Nummer oder Kunde)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {/* Filters */}
          <div style={styles.filterRow}>
            <label style={styles.filterCheckbox}>
              <input
                type="checkbox"
                checked={showOnlyNew}
                onChange={e => setShowOnlyNew(e.target.checked)}
              />
              Nur Aufträge ohne ToDos
            </label>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>
              {selectedOrderIds.size > 0 && `${selectedOrderIds.size} ausgewählt`}
            </span>
            <button
              style={{ ...styles.button, padding: '4px 8px', fontSize: '11px' }}
              onClick={selectAll}
              disabled={orders.length === 0}
            >
              Alle auswählen
            </button>
            <button
              style={{ ...styles.button, padding: '4px 8px', fontSize: '11px' }}
              onClick={deselectAll}
              disabled={selectedOrderIds.size === 0}
            >
              Auswahl aufheben
            </button>
          </div>

          {/* Order list */}
          <div style={styles.orderList}>
            {loading ? (
              <div style={styles.loading}>Lade Aufträge...</div>
            ) : orders.length === 0 ? (
              <div style={styles.noOrders}>
                Keine Aufträge gefunden
              </div>
            ) : (
              orders.map(order => (
                <div
                  key={order.order_id}
                  style={{
                    ...styles.orderItem,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    ...(selectedOrderIds.has(order.order_id) ? styles.orderItemSelected : {}),
                    ...(hoveredOrderId === order.order_id && !selectedOrderIds.has(order.order_id) ? styles.orderItemHover : {}),
                    ...(order.has_todos ? styles.orderItemWithTodos : {}),
                  }}
                  onClick={() => toggleOrderSelection(order.order_id)}
                  onMouseEnter={() => setHoveredOrderId(order.order_id)}
                  onMouseLeave={() => setHoveredOrderId(null)}
                >
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.has(order.order_id)}
                    onChange={() => toggleOrderSelection(order.order_id)}
                    onClick={e => e.stopPropagation()}
                    style={{ marginTop: '2px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div>
                      <span style={styles.orderName}>{order.order_name}</span>
                      {order.has_todos && (
                        <span style={styles.todosBadge}>
                          {order.todo_count} ToDos
                        </span>
                      )}
                    </div>
                    <div style={styles.orderMeta}>
                      <span>Kunde: {order.customer || '-'}</span>
                      <span>Liefertermin: {formatDate(order.delivery_date)}</span>
                      <span>Artikel: {order.article_count}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Options */}
          {selectedOrderIds.size > 0 && (
            <div style={styles.options}>
              <label style={styles.optionLabel}>
                <input
                  type="checkbox"
                  checked={includeBomItems}
                  onChange={e => setIncludeBomItems(e.target.checked)}
                />
                Stücklistenartikel einbeziehen (parallel starten)
              </label>
              <label style={{ ...styles.optionLabel, marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={includeWorkplan}
                  onChange={e => setIncludeWorkplan(e.target.checked)}
                />
                Arbeitspläne einbeziehen (Arbeitsgänge sequentiell als ToDos)
              </label>
              
              {/* Level Filter for workplan import */}
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Maschinen-Level:</span>
                <select
                  value={workplanLevel}
                  onChange={e => setWorkplanLevel(parseInt(e.target.value))}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    border: '1px solid #cccccc',
                    borderRadius: '3px',
                  }}
                >
                  <option value={1}>Level 1 - CNC-Maschinen</option>
                  <option value={2}>Level 2 - Hauptmaschinen / Konstruktion</option>
                  <option value={3}>Level 3 - Handmaschinen / Hilfsmittel</option>
                  <option value={4}>Level 4 - Seltene Maschinen</option>
                  <option value={5}>Level 5 - Spezielle Projekte</option>
                </select>
              </div>
            </div>
          )}

          {/* Messages */}
          {error && <div style={styles.error}>{error}</div>}
          {successMessage && <div style={styles.success}>{successMessage}</div>}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.button} onClick={onClose} disabled={generating}>
            Abbrechen
          </button>
          <button
            style={{
              ...styles.buttonPrimary,
              ...((selectedOrderIds.size === 0 || generating) ? styles.buttonDisabled : {}),
            }}
            onClick={handleGenerate}
            disabled={selectedOrderIds.size === 0 || generating}
          >
            {generating 
              ? 'Generiere...' 
              : selectedOrderIds.size > 1 
                ? `${selectedOrderIds.size} Aufträge generieren`
                : 'Generieren'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
