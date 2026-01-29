/**
 * Workplan Panel Component
 * Displays workplan (Arbeitsplan) for a packingnote detail - Level 4
 * The workplan is connected via: packingnote_relation.detail = workplan.packingnoteid
 */
import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { WorkplanItem, HierarchyRemark } from '../../services/types'
import remarksApi from '../../services/remarksApi'
import { checkTodoExistence } from '../../services/ppsApi'

interface WorkplanPanelProps {
  detailId: number
  selectedWorkstepIds?: Set<number>
  onWorkstepSelectionChange?: (workstepIds: number[], selected: boolean) => void
  // Todo icon click handler (delegated to parent for context menu)
  onTodoIconClick?: (workstepId: number, todoId: number, event: React.MouseEvent) => void
}

const styles = {
  container: {
    marginLeft: '40px',
    marginTop: '8px',
    marginBottom: '8px',
    backgroundColor: '#fff8e6',
    border: '1px solid #e6d9b3',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  header: {
    backgroundColor: '#f5ecd3',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#666666',
    borderBottom: '1px solid #e6d9b3',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px'
  },
  th: {
    padding: '6px 8px',
    textAlign: 'left' as const,
    backgroundColor: '#faf5e6',
    borderBottom: '1px solid #e6d9b3',
    fontWeight: 'bold' as const,
    color: '#666666'
  },
  td: {
    padding: '5px 8px',
    borderBottom: '1px solid #f0e9d6',
    color: '#333333',
    verticalAlign: 'middle' as const
  },
  loading: {
    padding: '10px',
    textAlign: 'center' as const,
    color: '#666666',
    fontSize: '11px'
  },
  empty: {
    padding: '10px',
    textAlign: 'center' as const,
    color: '#999999',
    fontSize: '11px',
    fontStyle: 'italic' as const
  },
  error: {
    padding: '10px',
    color: '#cc0000',
    fontSize: '11px'
  },
  remarkText: {
    fontWeight: 'bold' as const,
    color: '#666666',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '120px',
    display: 'inline-block',
    fontSize: '10px'
  },
  remarkInput: {
    width: '100%',
    border: '1px solid #ccc',
    borderRadius: '3px',
    padding: '2px 4px',
    fontSize: '10px'
  },
  todoIcon: {
    padding: '2px 4px',
    backgroundColor: '#e8f5e9',
    border: '1px solid #81c784',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '10px',
    color: '#2e7d32'
  },
  todoIconInactive: {
    padding: '2px 4px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #e0e0e0',
    borderRadius: '3px',
    fontSize: '10px',
    color: '#bdbdbd'
  }
}

const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export default function WorkplanPanel({ 
  detailId,
  selectedWorkstepIds,
  onWorkstepSelectionChange,
  onTodoIconClick
}: WorkplanPanelProps) {
  const [items, setItems] = useState<WorkplanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Use external selection if provided, otherwise use local state
  const [localSelectedItems, setLocalSelectedItems] = useState<Set<number>>(new Set())
  const selectedItems = selectedWorkstepIds || localSelectedItems
  const [remarks, setRemarks] = useState<Map<number, HierarchyRemark>>(new Map())
  const [editingRemark, setEditingRemark] = useState<number | null>(null)
  const [remarkText, setRemarkText] = useState('')
  // Todo existence mapping (workplan_detail_id -> todo_id)
  const [workstepTodoMapping, setWorkstepTodoMapping] = useState<Record<number, number>>({})

  useEffect(() => {
    let isMounted = true
    const MAX_RETRIES = 3
    const RETRY_DELAY = 500 // ms
    
    const loadWorkplan = async (retryCount = 0) => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(`/packingnote-details/${detailId}/workplan`)
        
        // Check if component is still mounted
        if (!isMounted) return
        
        const loadedItems = response.data.items || []
        setItems(loadedItems)

        // Load remarks for all items
        const ids = loadedItems
          .map((i: WorkplanItem) => i.workplan_detail_id)
          .filter((id: number | null): id is number => id !== null)
        if (ids.length > 0 && isMounted) {
          const remarksResponse = await remarksApi.getRemarksByLevel('workplan_detail', ids)
          if (isMounted) {
            const remarksMap = new Map<number, HierarchyRemark>()
            remarksResponse.items.forEach(r => remarksMap.set(r.hugwawi_id, r))
            setRemarks(remarksMap)
          }
          
          // Load todo existence for worksteps
          try {
            const todoResponse = await checkTodoExistence({ workstep_ids: ids })
            if (isMounted) {
              setWorkstepTodoMapping(todoResponse.workstep_todos)
            }
          } catch (todoErr) {
            console.error('Error loading workstep todo mappings:', todoErr)
          }
        }
        if (isMounted) setLoading(false)
      } catch (err: any) {
        // Check if component is still mounted
        if (!isMounted) return
        
        // Retry on Network Error (timing issues)
        if (retryCount < MAX_RETRIES && (err.message === 'Network Error' || err.code === 'ERR_NETWORK')) {
          console.log(`[WorkplanPanel] Retry ${retryCount + 1}/${MAX_RETRIES} for detailId:`, detailId)
          setTimeout(() => {
            if (isMounted) loadWorkplan(retryCount + 1)
          }, RETRY_DELAY * (retryCount + 1))
          return
        }
        
        setError(err.response?.data?.detail || 'Fehler beim Laden des Arbeitsplans')
        console.error('Error loading workplan:', err)
        setLoading(false)
      }
    }

    loadWorkplan()
    
    // Cleanup function to prevent state updates on unmounted component
    return () => { isMounted = false }
  }, [detailId])

  const toggleSelect = (workplanDetailId: number) => {
    const isSelected = selectedItems.has(workplanDetailId)
    if (onWorkstepSelectionChange) {
      onWorkstepSelectionChange([workplanDetailId], !isSelected)
    } else {
      setLocalSelectedItems(prev => {
        const next = new Set(prev)
        if (next.has(workplanDetailId)) {
          next.delete(workplanDetailId)
        } else {
          next.add(workplanDetailId)
        }
        return next
      })
    }
  }

  const toggleSelectAll = () => {
    const allIds = items
      .map(i => i.workplan_detail_id)
      .filter((id): id is number => id !== null)
    
    if (onWorkstepSelectionChange) {
      const allSelected = allIds.every(id => selectedItems.has(id))
      onWorkstepSelectionChange(allIds, !allSelected)
    } else {
      if (selectedItems.size === items.length) {
        setLocalSelectedItems(new Set())
      } else {
        setLocalSelectedItems(new Set(allIds))
      }
    }
  }

  const handleRemarkSave = async (workplanDetailId: number) => {
    if (remarkText.trim()) {
      const saved = await remarksApi.saveRemark({
        level_type: 'workplan_detail',
        hugwawi_id: workplanDetailId,
        remark: remarkText.trim()
      })
      setRemarks(prev => new Map(prev).set(workplanDetailId, saved))
    } else {
      const existing = remarks.get(workplanDetailId)
      if (existing) {
        await remarksApi.deleteRemark(existing.id)
        setRemarks(prev => {
          const next = new Map(prev)
          next.delete(workplanDetailId)
          return next
        })
      }
    }
    setEditingRemark(null)
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Arbeitsplan...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>Kein Arbeitsplan vorhanden</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <input
          type="checkbox"
          checked={selectedItems.size === items.length && items.length > 0}
          onChange={toggleSelectAll}
          title="Alle auswählen"
        />
        <span>Arbeitsplan ({items.length} Positionen)</span>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '25px' }}></th>
            <th style={{ ...styles.th, width: '30px' }}>ToDo</th>
            <th style={{ ...styles.th, width: '50px' }}>Pos</th>
            <th style={styles.th}>Arbeitsgang</th>
            <th style={styles.th}>Maschine</th>
            <th style={{ ...styles.th, width: '140px' }}>Bemerkung</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isSelected = item.workplan_detail_id ? selectedItems.has(item.workplan_detail_id) : false
            const remark = item.workplan_detail_id ? remarks.get(item.workplan_detail_id) : null
            const isEditingThis = editingRemark === item.workplan_detail_id
            
            return (
              <tr key={item.workplan_detail_id || index}>
                {/* Checkbox */}
                <td style={styles.td}>
                  {item.workplan_detail_id && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.workplan_detail_id!)}
                    />
                  )}
                </td>
                {/* ToDo Icon */}
                <td style={styles.td}>
                  {item.workplan_detail_id && workstepTodoMapping[item.workplan_detail_id] > 0 ? (
                    <span
                      style={styles.todoIcon}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onTodoIconClick) {
                          onTodoIconClick(item.workplan_detail_id!, workstepTodoMapping[item.workplan_detail_id!], e)
                        }
                      }}
                      title="ToDo vorhanden - Klicken für Optionen"
                    >
                      ✓
                    </span>
                  ) : (
                    <span style={styles.todoIconInactive} title="Kein ToDo">○</span>
                  )}
                </td>
                <td style={styles.td}>{item.pos || '-'}</td>
                <td style={styles.td}>{item.workstep_name || '-'}</td>
                <td style={styles.td}>{item.machine_name || '-'}</td>
                {/* Remark Cell */}
                <td style={styles.td}>
                  {isEditingThis ? (
                    <input
                      type="text"
                      style={styles.remarkInput}
                      value={remarkText}
                      onChange={(e) => setRemarkText(e.target.value)}
                      onBlur={() => item.workplan_detail_id && handleRemarkSave(item.workplan_detail_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && item.workplan_detail_id) handleRemarkSave(item.workplan_detail_id)
                        if (e.key === 'Escape') setEditingRemark(null)
                      }}
                      autoFocus
                      placeholder="Bemerkung..."
                    />
                  ) : (
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setRemarkText(remark?.remark || '')
                        setEditingRemark(item.workplan_detail_id)
                      }}
                    >
                      {remark ? (
                        <span style={styles.remarkText} title={remark.remark}>
                          **{truncateText(remark.remark)}**
                        </span>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: '10px' }}>+ Bem.</span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
