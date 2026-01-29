/**
 * Orders Overview Page
 * Hierarchical view of orders with accordion panels for
 * Auftragsartikel, Stücklisten and Arbeitspläne
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { OrderOverviewItem, HierarchyRemark, ChildRemarksSummary, DeepSearchResultItem } from '../services/types'
import OrdersFilterBar, { FilterValues } from '../components/orders/OrdersFilterBar'
import OrderAccordion from '../components/orders/OrderAccordion'
import ChildRemarksPopup from '../components/orders/ChildRemarksPopup'
import DeepSearchResultsTable from '../components/orders/DeepSearchResultsTable'
import remarksApi from '../services/remarksApi'
import { checkTodoExistence, getTodo } from '../services/ppsApi'
import { PPSTodoWithERPDetails } from '../services/ppsTypes'
import TodoEditDialog from '../components/pps/TodoEditDialog'

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
  headerCrm: {
    width: '40px',
    textAlign: 'center' as const
  },
  headerTodo: {
    width: '40px',
    textAlign: 'center' as const
  },
  headerRemark: {
    width: '160px',
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
  },
  selectionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    marginBottom: '10px',
    backgroundColor: '#e3f2fd',
    border: '1px solid #90caf9',
    borderRadius: '4px'
  },
  createTodosButton: {
    padding: '6px 14px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  createTodosButtonDisabled: {
    backgroundColor: '#9e9e9e',
    cursor: 'not-allowed'
  },
  selectionSummary: {
    fontSize: '12px',
    color: '#1565c0'
  },
  clearSelectionButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: '1px solid #90caf9',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#1565c0'
  },
  resultMessage: {
    padding: '4px 10px',
    borderRadius: '3px',
    fontSize: '12px'
  },
  resultSuccess: {
    backgroundColor: '#c8e6c9',
    color: '#2e7d32'
  },
  resultError: {
    backgroundColor: '#ffcdd2',
    color: '#c62828'
  },
  loadMoreContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '15px',
    borderTop: '1px solid #e0e0e0'
  },
  loadMoreButton: {
    padding: '8px 24px',
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold' as const
  },
  loadMoreButtonDisabled: {
    backgroundColor: '#9e9e9e',
    cursor: 'not-allowed'
  },
  // Todo context menu styles
  todoContextMenu: {
    position: 'fixed' as const,
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 1000,
    minWidth: '180px',
    padding: '4px 0'
  },
  todoContextMenuItem: {
    padding: '8px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#333'
  },
  todoContextMenuItemHover: {
    backgroundColor: '#f5f5f5'
  }
}

// Pagination constants
const PAGE_SIZE = 100

export default function OrdersOverviewPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderOverviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
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
  // Selected items from deep search table
  const [selectedDeepSearchItems, setSelectedDeepSearchItems] = useState<DeepSearchResultItem[]>([])
  // Multi-level selection states for todo generation
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set())
  const [selectedBomItemIds, setSelectedBomItemIds] = useState<Set<number>>(new Set())
  const [selectedWorkstepIds, setSelectedWorkstepIds] = useState<Set<number>>(new Set())
  // Todo existence mapping (order_id -> todo_id, 0 if no todo)
  const [orderTodoMapping, setOrderTodoMapping] = useState<Record<number, number>>({})
  // Todo context menu state
  const [todoContextMenu, setTodoContextMenu] = useState<{
    x: number
    y: number
    orderId: number
    todoId: number
  } | null>(null)
  // Todo edit dialog state
  const [editingTodo, setEditingTodo] = useState<PPSTodoWithERPDetails | null>(null)

  // Build filter params for API call
  const buildFilterParams = useCallback((activeFilters: FilterValues) => {
    const params: Record<string, string | number> = {}
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
    return params
  }, [])

  // Load orders from API - accepts optional filter override
  const loadOrders = useCallback(async (filterOverride?: FilterValues) => {
    setLoading(true)
    setError(null)

    // Use override if provided, otherwise use current filters
    const activeFilters = filterOverride !== undefined ? filterOverride : filters

    try {
      const params = buildFilterParams(activeFilters)
      params.skip = 0
      params.limit = PAGE_SIZE

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
        
        // Load deep search results table - include all pre-filters so deep search
        // only searches within filtered results when other filters are active
        try {
          const deepParams: Record<string, string> = {}
          if (activeFilters.articleSearch) deepParams.article_search = activeFilters.articleSearch
          if (activeFilters.workstepSearch) deepParams.workstep_search = activeFilters.workstepSearch
          if (activeFilters.statusIds && activeFilters.statusIds.length > 0) {
            deepParams.status_ids = activeFilters.statusIds.join(',')
          }
          // Pass all pre-filters so deep search respects them
          if (activeFilters.dateFrom) deepParams.date_from = activeFilters.dateFrom
          if (activeFilters.dateTo) deepParams.date_to = activeFilters.dateTo
          if (activeFilters.responsible) deepParams.responsible = activeFilters.responsible
          if (activeFilters.customer) deepParams.customer = activeFilters.customer
          if (activeFilters.orderName) deepParams.order_name = activeFilters.orderName
          if (activeFilters.text) deepParams.text = activeFilters.text
          if (activeFilters.reference) deepParams.reference = activeFilters.reference
          
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
        
        // Load todo existence mapping for orders
        try {
          const todoResponse = await checkTodoExistence({ order_ids: orderIds })
          setOrderTodoMapping(todoResponse.order_todos)
        } catch (todoErr) {
          console.error('Error loading todo mappings:', todoErr)
          // Don't fail if todo check fails
        }
      } else {
        setOrderRemarks(new Map())
        setOrderTodoMapping({})
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Fehler beim Laden'
      setError(message)
      console.error('Error loading orders:', err)
    } finally {
      setLoading(false)
    }
  }, [filters, buildFilterParams])

  // Load more orders (pagination)
  const loadMoreOrders = useCallback(async () => {
    if (loadingMore || orders.length >= total) return
    
    setLoadingMore(true)
    
    try {
      const params = buildFilterParams(filters)
      params.skip = orders.length
      params.limit = PAGE_SIZE

      const response = await api.get('/orders/overview', { params })
      const data = response.data
      const newOrders = data.items || []
      
      // Append to existing orders
      setOrders(prev => [...prev, ...newOrders])
      
      // Load remarks and todo mappings for new orders
      const newOrderIds = newOrders
        .map((o: OrderOverviewItem) => o.order_id)
        .filter((id: number | null): id is number => id !== null)
      if (newOrderIds.length > 0) {
        try {
          const remarksResponse = await remarksApi.getRemarksByLevel('order', newOrderIds)
          setOrderRemarks(prev => {
            const next = new Map(prev)
            remarksResponse.items.forEach(r => next.set(r.hugwawi_id, r))
            return next
          })
        } catch (remarksErr) {
          console.error('Error loading new order remarks:', remarksErr)
        }
        
        // Load todo existence mapping for new orders
        try {
          const todoResponse = await checkTodoExistence({ order_ids: newOrderIds })
          setOrderTodoMapping(prev => ({ ...prev, ...todoResponse.order_todos }))
        } catch (todoErr) {
          console.error('Error loading todo mappings for new orders:', todoErr)
        }
      }
    } catch (err: any) {
      console.error('Error loading more orders:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, orders.length, total, filters, buildFilterParams])

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

  // Selection callbacks for multi-level hierarchy
  const handleArticleSelectionChange = useCallback((articleIds: number[], selected: boolean) => {
    setSelectedArticleIds(prev => {
      const next = new Set(prev)
      if (selected) {
        articleIds.forEach(id => next.add(id))
      } else {
        articleIds.forEach(id => next.delete(id))
      }
      return next
    })
  }, [])

  const handleBomItemSelectionChange = useCallback((bomItemIds: number[], selected: boolean) => {
    setSelectedBomItemIds(prev => {
      const next = new Set(prev)
      if (selected) {
        bomItemIds.forEach(id => next.add(id))
      } else {
        bomItemIds.forEach(id => next.delete(id))
      }
      return next
    })
  }, [])

  const handleWorkstepSelectionChange = useCallback((workstepIds: number[], selected: boolean) => {
    setSelectedWorkstepIds(prev => {
      const next = new Set(prev)
      if (selected) {
        workstepIds.forEach(id => next.add(id))
      } else {
        workstepIds.forEach(id => next.delete(id))
      }
      return next
    })
  }, [])

  // Handle todo icon click - show context menu
  const handleTodoIconClick = useCallback((orderId: number, todoId: number, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setTodoContextMenu({
      x: event.clientX,
      y: event.clientY,
      orderId,
      todoId
    })
  }, [])

  // Handle article todo icon click (reuses the same context menu)
  const handleArticleTodoIconClick = useCallback((articleId: number, todoId: number, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setTodoContextMenu({
      x: event.clientX,
      y: event.clientY,
      orderId: articleId,  // Using orderId field for consistency (it's the source element ID)
      todoId
    })
  }, [])

  // Handle BOM item todo icon click (reuses the same context menu)
  const handleBomTodoIconClick = useCallback((bomItemId: number, todoId: number, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setTodoContextMenu({
      x: event.clientX,
      y: event.clientY,
      orderId: bomItemId,  // Using orderId field for consistency (it's the source element ID)
      todoId
    })
  }, [])

  // Handle workstep todo icon click (reuses the same context menu)
  const handleWorkstepTodoIconClick = useCallback((workstepId: number, todoId: number, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setTodoContextMenu({
      x: event.clientX,
      y: event.clientY,
      orderId: workstepId,  // Using orderId field for consistency (it's the source element ID)
      todoId
    })
  }, [])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setTodoContextMenu(null)
    if (todoContextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [todoContextMenu])

  // Handle context menu actions
  const handleEditTodo = useCallback(async (todoId: number) => {
    setTodoContextMenu(null)
    try {
      const todo = await getTodo(todoId)
      setEditingTodo(todo)
    } catch (err) {
      console.error('Error loading todo for edit:', err)
    }
  }, [])

  const handleNavigateToPlanboard = useCallback((todoId: number) => {
    setTodoContextMenu(null)
    navigate(`/menu/produktionsplanung/planboard?highlight=${todoId}`)
  }, [navigate])

  const handleNavigateToTodoList = useCallback((todoId: number) => {
    setTodoContextMenu(null)
    navigate(`/menu/produktionsplanung/todos?highlight=${todoId}`)
  }, [navigate])

  // Handle todo dialog save
  const handleTodoSave = useCallback((updatedTodo: PPSTodoWithERPDetails) => {
    setEditingTodo(null)
    // Optionally refresh data
  }, [])

  // Handle todo dialog delete
  const handleTodoDelete = useCallback((todoId: number) => {
    setEditingTodo(null)
    // Update mapping to remove the deleted todo
    setOrderTodoMapping(prev => {
      const next = { ...prev }
      for (const key in next) {
        if (next[key] === todoId) {
          next[key] = 0
        }
      }
      return next
    })
  }, [])

  // Total selected items count (including deep search items)
  const totalSelectedItems = selectedOrders.size + selectedArticleIds.size + selectedBomItemIds.size + selectedWorkstepIds.size + selectedDeepSearchItems.length

  // State for creating todos
  const [creatingTodos, setCreatingTodos] = useState(false)
  const [todoCreationResult, setTodoCreationResult] = useState<{ success: boolean; message: string } | null>(null)

  // Create todos from selection
  const handleCreateTodosFromSelection = useCallback(async () => {
    if (totalSelectedItems === 0) return
    
    setCreatingTodos(true)
    setTodoCreationResult(null)
    
    try {
      // Collect BOM item IDs from deep search selection (items with bom_detail_id)
      const deepSearchBomIds = selectedDeepSearchItems
        .filter(item => item.bom_detail_id !== null)
        .map(item => item.bom_detail_id as number)
      
      // Merge with existing bom_item_ids selection
      const allBomItemIds = new Set([...selectedBomItemIds, ...deepSearchBomIds])
      
      const response = await api.post('/pps/todos/from-selection', {
        order_ids: Array.from(selectedOrders),
        order_article_ids: Array.from(selectedArticleIds),
        bom_item_ids: Array.from(allBomItemIds),
        workstep_ids: Array.from(selectedWorkstepIds)
      })
      
      const result = response.data
      setTodoCreationResult({
        success: true,
        message: `${result.created_count} Todo(s) erstellt${result.errors.length > 0 ? ` (${result.errors.length} Fehler)` : ''}`
      })
      
      // Clear selection after successful creation
      setSelectedOrders(new Set())
      setSelectedArticleIds(new Set())
      setSelectedBomItemIds(new Set())
      setSelectedWorkstepIds(new Set())
      setSelectedDeepSearchItems([])
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setTodoCreationResult(null), 5000)
    } catch (err: any) {
      setTodoCreationResult({
        success: false,
        message: err.response?.data?.detail || 'Fehler beim Erstellen der Todos'
      })
    } finally {
      setCreatingTodos(false)
    }
  }, [selectedOrders, selectedArticleIds, selectedBomItemIds, selectedWorkstepIds, selectedDeepSearchItems, totalSelectedItems])

  // Build selection summary text
  const getSelectionSummary = useCallback(() => {
    const parts: string[] = []
    if (selectedOrders.size > 0) parts.push(`${selectedOrders.size} Aufträge`)
    if (selectedArticleIds.size > 0) parts.push(`${selectedArticleIds.size} Artikel`)
    if (selectedBomItemIds.size > 0) parts.push(`${selectedBomItemIds.size} SL-Artikel`)
    if (selectedWorkstepIds.size > 0) parts.push(`${selectedWorkstepIds.size} AG`)
    if (selectedDeepSearchItems.length > 0) parts.push(`${selectedDeepSearchItems.length} Deep-Search`)
    return parts.join(', ')
  }, [selectedOrders.size, selectedArticleIds.size, selectedBomItemIds.size, selectedWorkstepIds.size, selectedDeepSearchItems.length])

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

      {/* Selection Action Bar - only shown when items are selected */}
      {totalSelectedItems > 0 && (
        <div style={styles.selectionBar}>
          <span style={styles.selectionSummary}>
            <strong>{totalSelectedItems}</strong> ausgewählt ({getSelectionSummary()})
          </span>
          <button
            style={{
              ...styles.createTodosButton,
              ...(creatingTodos ? styles.createTodosButtonDisabled : {})
            }}
            onClick={handleCreateTodosFromSelection}
            disabled={creatingTodos}
            title="Ausgewählte Elemente als Todos im Planboard erstellen"
          >
            {creatingTodos ? '⏳' : '➕'} Als Todos erstellen
          </button>
          <button
            style={styles.clearSelectionButton}
            onClick={() => {
              setSelectedOrders(new Set())
              setSelectedArticleIds(new Set())
              setSelectedBomItemIds(new Set())
              setSelectedWorkstepIds(new Set())
              setSelectedDeepSearchItems([])
            }}
            title="Auswahl aufheben"
          >
            ✕ Auswahl aufheben
          </button>
          {todoCreationResult && (
            <span style={{
              ...styles.resultMessage,
              ...(todoCreationResult.success ? styles.resultSuccess : styles.resultError)
            }}>
              {todoCreationResult.message}
            </span>
          )}
        </div>
      )}

      {/* Deep Search Results Table */}
      {deepSearchResults && deepSearchResults.length > 0 && (
        <DeepSearchResultsTable
          results={deepSearchResults}
          onClose={() => {
            setDeepSearchResults(null)
            setSelectedDeepSearchItems([])
          }}
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
          onSelectionChange={(selectedItems) => setSelectedDeepSearchItems(selectedItems)}
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
        <div style={{ ...styles.headerCell, ...styles.headerCrm }}>CRM</div>
        <div style={{ ...styles.headerCell, ...styles.headerTodo }}>ToDo</div>
        <div style={{ ...styles.headerCell, ...styles.headerRemark }}>Bemerkung</div>
      </div>

      {/* Orders List */}
      <div style={styles.listContainer}>
        {loading ? (
          <div style={styles.loading}>Lade Aufträge...</div>
        ) : orders.length === 0 ? (
          <div style={styles.empty}>Keine Aufträge gefunden</div>
        ) : (
          <>
            {orders.map(order => (
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
                selectedArticleIds={selectedArticleIds}
                onArticleSelectionChange={handleArticleSelectionChange}
                selectedBomItemIds={selectedBomItemIds}
                onBomItemSelectionChange={handleBomItemSelectionChange}
                selectedWorkstepIds={selectedWorkstepIds}
                onWorkstepSelectionChange={handleWorkstepSelectionChange}
                todoId={order.order_id ? orderTodoMapping[order.order_id] : undefined}
                onTodoIconClick={handleTodoIconClick}
                onArticleTodoIconClick={handleArticleTodoIconClick}
                onBomTodoIconClick={handleBomTodoIconClick}
                onWorkstepTodoIconClick={handleWorkstepTodoIconClick}
              />
            ))}
            {/* Load More Button */}
            {orders.length < total && (
              <div style={styles.loadMoreContainer}>
                <button
                  style={{
                    ...styles.loadMoreButton,
                    ...(loadingMore ? styles.loadMoreButtonDisabled : {})
                  }}
                  onClick={loadMoreOrders}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Lade...' : `Weitere ${Math.min(PAGE_SIZE, total - orders.length)} laden`}
                </button>
              </div>
            )}
          </>
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

      {/* Todo Context Menu */}
      {todoContextMenu && (
        <div
          style={{
            ...styles.todoContextMenu,
            left: todoContextMenu.x,
            top: todoContextMenu.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={styles.todoContextMenuItem}
            onClick={() => handleEditTodo(todoContextMenu.todoId)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            ✏️ ToDo bearbeiten
          </div>
          <div
            style={styles.todoContextMenuItem}
            onClick={() => handleNavigateToPlanboard(todoContextMenu.todoId)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            📊 Im Planboard anzeigen
          </div>
          <div
            style={styles.todoContextMenuItem}
            onClick={() => handleNavigateToTodoList(todoContextMenu.todoId)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            📋 In ToDo-Liste anzeigen
          </div>
        </div>
      )}

      {/* Todo Edit Dialog */}
      {editingTodo && (
        <TodoEditDialog
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={handleTodoSave}
          onDelete={handleTodoDelete}
        />
      )}
    </div>
  )
}
