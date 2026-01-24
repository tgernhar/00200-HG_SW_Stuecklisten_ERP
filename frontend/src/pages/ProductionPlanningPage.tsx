/**
 * Production Planning Page - Main PPS Planboard
 * 
 * Layout:
 * - Toolbar with actions
 * - Left sidebar with resource filter
 * - Main area with DHTMLX Gantt
 * - Bottom panel with conflicts
 */
import React, { useState, useEffect, useCallback } from 'react'
import GanttChart from '../components/pps/GanttChart'
import ResourcePanel from '../components/pps/ResourcePanel'
import ConflictPanel from '../components/pps/ConflictPanel'
import TodoGeneratorModal from '../components/pps/TodoGeneratorModal'
import {
  getGanttData,
  syncGanttData,
  getResources,
  syncResources,
  getConflicts,
  checkConflicts,
} from '../services/ppsApi'
import {
  GanttData,
  GanttTask,
  GanttLink,
  GanttSyncRequest,
  PPSResource,
  PPSConflictWithTodos,
} from '../services/ppsTypes'

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
  sidebar: {
    width: '220px',
    borderRight: '1px solid #dddddd',
    backgroundColor: '#fafafa',
    overflow: 'auto',
  },
  ganttContainer: {
    flex: 1,
    overflow: 'hidden',
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
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGeneratorModal, setShowGeneratorModal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Load gantt data
      const resourceFilter = selectedResourceIds.length > 0 
        ? selectedResourceIds.join(',') 
        : undefined
      
      const [ganttResponse, resourcesResponse, conflictsResponse] = await Promise.all([
        getGanttData({ resource_ids: resourceFilter }),
        getResources({ is_active: true }),
        getConflicts({ resolved: false }),
      ])
      
      setGanttData(ganttResponse)
      setResources(resourcesResponse)
      setConflicts(conflictsResponse.items)
      setUnresolvedCount(conflictsResponse.unresolved_count)
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden'
      setError(message)
      console.error('Error loading PPS data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedResourceIds])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle resource filter change
  const handleResourceFilterChange = useCallback((resourceIds: number[]) => {
    setSelectedResourceIds(resourceIds)
  }, [])

  // Handle task update from Gantt
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
      
      await syncGanttData(syncRequest)
      
      // Reload conflicts
      const conflictsResponse = await getConflicts({ resolved: false })
      setConflicts(conflictsResponse.items)
      setUnresolvedCount(conflictsResponse.unresolved_count)
      
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

  // Sync resources
  const handleSyncResources = useCallback(async () => {
    setIsSyncing(true)
    try {
      await syncResources()
      const resourcesResponse = await getResources({ is_active: true })
      setResources(resourcesResponse)
    } catch (err) {
      console.error('Error syncing resources:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [])

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

  // Handle conflict click
  const handleConflictClick = useCallback((conflict: PPSConflictWithTodos) => {
    if (conflict.todo_id) {
      setSelectedTaskIds([conflict.todo_id])
      // Scroll to task in Gantt (handled by GanttChart)
    }
  }, [])

  // Handle generator success
  const handleGeneratorSuccess = useCallback(() => {
    setShowGeneratorModal(false)
    loadData()
  }, [loadData])

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
        {/* Resource sidebar */}
        <div style={styles.sidebar}>
          <ResourcePanel
            resources={resources}
            selectedIds={selectedResourceIds}
            onSelectionChange={handleResourceFilterChange}
          />
        </div>

        {/* Gantt chart */}
        <div style={styles.ganttContainer}>
          {ganttData ? (
            <GanttChart
              data={ganttData}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              onLinkCreate={handleLinkCreate}
              onLinkDelete={handleLinkDelete}
              onSelectionChange={setSelectedTaskIds}
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
    </div>
  )
}
