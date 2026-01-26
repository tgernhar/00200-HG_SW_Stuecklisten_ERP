/**
 * Production Planning Page - Main PPS Planboard
 * 
 * Layout:
 * - Toolbar with actions
 * - Left sidebar with resource filter
 * - Main area with DHTMLX Gantt
 * - Bottom panel with conflicts
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import GanttChart, { zoomIn, zoomOut, setZoom, scrollToTask } from '../components/pps/GanttChart'
import ResourcePanel from '../components/pps/ResourcePanel'
import ConflictPanel from '../components/pps/ConflictPanel'
import TodoGeneratorModal from '../components/pps/TodoGeneratorModal'
import TodoEditDialog from '../components/pps/TodoEditDialog'
import ShiftTasksModal from '../components/pps/ShiftTasksModal'
import {
  getGanttData,
  syncGanttData,
  getResources,
  syncResources,
  getConflicts,
  checkConflicts,
  fixDependencyConflicts,
  getWorkingHours,
  getTodoWithERPDetails,
  createTodo,
  batchUpdateTodos,
  shiftAllTodos,
  WorkingHours,
  BatchUpdateItem,
} from '../services/ppsApi'
import {
  GanttData,
  GanttTask,
  GanttLink,
  PPSTodoWithERPDetails,
  PPSTodoCreate,
  GanttSyncRequest,
  PPSResource,
  PPSConflictWithTodos,
  OrderArticleOption,
  BomItemOption,
  WorkstepOption,
  AllWorkstepOption,
} from '../services/ppsTypes'
import { PickerType } from '../components/pps/ErpPickerDialog'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 15px',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #dddddd',
  },
  toolbarTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    marginRight: '20px',
    color: '#333333',
  },
  toolbarButton: {
    padding: '6px 12px',
    backgroundColor: '#ffffff',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
  },
  toolbarButtonPrimary: {
    padding: '6px 12px',
    backgroundColor: '#4a90d9',
    color: '#ffffff',
    border: '1px solid #357abd',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
  },
  toolbarSeparator: {
    width: '1px',
    height: '24px',
    backgroundColor: '#dddddd',
    margin: '0 5px',
  },
  toolbarRight: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  conflictBadge: {
    backgroundColor: '#ff6b6b',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
  },
  mainArea: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebarWrapper: {
    display: 'flex',
    flexShrink: 0,
  },
  sidebar: {
    width: '220px',
    borderRight: '1px solid #dddddd',
    backgroundColor: '#fafafa',
    overflow: 'auto',
  },
  sidebarToggle: {
    width: '16px',
    backgroundColor: '#e8e8e8',
    border: '1px solid #dddddd',
    borderLeft: 'none',
    borderRadius: '0 4px 4px 0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#666666',
    flexShrink: 0,
  },
  ganttContainer: {
    flex: 1,
    overflow: 'auto',  // Changed from 'hidden' to allow scrolling
    position: 'relative' as const,
  },
  conflictContainer: {
    height: '150px',
    borderTop: '1px solid #dddddd',
    backgroundColor: '#fff9f9',
    overflow: 'auto',
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
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666666',
  },
  dateFilterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: '12px',
  },
  dateLabel: {
    fontSize: '12px',
    color: '#666',
  },
  dateInput: {
    padding: '4px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
  },
  error: {
    padding: '20px',
    backgroundColor: '#ffeeee',
    color: '#cc0000',
    borderRadius: '4px',
    margin: '10px',
  },
}

export default function ProductionPlanningPage() {
  // State
  const [ganttData, setGanttData] = useState<GanttData | null>(null)
  const [resources, setResources] = useState<PPSResource[]>([])
  const [conflicts, setConflicts] = useState<PPSConflictWithTodos[]>([])
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [selectedResourceIds, setSelectedResourceIds] = useState<number[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGeneratorModal, setShowGeneratorModal] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<'hour' | 'day' | 'week'>('day')
  const [showResourcePanel, setShowResourcePanel] = useState(true)
  const [resourceLevelFilter, setResourceLevelFilter] = useState<number>(3)  // Default: Level 3 (Standard)
  
  // Edit dialog state
  const [editingTodo, setEditingTodo] = useState<PPSTodoWithERPDetails | null>(null)
  
  // Date filter state - initialize with default range (today -3 to today +7 days)
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  
  // Track pending changes for sync before filter change
  const pendingChangesRef = useRef<GanttSyncRequest | null>(null)
  
  // Refs to track current date filter values (to avoid dependency issues)
  const dateFromRef = useRef<string>('')
  const dateToRef = useRef<string>('')
  
  // Update refs when state changes
  useEffect(() => {
    dateFromRef.current = dateFrom
    dateToRef.current = dateTo
  }, [dateFrom, dateTo])

  // Load data - uses current date filter values from refs
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Load gantt data
      const resourceFilter = selectedResourceIds.length > 0 
        ? selectedResourceIds.join(',') 
        : undefined
      
      // Use refs to get current date filter values
      const currentDateFrom = dateFromRef.current
      const currentDateTo = dateToRef.current
      
      const [ganttResponse, resourcesResponse, conflictsResponse, workingHoursResponse] = await Promise.all([
        getGanttData({ 
          resource_ids: resourceFilter,
          date_from: currentDateFrom || undefined,
          date_to: currentDateTo || undefined,
        }),
        getResources({ is_active: true, max_level: resourceLevelFilter }),
        getConflicts({ resolved: false }),
        getWorkingHours(),
      ])
      
      setGanttData(ganttResponse)
      setResources(resourcesResponse)
      setConflicts(conflictsResponse.items)
      setUnresolvedCount(conflictsResponse.unresolved_count)
      setWorkingHours(workingHoursResponse)
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden'
      setError(message)
      console.error('Error loading PPS data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedResourceIds, resourceLevelFilter])

  // Initial load
  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle resource filter change - sync pending changes before switching
  const handleResourceFilterChange = useCallback(async (resourceIds: number[]) => {
    // Sync any pending changes before filter switch
    if (pendingChangesRef.current) {
      try {
        await syncGanttData(pendingChangesRef.current)
        pendingChangesRef.current = null
      } catch (err) {
        console.error('Error syncing before filter change:', err)
      }
    }
    setSelectedResourceIds(resourceIds)
  }, [])

  // Handle task update from Gantt - immediately sync to server
  const handleTaskUpdate = useCallback(async (taskId: number, task: Partial<GanttTask>) => {
    try {
      const syncRequest: GanttSyncRequest = {
        updated_tasks: [{ id: taskId, ...task }],
        created_tasks: [],
        deleted_task_ids: [],
        updated_links: [],
        created_links: [],
        deleted_link_ids: [],
      }
      
      // Store as pending and sync immediately
      pendingChangesRef.current = syncRequest
      await syncGanttData(syncRequest)
      pendingChangesRef.current = null
      
      // DO NOT reload - Gantt already updated visually, sync is enough
      
    } catch (err) {
      console.error('Error updating task:', err)
    }
  }, [])

  // Handle task delete
  const handleTaskDelete = useCallback(async (taskId: number) => {
    try {
      const syncRequest: GanttSyncRequest = {
        updated_tasks: [],
        created_tasks: [],
        deleted_task_ids: [taskId],
        updated_links: [],
        created_links: [],
        deleted_link_ids: [],
      }
      
      await syncGanttData(syncRequest)
      await loadData()
      
    } catch (err) {
      console.error('Error deleting task:', err)
    }
  }, [loadData])

  // Handle link create
  const handleLinkCreate = useCallback(async (link: Partial<GanttLink>) => {
    try {
      const syncRequest: GanttSyncRequest = {
        updated_tasks: [],
        created_tasks: [],
        deleted_task_ids: [],
        updated_links: [],
        created_links: [link],
        deleted_link_ids: [],
      }
      
      await syncGanttData(syncRequest)
      
    } catch (err) {
      console.error('Error creating link:', err)
    }
  }, [])

  // Handle link delete
  const handleLinkDelete = useCallback(async (linkId: number) => {
    try {
      const syncRequest: GanttSyncRequest = {
        updated_tasks: [],
        created_tasks: [],
        deleted_task_ids: [],
        updated_links: [],
        created_links: [],
        deleted_link_ids: [linkId],
      }
      
      await syncGanttData(syncRequest)
      
    } catch (err) {
      console.error('Error deleting link:', err)
    }
  }, [])

  // Handle batch update (for auto-scheduling linked tasks)
  const handleBatchUpdate = useCallback(async (updates: BatchUpdateItem[]) => {
    try {
      await batchUpdateTodos(updates)
      // No need to reload - Gantt already updated visually
    } catch (err) {
      console.error('Error batch updating tasks:', err)
    }
  }, [])

  // Handle shift all tasks
  const handleShiftAllTasks = useCallback(async (shiftMinutes: number, dateFrom?: string, departmentId?: number) => {
    try {
      setIsSyncing(true)
      const result = await shiftAllTodos({
        shift_minutes: shiftMinutes,
        date_from: dateFrom,
        department_id: departmentId,
      })
      console.log(`Shifted ${result.shifted_count} tasks`)
      setShowShiftModal(false)
      await loadData()
    } catch (err) {
      console.error('Error shifting tasks:', err)
      setError('Fehler beim Verschieben der Tasks')
    } finally {
      setIsSyncing(false)
    }
  }, [loadData])

  // Sync resources
  const handleSyncResources = useCallback(async () => {
    setIsSyncing(true)
    try {
      await syncResources()
      const resourcesResponse = await getResources({ is_active: true, max_level: resourceLevelFilter })
      setResources(resourcesResponse)
    } catch (err) {
      console.error('Error syncing resources:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [resourceLevelFilter])

  // Check conflicts
  const handleCheckConflicts = useCallback(async () => {
    setIsSyncing(true)
    try {
      await checkConflicts()
      const conflictsResponse = await getConflicts({ resolved: false })
      setConflicts(conflictsResponse.items)
      setUnresolvedCount(conflictsResponse.unresolved_count)
    } catch (err) {
      console.error('Error checking conflicts:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // Fix dependency conflicts automatically
  const handleFixDependencyConflicts = useCallback(async () => {
    setIsSyncing(true)
    try {
      const result = await fixDependencyConflicts()
      if (result.success && result.fixed_count > 0) {
        // Reload Gantt data to show updated positions
        const resourceFilter = selectedResourceIds.length > 0 
          ? selectedResourceIds.join(',') 
          : undefined
        const ganttResponse = await getGanttData({
          resource_ids: resourceFilter,
          date_from: dateFromRef.current || undefined,
          date_to: dateToRef.current || undefined,
        })
        setGanttData(ganttResponse)
        
        // Refresh conflicts
        const conflictsResponse = await getConflicts({ resolved: false })
        setConflicts(conflictsResponse.items)
        setUnresolvedCount(conflictsResponse.unresolved_count)
        
        alert(`${result.fixed_count} Abhängigkeit(en) korrigiert`)
      } else if (result.fixed_count === 0) {
        alert('Keine Abhängigkeitskonflikte zu korrigieren')
      }
    } catch (err) {
      console.error('Error fixing dependency conflicts:', err)
      alert('Fehler beim Korrigieren der Abhängigkeiten')
    } finally {
      setIsSyncing(false)
    }
  }, [selectedResourceIds])

  // Handle conflict click - scroll to and select the affected task, filter by resource(s)
  const handleConflictClick = useCallback((conflict: PPSConflictWithTodos) => {
    if (conflict.todo_id) {
      // Find both tasks involved in the conflict to get their resource_ids
      const task = ganttData?.data.find(t => t.id === conflict.todo_id)
      const relatedTask = conflict.related_todo_id 
        ? ganttData?.data.find(t => t.id === conflict.related_todo_id)
        : null
      
      // Store task IDs to select/scroll after data reload
      const taskIdsToSelect = [conflict.todo_id]
      if (conflict.related_todo_id) {
        taskIdsToSelect.push(conflict.related_todo_id)
      }
      
      // If one task is not in current view, we need to show all resources
      // to ensure both conflict tasks are visible
      const taskNotInView = !task || (conflict.related_todo_id && !relatedTask)
      
      if (taskNotInView) {
        // Clear filter to show all resources (both tasks will be visible)
        setSelectedResourceIds([])
        
        // Wait for data reload, then select and scroll
        setTimeout(() => {
          setSelectedTaskIds(taskIdsToSelect)
          scrollToTask(conflict.todo_id, conflict.related_todo_id || undefined)
        }, 500)
      } else {
        // Both tasks are in view, collect their resource IDs
        const resourceIds: number[] = []
        if (task?.resource_id) {
          resourceIds.push(task.resource_id)
        }
        if (relatedTask?.resource_id && !resourceIds.includes(relatedTask.resource_id)) {
          resourceIds.push(relatedTask.resource_id)
        }
        
        if (resourceIds.length > 0) {
          // Set filter to show resources involved in conflict (triggers data reload)
          setSelectedResourceIds(resourceIds)
          
          // Wait for data reload, then select both tasks and scroll to first one
          setTimeout(() => {
            setSelectedTaskIds(taskIdsToSelect)
            scrollToTask(conflict.todo_id, conflict.related_todo_id || undefined)
          }, 500)
        } else {
          // No filter change needed, select and scroll immediately
          setSelectedTaskIds(taskIdsToSelect)
          scrollToTask(conflict.todo_id, conflict.related_todo_id || undefined)
        }
      }
    }
  }, [ganttData])

  // Handle generator success
  const handleGeneratorSuccess = useCallback(() => {
    setShowGeneratorModal(false)
    loadData()
  }, [loadData])

  // Handle task edit - opens TodoEditDialog instead of DHTMLX lightbox
  const handleTaskEdit = useCallback(async (taskId: number) => {
    try {
      const todoWithErp = await getTodoWithERPDetails(taskId)
      // Find current Gantt task to get its type
      // Note: taskId might be string from event, but ganttData IDs are numbers
      const ganttTask = ganttData?.data.find(t => t.id === Number(taskId))
      setEditingTodo({ ...todoWithErp, gantt_type: ganttTask?.type })
    } catch (err) {
      console.error('Error loading todo for edit:', err)
    }
  }, [ganttData])

  // Handle save from edit dialog
  const handleEditSave = useCallback((updatedTodo: PPSTodoWithERPDetails, ganttType?: 'task' | 'project' | 'milestone') => {
    setEditingTodo(null)
    // Always do a full reload to ensure consistency
    loadData()
  }, [loadData])

  // Handle delete from edit dialog
  const handleDeleteFromDialog = useCallback((todoId: number) => {
    setEditingTodo(null)
    loadData()
  }, [loadData])

  // Handle creating new todos from picker selection
  const handleCreateFromPicker = useCallback(async (
    selectedItems: Array<OrderArticleOption | BomItemOption | WorkstepOption>,
    pickerType: PickerType
  ) => {
    if (!editingTodo) return
    
    try {
      // Get planned_start from editing todo (convert from ISO to backend format)
      const parentPlannedStart = editingTodo.planned_start 
        ? editingTodo.planned_start.replace('T', ' ').slice(0, 19)
        : undefined
      
      for (const item of selectedItems) {
        let newTodo: PPSTodoCreate
        
        switch (pickerType) {
          case 'article': {
            const articleItem = item as OrderArticleOption
            newTodo = {
              todo_type: 'container_article',
              title: `Pos ${articleItem.position || ''}: ${articleItem.articlenumber} - ${articleItem.description || ''}`.slice(0, 255),
              erp_order_id: editingTodo.erp_order_id,
              erp_order_article_id: articleItem.id,
              parent_todo_id: editingTodo.id,
              quantity: articleItem.quantity || 1,
              priority: 50,
              status: 'new',
              planned_start: parentPlannedStart,
            }
            break
          }
          case 'bom': {
            const bomItem = item as BomItemOption
            newTodo = {
              todo_type: 'operation',  // BOM items become operations
              title: `Stückliste ${bomItem.position || ''}: ${bomItem.articlenumber} - ${bomItem.description || ''}`.slice(0, 255),
              erp_order_id: editingTodo.erp_order_id,
              erp_order_article_id: editingTodo.erp_order_article_id,
              erp_packingnote_details_id: bomItem.id,
              parent_todo_id: editingTodo.id,
              quantity: Math.round(bomItem.quantity || 1),
              priority: 50,
              status: 'new',
              planned_start: parentPlannedStart,
            }
            break
          }
          case 'workstep': {
            const workstepItem = item as WorkstepOption
            newTodo = {
              todo_type: 'operation',
              title: `AG ${workstepItem.position || ''}: ${workstepItem.name}${workstepItem.machine_name ? ` (${workstepItem.machine_name})` : ''}`.slice(0, 255),
              erp_order_id: editingTodo.erp_order_id,
              erp_order_article_id: editingTodo.erp_order_article_id,
              erp_packingnote_details_id: editingTodo.erp_packingnote_details_id,
              erp_workplan_detail_id: workstepItem.id,
              parent_todo_id: editingTodo.id,
              setup_time_minutes: workstepItem.setuptime ? Math.round(workstepItem.setuptime) : undefined,
              run_time_minutes: workstepItem.unittime ? Math.round(workstepItem.unittime) : undefined,
              priority: 50,
              status: 'new',
              planned_start: parentPlannedStart,
            }
            break
          }
          case 'generic_workstep': {
            // Generic workstep from workstep table (not from workplan)
            const genericWorkstep = item as AllWorkstepOption
            newTodo = {
              todo_type: 'operation',
              title: `AG: ${genericWorkstep.name}`.slice(0, 255),
              erp_order_id: editingTodo.erp_order_id,
              erp_order_article_id: editingTodo.erp_order_article_id,
              parent_todo_id: editingTodo.id,
              total_duration_minutes: 60,  // Default duration for generic workstep
              priority: 50,
              status: 'new',
              planned_start: parentPlannedStart,
            }
            break
          }
        }
        
        await createTodo(newTodo)
      }
      
      // Close dialog and reload data
      setEditingTodo(null)
      loadData()
    } catch (err) {
      console.error('Error creating todos from picker:', err)
      alert('Fehler beim Erstellen der Todos: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler'))
    }
  }, [editingTodo, loadData])

  // Render loading state
  if (loading && !ganttData) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Planboard...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>Produktionsplanung - Planboard</span>
        
        <button
          style={styles.toolbarButtonPrimary}
          onClick={() => setShowGeneratorModal(true)}
          disabled={isSyncing}
        >
          + Aus Auftrag generieren
        </button>
        
        <div style={styles.toolbarSeparator} />
        
        <button
          style={styles.toolbarButton}
          onClick={handleSyncResources}
          disabled={isSyncing}
        >
          Ressourcen sync
        </button>
        
        <button
          style={styles.toolbarButton}
          onClick={handleCheckConflicts}
          disabled={isSyncing}
        >
          Konflikte prüfen
        </button>
        
        <button
          style={styles.toolbarButton}
          onClick={() => setShowShiftModal(true)}
          disabled={isSyncing}
          title="Alle Tasks um einen Zeitraum verschieben"
        >
          Tasks verschieben
        </button>
        
        <div style={styles.toolbarSeparator} />
        
        {/* Zoom controls */}
        <button
          style={styles.toolbarButton}
          onClick={() => {
            zoomIn()
            setZoomLevel(prev => prev === 'week' ? 'day' : prev === 'day' ? 'hour' : 'hour')
          }}
          title="Zoom vergrößern"
        >
          Zoom +
        </button>
        <button
          style={styles.toolbarButton}
          onClick={() => {
            zoomOut()
            setZoomLevel(prev => prev === 'hour' ? 'day' : prev === 'day' ? 'week' : 'week')
          }}
          title="Zoom verkleinern"
        >
          Zoom -
        </button>
        <span style={{ fontSize: '11px', color: '#666', marginRight: '8px' }}>
          {zoomLevel === 'hour' ? 'Stunde' : zoomLevel === 'day' ? 'Tag' : 'Woche'}
        </span>
        
        <div style={styles.toolbarSeparator} />
        
        {/* Date range filter */}
        <div style={styles.dateFilterGroup}>
          <span style={styles.dateLabel}>Von:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={styles.dateInput}
          />
          <span style={styles.dateLabel}>Bis:</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={styles.dateInput}
          />
          <button
            style={styles.toolbarButton}
            onClick={() => loadData()}
            disabled={isSyncing}
          >
            Anwenden
          </button>
          {(dateFrom || dateTo) && (
            <button
              style={styles.toolbarButton}
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                // Reload after clearing - use setTimeout to ensure state is updated
                setTimeout(() => loadData(), 0)
              }}
              disabled={isSyncing}
              title="Datumsfilter zurücksetzen"
            >
              ×
            </button>
          )}
        </div>
        
        <div style={styles.toolbarSeparator} />
        
        <button
          style={{
            ...styles.toolbarButton,
            ...(selectedTaskIds.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            color: selectedTaskIds.length > 0 ? '#cc0000' : undefined,
          }}
          onClick={() => {
            if (selectedTaskIds.length > 0 && window.confirm('Ausgewählte ToDos wirklich löschen?')) {
              selectedTaskIds.forEach(id => handleTaskDelete(id))
            }
          }}
          disabled={selectedTaskIds.length === 0 || isSyncing}
        >
          ToDo löschen
        </button>
        
        <div style={styles.toolbarRight}>
          {unresolvedCount > 0 && (
            <span style={styles.conflictBadge}>
              {unresolvedCount} Konflikte
            </span>
          )}
          
          <button
            style={styles.toolbarButton}
            onClick={loadData}
            disabled={loading}
          >
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={styles.error}>
          {error}
          <button 
            style={{ marginLeft: '10px', ...styles.toolbarButton }} 
            onClick={loadData}
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Main area */}
      <div style={styles.mainArea}>
        {/* Resource sidebar with toggle - collapsible */}
        <div style={styles.sidebarWrapper}>
          {showResourcePanel && (
            <div style={styles.sidebar}>
              <ResourcePanel
                resources={resources}
                selectedIds={selectedResourceIds}
                onSelectionChange={handleResourceFilterChange}
                resourceLevelFilter={resourceLevelFilter}
                onLevelChange={setResourceLevelFilter}
              />
            </div>
          )}
          <button
            style={styles.sidebarToggle}
            onClick={() => setShowResourcePanel(prev => !prev)}
            title={showResourcePanel ? 'Filter ausblenden' : 'Filter einblenden'}
          >
            {showResourcePanel ? '◄' : '►'}
          </button>
        </div>

        {/* Gantt chart */}
        <div style={styles.ganttContainer}>
          {ganttData ? (
            <GanttChart
              data={ganttData}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              onTaskEdit={handleTaskEdit}
              onLinkCreate={handleLinkCreate}
              onLinkDelete={handleLinkDelete}
              onBatchUpdate={handleBatchUpdate}
              onSelectionChange={setSelectedTaskIds}
              workingHours={workingHours}
              dateFrom={dateFrom}
              dateTo={dateTo}
              height="100%"
            />
          ) : (
            <div style={styles.loading}>
              Keine Daten vorhanden. Generieren Sie ToDos aus einem Auftrag.
            </div>
          )}
        </div>
      </div>

      {/* Conflict panel */}
      {conflicts.length > 0 && (
        <div style={styles.conflictContainer}>
          <ConflictPanel
            conflicts={conflicts}
            onConflictClick={handleConflictClick}
            onRefresh={handleCheckConflicts}
            onFixDependencies={handleFixDependencyConflicts}
          />
        </div>
      )}

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>
          {ganttData?.data.length || 0} ToDos geladen
          {selectedTaskIds.length > 0 && ` | ${selectedTaskIds.length} ausgewählt`}
        </span>
        <span>
          {isSyncing ? 'Synchronisiere...' : 'Bereit'}
        </span>
      </div>

      {/* Todo Generator Modal */}
      {showGeneratorModal && (
        <TodoGeneratorModal
          onClose={() => setShowGeneratorModal(false)}
          onSuccess={handleGeneratorSuccess}
        />
      )}

      {/* Todo Edit Dialog */}
      {editingTodo && (
        <TodoEditDialog
          todo={editingTodo}
          ganttType={(editingTodo as any).gantt_type}
          showGanttType={true}
          onClose={() => setEditingTodo(null)}
          onSave={handleEditSave}
          onDelete={handleDeleteFromDialog}
          onCreateFromPicker={handleCreateFromPicker}
        />
      )}

      {/* Shift Tasks Modal */}
      {showShiftModal && (
        <ShiftTasksModal
          onClose={() => setShowShiftModal(false)}
          onShift={handleShiftAllTasks}
          departments={resources.filter(r => r.resource_type === 'department').map(r => ({ id: r.id, name: r.name }))}
          currentDateFrom={dateFrom}
        />
      )}
    </div>
  )
}
