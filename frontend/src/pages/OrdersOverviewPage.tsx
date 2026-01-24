/**
 * Orders Overview Page
 * Hierarchical view of orders with accordion panels for
 * Auftragsartikel, Stücklisten and Arbeitspläne
 */
import React, { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { OrderOverviewItem, HierarchyRemark, ChildRemarksSummary, DeepSearchResultItem } from '../services/types'
import OrdersFilterBar, { FilterValues } from '../components/orders/OrdersFilterBar'
import OrderAccordion from '../components/orders/OrderAccordion'
import ChildRemarksPopup from '../components/orders/ChildRemarksPopup'
import DeepSearchResultsTable from '../components/orders/DeepSearchResultsTable'
import remarksApi from '../services/remarksApi'

const initialFilters: FilterValues = {
  dateFrom: '',
  dateTo: '',
  responsible: '',
  customer: '',
  orderName: '',
  text: '',
  reference: '',
  statusIds: [],  // Will be populated with default statuses on load
  articleSearch: '',
  workstepSearch: ''
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    padding: '10px',
    overflow: 'hidden'
  },
  header: {
    marginBottom: '10px'
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    marginBottom: '10px',
    fontFamily: 'Arial, sans-serif',
    color: '#333333'
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#f0f0f0',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    marginBottom: '5px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#666666'
  },
  headerCell: {
    padding: '8px 10px',
    borderRight: '1px solid #dddddd',
    display: 'flex',
    alignItems: 'center'
  },
  headerCheckbox: {
    width: '30px',
    backgroundColor: '#e8e8e8',
    borderRight: '1px solid #dddddd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerExpand: {
    width: '30px',
    backgroundColor: '#e8e8e8',
    borderRight: '1px solid #dddddd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerPos: {
    width: '45px',
    textAlign: 'center' as const
  },
  headerAuftrag: {
    width: '120px'
  },
  headerKunde: {
    width: '150px'
  },
  headerText: {
    flex: 1,
    minWidth: '150px'
  },
  headerDate: {
    width: '95px',
    textAlign: 'center' as const
  },
  headerResponsible: {
    width: '80px',
    textAlign: 'center' as const
  },
  headerStatus: {
    width: '100px'
  },
  headerRemark: {
    width: '200px',
    borderRight: 'none'
  },
  listContainer: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#fafafa',
    border: '1px solid #dddddd',
    borderRadius: '4px',
    padding: '5px'
  },
  statusBar: {
    padding: '8px 10px',
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #dddddd',
    fontSize: '12px',
    color: '#666666',
    fontFamily: 'Arial, sans-serif',
    marginTop: '10px',
    borderRadius: '0 0 4px 4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  error: {
    color: '#cc0000',
    marginBottom: '10px',
    padding: '10px',
    backgroundColor: '#ffeeee',
    borderRadius: '4px',
    fontSize: '13px'
  },
  loading: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#666666',
    fontSize: '14px'
  },
  empty: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#999999',
    fontSize: '14px',
    fontStyle: 'italic' as const
  },
  refreshButton: {
    padding: '4px 10px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    fontFamily: 'Arial, sans-serif'
  }
}

