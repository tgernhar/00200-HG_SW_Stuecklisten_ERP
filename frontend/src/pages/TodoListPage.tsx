/**
 * Todo List Page - Tabular view of all PPS ToDos
 * 
 * Features:
 * - AG-Grid table with all todos
 * - Sorting by priority, date
 * - Filtering by status, resource, order
 * - Quick edit functionality
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, GridReadyEvent, ValueFormatterParams, CellClickedEvent } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { getTodos, getResources, deleteTodo, updateTodo } from '../services/ppsApi'
import { PPSTodo, PPSResource, TodoStatus } from '../services/ppsTypes'

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
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  label: {
    fontSize: '12px',
    color: '#666666',
  },
  select: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
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
  const [todos, setTodos] = useState<PPSTodo[]>([])
  const [resources, setResources] = useState<PPSResource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<PPSTodo[]>([])
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [resourceFilter, setResourceFilter] = useState<string>('')

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [todosResponse, resourcesResponse] = await Promise.all([
        getTodos({ 
          status: statusFilter || undefined,
          limit: 1000 
        }),
        getResources({ is_active: true }),
      ])
      
      // Sort by planned_start descending (newest first)
      const sortedTodos = [...todosResponse.items].sort((a, b) => {
        // First by priority (1 = highest)
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        // Then by planned_start (newest first)
        if (!a.planned_start && !b.planned_start) return 0
        if (!a.planned_start) return 1
        if (!b.planned_start) return -1
        return new Date(b.planned_start).getTime() - new Date(a.planned_start).getTime()
      })
      
      setTodos(sortedTodos)
      setResources(resourcesResponse)
    } catch (err) {
      console.error('Error loading todos:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Get resource name by ID
  const getResourceName = useCallback((departmentId?: number, machineId?: number, employeeId?: number) => {
    const id = machineId || employeeId || departmentId
    if (!id) return '-'
    const resource = resources.find(r => r.id === id)
    return resource?.name || '-'
  }, [resources])

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
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
      width: 120,
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
  const onSelectionChanged = useCallback((event: { api: { getSelectedRows: () => PPSTodo[] } }) => {
    setSelectedRows(event.api.getSelectedRows())
  }, [])

  // Handle delete
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

  // Filter todos by resource
  const filteredTodos = useMemo(() => {
    if (!resourceFilter) return todos
    const resourceId = parseInt(resourceFilter)
    return todos.filter(t => 
      t.assigned_department_id === resourceId ||
      t.assigned_machine_id === resourceId ||
      t.assigned_employee_id === resourceId
    )
  }, [todos, resourceFilter])

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Auftrags-ToDos</span>
        <button style={styles.button} onClick={loadData} disabled={loading}>
          Aktualisieren
        </button>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
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

        {/* Resource filter */}
        <div style={styles.filterGroup}>
          <span style={styles.label}>Ressource:</span>
          <select
            style={styles.select}
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
          >
            <option value="">Alle</option>
            {resources.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.resource_type})
              </option>
            ))}
          </select>
        </div>

        {/* Actions for selected rows */}
        {selectedRows.length > 0 && (
          <>
            <div style={{ marginLeft: '20px', borderLeft: '1px solid #ddd', paddingLeft: '20px' }}>
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
          </>
        )}
      </div>

      {/* Grid */}
      <div style={styles.gridContainer} className="ag-theme-alpine">
        <AgGridReact
          rowData={filteredTodos}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          onSelectionChanged={onSelectionChanged}
          rowSelection="multiple"
          animateRows={true}
          suppressCellFocus={true}
          getRowId={(params) => String(params.data.id)}
        />
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>
          {filteredTodos.length} ToDos angezeigt
          {selectedRows.length > 0 && ` | ${selectedRows.length} ausgewählt`}
        </span>
        <span>
          {loading ? 'Lade...' : 'Bereit'}
        </span>
      </div>
    </div>
  )
}
