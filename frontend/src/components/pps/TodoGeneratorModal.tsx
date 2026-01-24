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
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [includeWorkplan, setIncludeWorkplan] = useState(true)
  const [hoveredOrderId, setHoveredOrderId] = useState<number | null>(null)

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

  // Handle generate
  const handleGenerate = async () => {
    if (!selectedOrderId) return
    
    setGenerating(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const result = await generateTodos({
        erp_order_id: selectedOrderId,
        include_workplan: includeWorkplan,
      })
      
      if (result.success) {
        setSuccessMessage(
          `Erfolgreich: ${result.created_todos} ToDos und ${result.created_dependencies} Abhängigkeiten erstellt` +
          (result.order_name ? ` für ${result.order_name}` : '')
        )
        
        // Wait a moment then close
        setTimeout(() => {
          onSuccess()
        }, 1500)
      } else {
        setError(result.errors.join(', ') || 'Unbekannter Fehler')
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
                    ...(selectedOrderId === order.order_id ? styles.orderItemSelected : {}),
                    ...(hoveredOrderId === order.order_id && selectedOrderId !== order.order_id ? styles.orderItemHover : {}),
                    ...(order.has_todos ? styles.orderItemWithTodos : {}),
                  }}
                  onClick={() => setSelectedOrderId(order.order_id)}
                  onMouseEnter={() => setHoveredOrderId(order.order_id)}
                  onMouseLeave={() => setHoveredOrderId(null)}
                >
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
              ))
            )}
          </div>

          {/* Options */}
          {selectedOrderId && (
            <div style={styles.options}>
              <label style={styles.optionLabel}>
                <input
                  type="checkbox"
                  checked={includeWorkplan}
                  onChange={e => setIncludeWorkplan(e.target.checked)}
                />
                Arbeitspläne einbeziehen (Arbeitsgänge als ToDos)
              </label>
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
              ...((!selectedOrderId || generating) ? styles.buttonDisabled : {}),
            }}
            onClick={handleGenerate}
            disabled={!selectedOrderId || generating}
          >
            {generating ? 'Generiere...' : 'Generieren'}
          </button>
        </div>
      </div>
    </div>
  )
}