export default function OrdersOverviewPage() {
  const [orders, setOrders] = useState<OrderOverviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<FilterValues>(initialFilters)
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set())
  // Batch-loaded remarks for all orders to avoid many concurrent requests
  const [orderRemarks, setOrderRemarks] = useState<Map<number, HierarchyRemark>>(new Map())
  // Child remarks popup state
  const [childRemarksPopup, setChildRemarksPopup] = useState<ChildRemarksSummary | null>(null)
  // Deep search results table
  const [deepSearchResults, setDeepSearchResults] = useState<DeepSearchResultItem[] | null>(null)

  // Load orders from API - accepts optional filter override
  const loadOrders = useCallback(async (filterOverride?: FilterValues) => {
    setLoading(true)
    setError(null)

    // Use override if provided, otherwise use current filters
    const activeFilters = filterOverride !== undefined ? filterOverride : filters

    try {
      const params: Record<string, string> = {}
      if (activeFilters.dateFrom) params.date_from = activeFilters.dateFrom
      if (activeFilters.dateTo) params.date_to = activeFilters.dateTo
      if (activeFilters.responsible) params.responsible = activeFilters.responsible
      if (activeFilters.customer) params.customer = activeFilters.customer
      if (activeFilters.orderName) params.order_name = activeFilters.orderName
      if (activeFilters.text) params.text = activeFilters.text
      if (activeFilters.reference) params.reference = activeFilters.reference
      if (activeFilters.statusIds && activeFilters.statusIds.length > 0) {
        params.status_ids = activeFilters.statusIds.join(',')
      }
      if (activeFilters.articleSearch) params.article_search = activeFilters.articleSearch
      if (activeFilters.workstepSearch) params.workstep_search = activeFilters.workstepSearch

      const response = await api.get('/orders/overview', { params })
      const data = response.data

      const loadedOrders = data.items || []
      setOrders(loadedOrders)
      setTotal(data.total || 0)
      // Reset selected state when loading new data
      setSelectedOrders(new Set())
      
      // Auto-expand orders that have deep-filter matches
      const isDeepFilter = activeFilters.articleSearch || activeFilters.workstepSearch
      if (isDeepFilter) {
        const ordersToExpand = loadedOrders
          .filter((o: OrderOverviewItem) => o.match_level && o.order_id)
          .map((o: OrderOverviewItem) => o.order_id as number)
        setExpandedOrders(new Set(ordersToExpand))
        
        // Load deep search results table
        try {
          const deepParams: Record<string, string> = {}
          if (activeFilters.articleSearch) deepParams.article_search = activeFilters.articleSearch
          if (activeFilters.workstepSearch) deepParams.workstep_search = activeFilters.workstepSearch
          if (activeFilters.statusIds && activeFilters.statusIds.length > 0) {
            deepParams.status_ids = activeFilters.statusIds.join(',')
          }
          
          const deepResponse = await api.get('/orders/deep-search-results', { params: deepParams })
          setDeepSearchResults(deepResponse.data.items || [])
        } catch (deepErr) {
          console.error('Error loading deep search results:', deepErr)
          setDeepSearchResults(null)
        }
      } else {
        setExpandedOrders(new Set())
        setDeepSearchResults(null)
      }
      
      // Batch-load all remarks for orders in a single request
      const orderIds = loadedOrders
        .map((o: OrderOverviewItem) => o.order_id)
        .filter((id: number | null): id is number => id !== null)
      if (orderIds.length > 0) {
        try {
          const remarksResponse = await remarksApi.getRemarksByLevel('order', orderIds)
          const remarksMap = new Map<number, HierarchyRemark>()
          remarksResponse.items.forEach(r => remarksMap.set(r.hugwawi_id, r))
          setOrderRemarks(remarksMap)
        } catch (remarksErr) {
          console.error('Error loading order remarks:', remarksErr)
          // Don't fail the whole page if remarks fail
        }
      } else {
        setOrderRemarks(new Map())
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Fehler beim Laden'
      setError(message)
      console.error('Error loading orders:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Load on mount
  useEffect(() => {
    loadOrders()
  }, [])

  // Toggle order expansion
  const toggleOrder = useCallback((orderId: number) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }, [])

  // Toggle order selection
  const toggleSelectOrder = useCallback((orderId: number, selected: boolean) => {
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(orderId)
      } else {
        next.delete(orderId)
      }
      return next
    })
  }, [])

  // Select all orders
  const toggleSelectAll = useCallback(() => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      const allIds = orders
        .map(o => o.order_id)
        .filter((id): id is number => id !== null)
      setSelectedOrders(new Set(allIds))
    }
  }, [orders, selectedOrders])

  // Handle filter submit
  const handleFilter = useCallback(() => {
    loadOrders()
  }, [loadOrders])

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setFilters(initialFilters)
    // Load with empty filters immediately (no async state dependency)
    loadOrders(initialFilters)
  }, [loadOrders])

  // Expand/Collapse all
  const expandAll = useCallback(() => {
    const allIds = orders
      .filter(o => o.has_articles)
      .map(o => o.order_id)
      .filter((id): id is number => id !== null)
    setExpandedOrders(new Set(allIds))
  }, [orders])

  const collapseAll = useCallback(() => {
    setExpandedOrders(new Set())
  }, [])

  // Update a single order remark
  const updateOrderRemark = useCallback((orderId: number, remark: HierarchyRemark | null) => {
    setOrderRemarks(prev => {
      const next = new Map(prev)
      if (remark) {
        next.set(orderId, remark)
      } else {
        next.delete(orderId)
      }
      return next
    })
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Auftragsübersicht</h2>
        
        <OrdersFilterBar
          filters={filters}
          onFilterChange={setFilters}
          onFilter={handleFilter}
          onClear={handleClearFilters}
          loading={loading}
        />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Deep Search Results Table */}
      {deepSearchResults && deepSearchResults.length > 0 && (
        <DeepSearchResultsTable
          results={deepSearchResults}
          onClose={() => setDeepSearchResults(null)}
          onNavigateToOrder={(orderId) => {
            // Expand the order and scroll to it
            setExpandedOrders(prev => new Set([...prev, orderId]))
            // Find the order element and scroll to it
            setTimeout(() => {
              const orderElement = document.querySelector(`[data-order-id="${orderId}"]`)
              if (orderElement) {
                orderElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }, 100)
          }}
        />
      )}

      {/* Table Header */}
      <div style={styles.tableHeader}>
        <div style={styles.headerCheckbox}>
          <input
            type="checkbox"
            checked={selectedOrders.size === orders.length && orders.length > 0}
            onChange={toggleSelectAll}
            title="Alle auswählen"
          />
        </div>
        <div style={styles.headerExpand}></div>
        <div style={{ ...styles.headerCell, ...styles.headerPos }}>Pos.</div>
        <div style={{ ...styles.headerCell, ...styles.headerAuftrag }}>Auftrag</div>
        <div style={{ ...styles.headerCell, ...styles.headerKunde }}>Kunde</div>
        <div style={{ ...styles.headerCell, ...styles.headerText }}>AU-Text</div>
        <div style={{ ...styles.headerCell, ...styles.headerDate }}>LT-HG</div>
        <div style={{ ...styles.headerCell, ...styles.headerDate }}>LT-Kunde</div>
        <div style={{ ...styles.headerCell, ...styles.headerResponsible }}>Verantw.</div>
        <div style={{ ...styles.headerCell, ...styles.headerStatus }}>Status</div>
        <div style={{ ...styles.headerCell, ...styles.headerRemark }}>Bemerkung</div>
      </div>

      {/* Orders List */}
      <div style={styles.listContainer}>
        {loading ? (
          <div style={styles.loading}>Lade Aufträge...</div>
        ) : orders.length === 0 ? (
          <div style={styles.empty}>Keine Aufträge gefunden</div>
        ) : (
          orders.map(order => (
            <OrderAccordion
              key={order.order_id || order.pos}
              order={order}
              isExpanded={order.order_id ? expandedOrders.has(order.order_id) : false}
              isSelected={order.order_id ? selectedOrders.has(order.order_id) : false}
              onToggle={() => order.order_id && order.has_articles && toggleOrder(order.order_id)}
              onSelect={(selected) => order.order_id && toggleSelectOrder(order.order_id, selected)}
              preloadedRemark={order.order_id ? orderRemarks.get(order.order_id) : undefined}
              onRemarkChange={(remark) => order.order_id && updateOrderRemark(order.order_id, remark)}
              onShowChildRemarks={(summary) => setChildRemarksPopup(summary)}
            />
          ))
        )}
      </div>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <span>
          {loading
            ? 'Lade Daten...'
            : `${orders.length} von ${total} Aufträgen angezeigt${selectedOrders.size > 0 ? ` (${selectedOrders.size} ausgewählt)` : ''}`}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={styles.refreshButton}
            onClick={expandAll}
            disabled={loading || orders.length === 0}
          >
            Alle aufklappen
          </button>
          <button
            style={styles.refreshButton}
            onClick={collapseAll}
            disabled={loading || expandedOrders.size === 0}
          >
            Alle zuklappen
          </button>
          <button
            style={styles.refreshButton}
            onClick={loadOrders}
            disabled={loading}
          >
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Child Remarks Popup */}
      {childRemarksPopup && (
        <ChildRemarksPopup
          summary={childRemarksPopup}
          onClose={() => setChildRemarksPopup(null)}
        />
      )}
    </div>
  )
}
