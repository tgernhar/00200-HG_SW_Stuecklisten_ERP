/**
 * Todo List Page - Tabular view of all PPS ToDos
 * 
 * Features:
 * - AG-Grid table with all todos
 * - Sorting by priority, date
 * - Extended filtering (Auftrag, Artikel, Arbeitsgang, Mitarbeiter)
 * - Text search with type filter awareness
 * - Cumulative filters (OR logic)
 * - ERP reference columns (order_name, article_number, etc.)
 * - Quick edit functionality via TodoEditDialog
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, GridReadyEvent, ValueFormatterParams, RowDoubleClickedEvent } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { getTodosWithERPDetails, getResources, deleteTodo, updateTodo } from '../services/ppsApi'
import { PPSTodoWithERPDetails, PPSResource, TodoStatus } from '../services/ppsTypes'
import TodoEditDialog from '../components/pps/TodoEditDialog'
import TodoGroupedView from '../components/pps/TodoGroupedView'
import { 
  FilterPreset, FilterPresetConfig,
  getFilterPresets, getFavoritePreset, createFilterPreset, 
  updateFilterPreset, deleteFilterPreset, setFavoritePreset 
} from '../services/filterPresetApi'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 15px',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #dddddd',
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#333333',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 15px',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #eeeeee',
    flexWrap: 'wrap' as const,
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  filterSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '8px 12px',
    backgroundColor: '#f0f7ff',
    borderRadius: '4px',
    border: '1px solid #d0e3f7',
  },
  searchSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#fff8e6',
    borderRadius: '4px',
    border: '1px solid #ffe0a6',
  },
  filterCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  label: {
    fontSize: '12px',
    color: '#666666',
  },
  labelBold: {
    fontSize: '12px',
    color: '#333333',
    fontWeight: 'bold' as const,
  },
  select: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
  },
  searchInput: {
    padding: '5px 10px',
    fontSize: '12px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    width: '180px',
  },
  button: {
    padding: '6px 12px',
    backgroundColor: '#ffffff',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
  },
  buttonFilter: {
    padding: '6px 12px',
    backgroundColor: '#f5a623',
    border: '1px solid #e09000',
    color: '#ffffff',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold' as const,
  },
  buttonReset: {
    padding: '6px 12px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    color: '#856404',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
  },
  buttonDanger: {
    padding: '6px 12px',
    backgroundColor: '#ffffff',
    border: '1px solid #cc0000',
    color: '#cc0000',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
  },
  gridContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  statusBar: {
    padding: '6px 15px',
    backgroundColor: '#f0f0f0',
    borderTop: '1px solid #dddddd',
    fontSize: '11px',
    color: '#666666',
    display: 'flex',
    justifyContent: 'space-between',
  },
  separator: {
    width: '1px',
    height: '24px',
    backgroundColor: '#dddddd',
    margin: '0 5px',
  },
}

// Status display mapping
const statusLabels: Record<string, string> = {
  new: 'Neu',
  planned: 'Geplant',
  in_progress: 'In Arbeit',
  completed: 'Erledigt',
  blocked: 'Blockiert',
}

// Status color mapping
const statusColors: Record<string, string> = {
  new: '#888888',
  planned: '#4a90d9',
  in_progress: '#f5a623',
  completed: '#7ed321',
  blocked: '#d0021b',
}

export default function TodoListPage() {
  // URL search params for highlight feature
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightTodoId = searchParams.get('highlight')
  
  const [allTodos, setAllTodos] = useState<PPSTodoWithERPDetails[]>([])
  const [filteredTodos, setFilteredTodos] = useState<PPSTodoWithERPDetails[]>([])
  const [resources, setResources] = useState<PPSResource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<PPSTodoWithERPDetails[]>([])
  
  // Edit dialog state
  const [editingTodo, setEditingTodo] = useState<PPSTodoWithERPDetails | null>(null)
  
  // Ref for AG Grid API
  const gridRef = useRef<any>(null)
  const hasHighlightedRef = useRef(false)
  
  // Bulk date edit state
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [bulkStartDate, setBulkStartDate] = useState('')
  const [bulkStartTime, setBulkStartTime] = useState('09:00')
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [employeeFilter, setEmployeeFilter] = useState<string>('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [machineFilter, setMachineFilter] = useState<string>('')
  
  // Cumulative type filters (OR logic) - now based on ERP fields, not todo_type
  const [filterOrders, setFilterOrders] = useState(false)
  const [filterArticles, setFilterArticles] = useState(false)
  const [filterOperations, setFilterOperations] = useState(false)
  
  // Search
  const [searchText, setSearchText] = useState('')
  const [searchInput, setSearchInput] = useState('')
  
  // View mode toggle (flat list vs grouped by order)
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped')

  // Filter presets
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null)
  const [presetName, setPresetName] = useState('')
  const [showPresetSave, setShowPresetSave] = useState(false)
  const [presetsLoading, setPresetsLoading] = useState(false)
  
  // Simulated user ID (in production this would come from auth context)
  const userId = 1  // TODO: Replace with actual user ID from auth

  // Check if any cumulative filter is active
  const hasActiveTypeFilter = filterOrders || filterArticles || filterOperations
  const hasActiveSearch = searchText.length > 0
  const hasActiveDepartmentOrMachine = departmentFilter !== '' || machineFilter !== ''

  // Load data from API
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodoListPage.tsx:240',message:'H1: Starting todos load',data:{statusFilter,employeeFilter},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const [todosResponse, resourcesResponse] = await Promise.all([
        getTodosWithERPDetails({ 
          status: statusFilter || undefined,
          assigned_employee_id: employeeFilter ? parseInt(employeeFilter) : undefined,
          limit: 1000 
        }),
        getResources({ is_active: true }),
      ])
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodoListPage.tsx:252',message:'H1-H3: Todos API response',data:{todosCount:todosResponse?.items?.length,totalCount:todosResponse?.total,resourcesCount:resourcesResponse?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1-H3'})}).catch(()=>{});
      // #endregion
      
      // Sort by priority then by planned_start
      const sortedTodos = [...todosResponse.items].sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        if (!a.planned_start && !b.planned_start) return 0
        if (!a.planned_start) return 1
        if (!b.planned_start) return -1
        return new Date(b.planned_start).getTime() - new Date(a.planned_start).getTime()
      })
      
      setAllTodos(sortedTodos)
      setResources(resourcesResponse)
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TodoListPage.tsx:270',message:'H1: Error loading todos',data:{error:err?.message,status:err?.response?.status,detail:err?.response?.data?.detail},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error('Error loading todos:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, employeeFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load filter presets on mount
  const loadPresets = useCallback(async () => {
    setPresetsLoading(true)
    try {
      const [presetsData, favoriteData] = await Promise.all([
        getFilterPresets('todo_list', userId),
        getFavoritePreset('todo_list', userId)
      ])
      setPresets(presetsData)
      
      // Apply favorite preset if exists
      if (favoriteData) {
        applyPreset(favoriteData)
        setSelectedPresetId(favoriteData.id)
      }
    } catch (err) {
      console.error('Error loading presets:', err)
    }
    setPresetsLoading(false)
  }, [userId])

  useEffect(() => {
    loadPresets()
  }, [loadPresets])
  
  // Handle highlight parameter from URL (for navigating from other pages)
  useEffect(() => {
    if (highlightTodoId && allTodos.length > 0 && !loading && !hasHighlightedRef.current) {
      const todoId = parseInt(highlightTodoId)
      // Find the todo in the list
      const todoIndex = filteredTodos.findIndex(t => t.id === todoId)
      if (todoIndex >= 0) {
        // For grouped view, switch to flat view to show the row and then scroll
        if (viewMode === 'grouped') {
          setViewMode('flat')
        }
        
        // Use AG Grid API to scroll to and select the row
        setTimeout(() => {
          if (gridRef.current?.api) {
            const rowNode = gridRef.current.api.getRowNode(String(todoId))
            if (rowNode) {
              gridRef.current.api.ensureNodeVisible(rowNode, 'middle')
              rowNode.setSelected(true)
              // Flash the row for visual feedback
              gridRef.current.api.flashCells({ rowNodes: [rowNode] })
            }
          } else {
            // Fallback: scroll to DOM element
            const rowElement = document.querySelector(`[row-id="${todoId}"]`)
            if (rowElement) {
              rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
              rowElement.classList.add('ag-row-highlight')
              setTimeout(() => rowElement.classList.remove('ag-row-highlight'), 3000)
            }
          }
        }, 500)  // Small delay to ensure grid is rendered
        
        hasHighlightedRef.current = true
        // Clear the highlight parameter from URL after use
        setSearchParams({}, { replace: true })
      } else {
        // Todo not in filtered list - might need to adjust filters
        // Try finding in all todos
        const existsInAll = allTodos.some(t => t.id === todoId)
        if (existsInAll) {
          // Open the edit dialog for this todo directly
          const todo = allTodos.find(t => t.id === todoId)
          if (todo) {
            setEditingTodo(todo)
            hasHighlightedRef.current = true
            setSearchParams({}, { replace: true })
          }
        }
      }
    }
  }, [highlightTodoId, allTodos, filteredTodos, loading, viewMode, setSearchParams])

  // Apply preset filters
  const applyPreset = useCallback((preset: FilterPreset) => {
    const config = preset.filter_config
    setDepartmentFilter(config.departmentFilter || '')
    setMachineFilter(config.machineFilter || '')
    setEmployeeFilter(config.employeeFilter || '')
    setStatusFilter(config.statusFilter || '')
    setViewMode((config.viewMode as 'flat' | 'grouped') || 'grouped')
    setSelectedPresetId(preset.id)
  }, [])

  // Get current filter config
  const getCurrentFilterConfig = useCallback((): FilterPresetConfig => ({
    departmentFilter,
    machineFilter,
    employeeFilter,
    statusFilter,
    viewMode,
  }), [departmentFilter, machineFilter, employeeFilter, statusFilter, viewMode])

  // Save current filters as new preset
  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) return
    try {
      const newPreset = await createFilterPreset({
        name: presetName.trim(),
        page: 'todo_list',
        filter_config: getCurrentFilterConfig()
      }, userId)
      setPresets(prev => [...prev, newPreset])
      setSelectedPresetId(newPreset.id)
      setPresetName('')
      setShowPresetSave(false)
    } catch (err) {
      console.error('Error saving preset:', err)
    }
  }, [presetName, getCurrentFilterConfig, userId])

  // Update existing preset with current filters
  const handleUpdatePreset = useCallback(async () => {
    if (!selectedPresetId) return
    try {
      const updated = await updateFilterPreset(selectedPresetId, {
        filter_config: getCurrentFilterConfig()
      }, userId)
      setPresets(prev => prev.map(p => p.id === updated.id ? updated : p))
    } catch (err) {
      console.error('Error updating preset:', err)
    }
  }, [selectedPresetId, getCurrentFilterConfig, userId])

  // Delete preset
  const handleDeletePreset = useCallback(async (presetId: number) => {
    if (!window.confirm('Preset wirklich löschen?')) return
    try {
      await deleteFilterPreset(presetId, userId)
      setPresets(prev => prev.filter(p => p.id !== presetId))
      if (selectedPresetId === presetId) {
        setSelectedPresetId(null)
      }
    } catch (err) {
      console.error('Error deleting preset:', err)
    }
  }, [selectedPresetId, userId])

  // Set as favorite
  const handleSetFavorite = useCallback(async (presetId: number) => {
    try {
      await setFavoritePreset(presetId, userId)
      setPresets(prev => prev.map(p => ({
        ...p,
        is_favorite: p.id === presetId
      })))
    } catch (err) {
      console.error('Error setting favorite:', err)
    }
  }, [userId])

  // Apply local filters (type checkboxes + department/machine + search)
  useEffect(() => {
    let result = [...allTodos]
    
    // Apply type filters (cumulative OR logic) - based on ERP fields, not todo_type
    if (hasActiveTypeFilter) {
      result = result.filter(todo => {
        // Auftrag: order_name is not empty
        if (filterOrders && todo.order_name && todo.order_name.trim() !== '') return true
        // Artikel: order_article_number OR bom_article_number is not empty
        if (filterArticles && (
          (todo.order_article_number && todo.order_article_number.trim() !== '') ||
          (todo.bom_article_number && todo.bom_article_number.trim() !== '')
        )) return true
        // Arbeitsgang: workstep_name is not empty
        if (filterOperations && todo.workstep_name && todo.workstep_name.trim() !== '') return true
        return false
      })
    }
    
    // Apply department filter
    if (departmentFilter) {
      const deptId = parseInt(departmentFilter)
      result = result.filter(todo => todo.assigned_department_id === deptId)
    }
    
    // Apply machine filter
    if (machineFilter) {
      const machId = parseInt(machineFilter)
      result = result.filter(todo => todo.assigned_machine_id === machId)
    }
    
    // Apply text search
    if (searchText) {
      const searchLower = searchText.toLowerCase()
      
      result = result.filter(todo => {
        // If no type checkboxes are active, search all fields
        if (!hasActiveTypeFilter) {
          return (
            todo.title?.toLowerCase().includes(searchLower) ||
            todo.order_name?.toLowerCase().includes(searchLower) ||
            todo.order_article_number?.toLowerCase().includes(searchLower) ||
            todo.bom_article_number?.toLowerCase().includes(searchLower) ||
            todo.workstep_name?.toLowerCase().includes(searchLower)
          )
        }
        
        // Search only in fields corresponding to active checkboxes
        let matches = false
        
        if (filterOrders) {
          matches = matches || (todo.order_name?.toLowerCase().includes(searchLower) ?? false)
        }
        if (filterArticles) {
          matches = matches || 
            (todo.order_article_number?.toLowerCase().includes(searchLower) ?? false) ||
            (todo.bom_article_number?.toLowerCase().includes(searchLower) ?? false)
        }
        if (filterOperations) {
          matches = matches || (todo.workstep_name?.toLowerCase().includes(searchLower) ?? false)
        }
        
        // Always also search title
        matches = matches || (todo.title?.toLowerCase().includes(searchLower) ?? false)
        
        return matches
      })
    }
    
    setFilteredTodos(result)
  }, [allTodos, filterOrders, filterArticles, filterOperations, departmentFilter, machineFilter, searchText, hasActiveTypeFilter])

  // Get departments for filter dropdown
  const departments = useMemo(() => {
    return resources.filter(r => r.resource_type === 'department')
  }, [resources])

  // Get machines for filter dropdown (filtered by department if selected)
  const machines = useMemo(() => {
    const allMachines = resources.filter(r => r.resource_type === 'machine')
    if (!departmentFilter) return allMachines
    // Filter machines by department - use erp_id of the selected department
    const deptId = parseInt(departmentFilter)
    const selectedDepartment = departments.find(d => d.id === deptId)
    if (!selectedDepartment) return allMachines
    // Compare machine's erp_department_id with department's erp_id
    const filtered = allMachines.filter(m => m.erp_department_id === selectedDepartment.erp_id)
    return filtered.length > 0 ? filtered : allMachines
  }, [resources, departmentFilter, departments])

  // Get employees for filter dropdown (filtered by department if selected)
  const employees = useMemo(() => {
    const allEmployees = resources.filter(r => r.resource_type === 'employee')
    if (!departmentFilter) return allEmployees
    // Filter employees by department - use erp_id of the selected department
    const deptId = parseInt(departmentFilter)
    const selectedDepartment = departments.find(d => d.id === deptId)
    if (!selectedDepartment) return allEmployees
    // Compare employee's erp_department_id with department's erp_id
    const filtered = allEmployees.filter(e => e.erp_department_id === selectedDepartment.erp_id)
    return filtered.length > 0 ? filtered : allEmployees
  }, [resources, departmentFilter, departments])

  // Get resource name by ID
  const getResourceName = useCallback((departmentId?: number, machineId?: number, employeeId?: number) => {
    const id = machineId || employeeId || departmentId
    if (!id) return '-'
    const resource = resources.find(r => r.id === id)
    return resource?.name || '-'
  }, [resources])

  // Handle search filter button
  const handleFilter = useCallback(() => {
    setSearchText(searchInput)
  }, [searchInput])

  // Handle Enter key in search input
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFilter()
    }
  }, [handleFilter])

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setStatusFilter('')
    setEmployeeFilter('')
    setDepartmentFilter('')
    setMachineFilter('')
    setFilterOrders(false)
    setFilterArticles(false)
    setFilterOperations(false)
    setSearchText('')
    setSearchInput('')
  }, [])

  // Column definitions with ERP references
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '',
      field: 'checkbox',
      width: 50,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      sortable: false,
      filter: false,
      resizable: false,
    },
    {
      headerName: 'Prio',
      field: 'priority',
      width: 70,
      sort: 'asc',
      sortIndex: 0,
    },
    {
      headerName: 'Titel',
      field: 'title',
      flex: 2,
      minWidth: 200,
    },
    {
      headerName: 'Typ',
      field: 'todo_type',
      width: 110,
      valueFormatter: (params: ValueFormatterParams) => {
        const types: Record<string, string> = {
          container_order: 'Auftrag',
          container_article: 'Artikel',
          operation: 'Arbeitsgang',
          eigene: 'Eigene',
        }
        return types[params.value] || params.value
      },
    },
    // ERP Reference columns
    {
      headerName: 'Auftrag',
      field: 'order_name',
      width: 120,
      valueFormatter: (params: ValueFormatterParams) => params.value || '-',
    },
    {
      headerName: 'Auftragsartikel',
      field: 'order_article_number',
      width: 140,
      valueFormatter: (params: ValueFormatterParams) => params.value || '-',
    },
    {
      headerName: 'Stücklistenartikel',
      field: 'bom_article_number',
      width: 140,
      valueFormatter: (params: ValueFormatterParams) => params.value || '-',
    },
    {
      headerName: 'Arbeitsgang',
      field: 'workstep_name',
      width: 130,
      valueFormatter: (params: ValueFormatterParams) => params.value || '-',
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 100,
      cellRenderer: (params: { value: string }) => {
        const color = statusColors[params.value] || '#888888'
        const label = statusLabels[params.value] || params.value
        return (
          <span style={{ 
            color, 
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: color,
            }} />
            {label}
          </span>
        )
      },
    },
    {
      headerName: 'Start',
      field: 'planned_start',
      width: 140,
      sort: 'desc',
      sortIndex: 1,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '-'
        return new Date(params.value).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      },
    },
    {
      headerName: 'Ende',
      field: 'planned_end',
      width: 140,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '-'
        return new Date(params.value).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      },
    },
    {
      headerName: 'Dauer (Min)',
      field: 'total_duration_minutes',
      width: 100,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '-'
        return `${params.value} min`
      },
    },
    {
      headerName: 'Ressource',
      field: 'assigned_department_id',
      width: 120,
      valueGetter: (params) => {
        return getResourceName(
          params.data.assigned_department_id,
          params.data.assigned_machine_id,
          params.data.assigned_employee_id
        )
      },
    },
    {
      headerName: 'Liefertermin',
      field: 'delivery_date',
      width: 110,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.value) return '-'
        return new Date(params.value).toLocaleDateString('de-DE')
      },
    },
  ], [getResourceName])

  // Default column settings
  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), [])

  // Handle grid ready
  const onGridReady = useCallback((event: GridReadyEvent) => {
    event.api.sizeColumnsToFit()
  }, [])

  // Handle row selection
  const onSelectionChanged = useCallback((event: { api: { getSelectedRows: () => PPSTodoWithERPDetails[] } }) => {
    setSelectedRows(event.api.getSelectedRows())
  }, [])

  // Handle row double-click to open edit dialog
  const onRowDoubleClicked = useCallback((event: RowDoubleClickedEvent) => {
    if (event.data) {
      setEditingTodo(event.data as PPSTodoWithERPDetails)
    }
  }, [])

  // Handle delete from grid
  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) return
    
    if (!window.confirm(`${selectedRows.length} ToDo(s) wirklich löschen?`)) {
      return
    }
    
    try {
      for (const row of selectedRows) {
        await deleteTodo(row.id)
      }
      loadData()
    } catch (err) {
      console.error('Error deleting todos:', err)
    }
  }, [selectedRows, loadData])

  // Handle delete from dialog
  const handleDeleteFromDialog = useCallback((todoId: number) => {
    setEditingTodo(null)
    loadData()
  }, [loadData])

  // Handle status change
  const handleStatusChange = useCallback(async (newStatus: TodoStatus) => {
    if (selectedRows.length === 0) return
    
    try {
      for (const row of selectedRows) {
        await updateTodo(row.id, { status: newStatus })
      }
      loadData()
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }, [selectedRows, loadData])

  // Handle save from edit dialog
  const handleEditSave = useCallback(() => {
    setEditingTodo(null)
    loadData()
  }, [loadData])

  // Handle bulk start date change - preserves relative time offsets between todos
  // Special case: If a single "project" type todo is selected, also move all its children
  const handleBulkDateChange = useCallback(async () => {
    if (selectedRows.length === 0 || !bulkStartDate) return
    
    // Combine date and time to get the new base start date
    const newBaseDate = new Date(`${bulkStartDate}T${bulkStartTime}:00`)
    
    // Determine which todos to update
    let todosToUpdate: PPSTodoWithERPDetails[] = [...selectedRows]
    
    // Recursively find all children of a todo
    const findChildren = (parentId: number): PPSTodoWithERPDetails[] => {
      const children = allTodos.filter(t => t.parent_todo_id === parentId)
      let allDescendants: PPSTodoWithERPDetails[] = [...children]
      for (const child of children) {
        allDescendants = [...allDescendants, ...findChildren(child.id)]
      }
      return allDescendants
    }
    
    // Special case: Single todo selected that has children - include all children recursively
    if (selectedRows.length === 1) {
      const selectedTodo = selectedRows[0]
      const childTodos = findChildren(selectedTodo.id)
      
      if (childTodos.length > 0) {
        todosToUpdate = [selectedTodo, ...childTodos]
      }
    }
    
    // Find the earliest start date among todos to update (excluding the project itself if single selection)
    const todosForEarliestCalc = selectedRows.length === 1 
      ? todosToUpdate.filter(t => t.id !== selectedRows[0].id)  // Exclude project, use children only
      : todosToUpdate
    
    const todosWithDates = todosForEarliestCalc
      .filter(row => row.planned_start)
      .map(row => ({
        ...row,
        startDate: new Date(row.planned_start!.replace(' ', 'T'))
      }))
    
    // Calculate the earliest start date
    let earliestDate: Date | null = null
    for (const todo of todosWithDates) {
      if (!earliestDate || todo.startDate < earliestDate) {
        earliestDate = todo.startDate
      }
    }
    
    try {
      for (const row of todosToUpdate) {
        let newStartDate: string
        
        // For single project selection: project gets the exact date, children get offset
        if (selectedRows.length === 1 && row.id === selectedRows[0].id) {
          // This is the project itself - set exact date
          newStartDate = `${bulkStartDate} ${bulkStartTime}:00`
        } else if (earliestDate && row.planned_start) {
          // Calculate offset from earliest date (in milliseconds)
          const rowDate = new Date(row.planned_start.replace(' ', 'T'))
          const offsetMs = rowDate.getTime() - earliestDate.getTime()
          
          // Apply offset to new base date
          const adjustedDate = new Date(newBaseDate.getTime() + offsetMs)
          
          // Format as "YYYY-MM-DD HH:MM:SS" in LOCAL time (not UTC)
          const year = adjustedDate.getFullYear()
          const month = String(adjustedDate.getMonth() + 1).padStart(2, '0')
          const day = String(adjustedDate.getDate()).padStart(2, '0')
          const hours = String(adjustedDate.getHours()).padStart(2, '0')
          const minutes = String(adjustedDate.getMinutes()).padStart(2, '0')
          const seconds = String(adjustedDate.getSeconds()).padStart(2, '0')
          newStartDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        } else {
          // No existing date - use base date directly
          newStartDate = `${bulkStartDate} ${bulkStartTime}:00`
        }
        
        await updateTodo(row.id, { planned_start: newStartDate })
      }
      setShowDatePicker(false)
      setBulkStartDate('')
      setBulkStartTime('09:00')
      loadData()
    } catch (err) {
      console.error('Error updating start dates:', err)
    }
  }, [selectedRows, allTodos, bulkStartDate, bulkStartTime, loadData])

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Auftrags-ToDos</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Filter Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select
              style={{ ...styles.select, minWidth: '150px' }}
              value={selectedPresetId || ''}
              onChange={(e) => {
                const id = e.target.value ? parseInt(e.target.value) : null
                setSelectedPresetId(id)
                if (id) {
                  const preset = presets.find(p => p.id === id)
                  if (preset) applyPreset(preset)
                }
              }}
              disabled={presetsLoading}
            >
              <option value="">Filter-Preset...</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>
                  {p.is_favorite ? '⭐ ' : ''}{p.name}
                </option>
              ))}
            </select>
            
            {selectedPresetId && (
              <>
                <button 
                  style={styles.button} 
                  onClick={handleUpdatePreset}
                  title="Aktuelles Preset mit aktuellen Filtern aktualisieren"
                >
                  💾
                </button>
                <button 
                  style={styles.button} 
                  onClick={() => handleSetFavorite(selectedPresetId)}
                  title="Als Standard-Preset festlegen"
                >
                  ⭐
                </button>
                <button 
                  style={{ ...styles.button, color: '#cc0000' }} 
                  onClick={() => handleDeletePreset(selectedPresetId)}
                  title="Preset löschen"
                >
                  🗑
                </button>
              </>
            )}
            
            {showPresetSave ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  placeholder="Preset-Name..."
                  style={{ ...styles.searchInput, width: '120px' }}
                  autoFocus
                />
                <button style={styles.button} onClick={handleSavePreset}>✓</button>
                <button style={styles.button} onClick={() => { setShowPresetSave(false); setPresetName('') }}>✕</button>
              </div>
            ) : (
              <button 
                style={styles.button} 
                onClick={() => setShowPresetSave(true)}
                title="Aktuelle Filter als neues Preset speichern"
              >
                + Preset
              </button>
            )}
          </div>
          
          <div style={styles.separator} />
          
          {/* View mode toggle */}
          <button
            style={{
              ...styles.button,
              backgroundColor: viewMode === 'grouped' ? '#e3f2fd' : '#fff',
              borderColor: viewMode === 'grouped' ? '#2196f3' : '#ccc',
            }}
            onClick={() => setViewMode(v => v === 'flat' ? 'grouped' : 'flat')}
            title={viewMode === 'flat' ? 'Zur gruppierten Ansicht wechseln' : 'Zur Listenansicht wechseln'}
          >
            {viewMode === 'flat' ? 'Gruppiert' : 'Liste'}
          </button>
          <button style={styles.button} onClick={loadData} disabled={loading}>
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Toolbar - Reihenfolge: Checkboxes | Abteilung | Maschine | Mitarbeiter | Status | Reset | Suche + Filtern */}
      <div style={styles.toolbar}>
        {/* Type filters (cumulative) - based on ERP fields */}
        <div style={styles.filterSection}>
          <label style={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={filterOrders}
              onChange={(e) => setFilterOrders(e.target.checked)}
            />
            Auftrag
          </label>
          <label style={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={filterArticles}
              onChange={(e) => setFilterArticles(e.target.checked)}
            />
            Artikel
          </label>
          <label style={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={filterOperations}
              onChange={(e) => setFilterOperations(e.target.checked)}
            />
            Arbeitsgang
          </label>
        </div>

        {/* Department filter */}
        <div style={styles.filterGroup}>
          <span style={styles.label}>Abteilung:</span>
          <select
            style={styles.select}
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value)
              // Reset machine filter when department changes
              setMachineFilter('')
            }}
          >
            <option value="">Alle</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Machine filter (filtered by department) */}
        <div style={styles.filterGroup}>
          <span style={styles.label}>Maschine:</span>
          <select
            style={styles.select}
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
          >
            <option value="">Alle</option>
            {machines.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Employee filter */}
        <div style={styles.filterGroup}>
          <span style={styles.label}>Mitarbeiter:</span>
          <select
            style={styles.select}
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          >
            <option value="">Alle</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div style={styles.filterGroup}>
          <span style={styles.label}>Status:</span>
          <select
            style={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Alle</option>
            <option value="new">Neu</option>
            <option value="planned">Geplant</option>
            <option value="in_progress">In Arbeit</option>
            <option value="completed">Erledigt</option>
            <option value="blocked">Blockiert</option>
          </select>
        </div>

        {/* Reset filters button */}
        {(hasActiveTypeFilter || statusFilter || employeeFilter || departmentFilter || machineFilter || hasActiveSearch) && (
          <button style={styles.buttonReset} onClick={handleResetFilters}>
            ✕
          </button>
        )}

        {/* Search section */}
        <div style={styles.searchSection}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={styles.searchInput}
            placeholder={hasActiveTypeFilter ? 'In gewählten Feldern...' : 'In allen Feldern...'}
          />
          <button style={styles.buttonFilter} onClick={handleFilter}>
            Filtern
          </button>
        </div>

        <div style={styles.separator} />

        {/* Actions for selected rows */}
        {selectedRows.length > 0 && (
          <>
            <div style={{ marginLeft: '10px' }}>
              <span style={styles.label}>{selectedRows.length} ausgewählt:</span>
            </div>
            
            <select
              style={styles.select}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleStatusChange(e.target.value as TodoStatus)
                  e.target.value = ''
                }
              }}
            >
              <option value="">Status ändern...</option>
              <option value="new">Neu</option>
              <option value="planned">Geplant</option>
              <option value="in_progress">In Arbeit</option>
              <option value="completed">Erledigt</option>
              <option value="blocked">Blockiert</option>
            </select>
            
            <button style={styles.buttonDanger} onClick={handleDelete}>
              Löschen
            </button>
            
            {/* Bulk date picker */}
            <div style={{ position: 'relative' }}>
              <button 
                style={{ ...styles.button, backgroundColor: '#e3f2fd', borderColor: '#2196f3' }}
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                Startdatum setzen
              </button>
              
              {showDatePicker && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cccccc',
                  borderRadius: '4px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minWidth: '220px',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                    Startdatum für {selectedRows.length} ToDo(s) setzen:
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="date"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      style={{ ...styles.select, flex: 1 }}
                    />
                    <input
                      type="time"
                      value={bulkStartTime}
                      onChange={(e) => setBulkStartTime(e.target.value)}
                      style={{ ...styles.select, width: '90px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      style={styles.button}
                      onClick={() => {
                        setShowDatePicker(false)
                        setBulkStartDate('')
                        setBulkStartTime('09:00')
                      }}
                    >
                      Abbrechen
                    </button>
                    <button 
                      style={{ 
                        ...styles.button, 
                        backgroundColor: '#4caf50', 
                        color: 'white',
                        border: '1px solid #388e3c',
                        opacity: bulkStartDate ? 1 : 0.5,
                        cursor: bulkStartDate ? 'pointer' : 'not-allowed'
                      }}
                      onClick={handleBulkDateChange}
                      disabled={!bulkStartDate}
                    >
                      Anwenden
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Content area - toggles between grid and grouped view */}
      {viewMode === 'flat' ? (
        <div style={styles.gridContainer} className="ag-theme-alpine">
          <AgGridReact
            ref={gridRef}
            rowData={filteredTodos}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onSelectionChanged={onSelectionChanged}
            onRowDoubleClicked={onRowDoubleClicked}
            rowSelection="multiple"
            animateRows={true}
            suppressCellFocus={true}
            getRowId={(params) => String(params.data.id)}
          />
        </div>
      ) : (
        <TodoGroupedView
          todos={filteredTodos}
          resources={resources}
          onTodoDoubleClick={(todo) => setEditingTodo(todo)}
          onDataChanged={loadData}
        />
      )}

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>
          {filteredTodos.length} ToDos angezeigt
          {allTodos.length !== filteredTodos.length && ` (von ${allTodos.length})`}
          {selectedRows.length > 0 && ` | ${selectedRows.length} ausgewählt`}
          {hasActiveTypeFilter && ' | Typ-Filter aktiv'}
          {hasActiveDepartmentOrMachine && ' | Ressourcen-Filter aktiv'}
          {hasActiveSearch && ` | Suche: "${searchText}"`}
        </span>
        <span>
          {loading ? 'Lade...' : 'Doppelklick zum Bearbeiten'}
        </span>
      </div>

      {/* Edit Dialog */}
      {editingTodo && (
        <TodoEditDialog
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
          onSave={handleEditSave}
          onDelete={handleDeleteFromDialog}
        />
      )}
    </div>
  )
}
