/**
 * Todo Edit Dialog - Reusable dialog for editing PPS todos
 * 
 * Styled like the Planboard Lightbox with orange header.
 * Can be used in both ProductionPlanningPage (Gantt) and TodoListPage.
 * 
 * Supports:
 * - Editing existing todos
 * - Creating new todos from ERP hierarchy via "+" buttons
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { updateTodo, getResources, deleteTodo, createTodo, getTodoDependencies, createDependency, deleteDependency, getQualifiedMachinesForWorkplanDetail } from '../../services/ppsApi'
import { MachineOption } from '../../services/ppsTypes'
import { PPSTodoWithERPDetails, PPSTodoUpdate, PPSTodoCreate, PPSResource, TodoStatus, TodoType, OrderArticleOption, BomItemOption, WorkstepOption, AllWorkstepOption, PPSTodo } from '../../services/ppsTypes'
import ErpPickerDialog, { PickerType } from './ErpPickerDialog'
import RichTextEditor from './RichTextEditor'
import EntityImageField from '../common/EntityImageField'

interface TodoEditDialogProps {
  todo: PPSTodoWithERPDetails
  ganttType?: 'task' | 'project' | 'milestone'  // Gantt display type (optional, for Planboard)
  showGanttType?: boolean  // Show Gantt type field (true for Planboard context)
  onClose: () => void
  onSave: (updatedTodo: PPSTodoWithERPDetails, ganttType?: 'task' | 'project' | 'milestone') => void
  onDelete?: (todoId: number) => void
  onCreateFromPicker?: (selectedItems: Array<OrderArticleOption | BomItemOption | WorkstepOption | AllWorkstepOption>, pickerType: PickerType) => void
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
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '1000px',  // Wide dialog for large article image
    minHeight: '700px',  // Taller dialog
    maxHeight: '95vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  // Orange header like Planboard Lightbox
  header: {
    padding: '8px 12px',
    backgroundColor: '#f5a623',
    borderBottom: '1px solid #e09000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: '13px',
    color: '#333333',
    fontWeight: 'normal' as const,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#333333',
    padding: '0 4px',
    lineHeight: 1,
  },
  body: {
    padding: '12px',
    overflow: 'auto',
    flex: 1,
  },
  formGroup: {
    marginBottom: '10px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#555555',
    marginBottom: '3px',
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  },
  inputReadonly: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #e0e0e0',
    borderRadius: '3px',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
    backgroundColor: '#f5f5f5',
    color: '#666666',
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
    backgroundColor: '#ffffff',
  },
  textarea: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
    minHeight: '80px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  row: {
    display: 'flex',
    gap: '10px',
  },
  col: {
    flex: 1,
  },
  col2: {
    flex: 2,
  },
  // ERP Reference section
  erpSection: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '3px',
    border: '1px solid #e8e8e8',
  },
  erpRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '4px',
    fontSize: '11px',
  },
  erpLabel: {
    width: '120px',
    color: '#666666',
    fontWeight: 'bold' as const,
  },
  erpValue: {
    flex: 1,
    color: '#333333',
    padding: '2px 6px',
    backgroundColor: '#ffffff',
    border: '1px solid #e0e0e0',
    borderRadius: '2px',
  },
  erpValueEmpty: {
    flex: 1,
    color: '#999999',
    padding: '2px 6px',
    backgroundColor: '#fafafa',
    border: '1px solid #e0e0e0',
    borderRadius: '2px',
    fontStyle: 'italic' as const,
  },
  erpValueHighlight: {
    flex: 1,
    color: '#2e7d32',
    padding: '2px 6px',
    backgroundColor: '#e8f5e9',
    border: '1px solid #a5d6a7',
    borderRadius: '2px',
    fontWeight: 500,
  },
  plusButton: {
    width: '22px',
    height: '22px',
    padding: 0,
    marginRight: '6px',
    border: '1px solid #4caf50',
    borderRadius: '3px',
    backgroundColor: '#ffffff',
    color: '#4caf50',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  plusButtonHover: {
    backgroundColor: '#4caf50',
    color: '#ffffff',
  },
  plusButtonDisabled: {
    border: '1px solid #ccc',
    color: '#ccc',
    cursor: 'not-allowed',
  },
  // Footer with buttons
  footer: {
    padding: '10px 12px',
    borderTop: '1px solid #dddddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  footerLeft: {
    display: 'flex',
    gap: '8px',
  },
  footerRight: {
    display: 'flex',
    gap: '8px',
  },
  buttonSave: {
    padding: '6px 14px',
    border: '1px solid #4a8f29',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    backgroundColor: '#5cb85c',
    color: '#ffffff',
    fontWeight: 'bold' as const,
  },
  buttonCancel: {
    padding: '6px 14px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    backgroundColor: '#f5f5f5',
    color: '#333333',
  },
  buttonDelete: {
    padding: '6px 14px',
    border: '1px solid #c9302c',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    backgroundColor: '#d9534f',
    color: '#ffffff',
    fontWeight: 'bold' as const,
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    padding: '8px',
    backgroundColor: '#ffeeee',
    color: '#cc0000',
    borderRadius: '3px',
    fontSize: '11px',
    marginTop: '8px',
  },
  // Time section with +/- controls
  timeSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '3px',
    border: '1px solid #e8e8e8',
  },
  timeLabel: {
    fontSize: '11px',
    color: '#666666',
  },
  timeInput: {
    width: '60px',
    padding: '4px 6px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  timeButton: {
    width: '24px',
    height: '24px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tab navigation
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #ddd',
    marginBottom: '12px',
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#666',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
  },
  tabActive: {
    color: '#4a90d9',
    borderBottomColor: '#4a90d9',
    fontWeight: 'bold' as const,
  },
  // Dependencies section
  dependencyList: {
    marginBottom: '16px',
  },
  dependencyListTitle: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    marginBottom: '8px',
    color: '#333',
  },
  dependencyItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    marginBottom: '4px',
    fontSize: '12px',
  },
  dependencyRemoveButton: {
    background: 'none',
    border: 'none',
    color: '#d9534f',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
  },
  dependencyAddButton: {
    padding: '6px 12px',
    border: '1px solid #4a90d9',
    borderRadius: '4px',
    backgroundColor: '#fff',
    color: '#4a90d9',
    cursor: 'pointer',
    fontSize: '12px',
    marginTop: '8px',
  },
  dependencyEmpty: {
    padding: '12px',
    textAlign: 'center' as const,
    color: '#999',
    fontSize: '12px',
    fontStyle: 'italic' as const,
  },
}

// Status options
const statusOptions: { value: TodoStatus; label: string }[] = [
  { value: 'new', label: 'Neu' },
  { value: 'planned', label: 'Geplant' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'completed', label: 'Erledigt' },
  { value: 'blocked', label: 'Blockiert' },
]

// Type options
const typeOptions: { value: TodoType; label: string }[] = [
  { value: 'container_order', label: 'Auftrag (alt)' },
  { value: 'container_article', label: 'Artikel (alt)' },
  { value: 'operation', label: 'Arbeitsgang' },
  { value: 'eigene', label: 'Eigene' },
  { value: 'task', label: 'Aufgabe' },
  { value: 'project', label: 'Projekt' },
]

export default function TodoEditDialog({
  todo,
  ganttType: initialGanttType,
  showGanttType = false,
  onClose,
  onSave,
  onDelete,
  onCreateFromPicker,
}: TodoEditDialogProps) {
  // Form state
  const [title, setTitle] = useState(todo.title)
  const [priority, setPriority] = useState<number | ''>(todo.priority)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'details' | 'dependencies'>('details')
  
  // Dependencies state
  const [predecessors, setPredecessors] = useState<PPSTodo[]>([])
  const [successors, setSuccessors] = useState<PPSTodo[]>([])
  const [loadingDependencies, setLoadingDependencies] = useState(false)
  
  // Picker dialog state
  const [pickerType, setPickerType] = useState<PickerType | null>(null)
  const [pickerParentId, setPickerParentId] = useState<number | null>(null)
  const [hoveredPlusButton, setHoveredPlusButton] = useState<string | null>(null)
  const [todoType, setTodoType] = useState<TodoType>(todo.todo_type)
  const [ganttType, setGanttType] = useState<'task' | 'project' | 'milestone'>(
    initialGanttType || (
      todo.todo_type.startsWith('container') 
        ? 'project' 
        : 'task'
    )
  )
  const [description, setDescription] = useState(todo.description || '')
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  // Show toast that auto-hides after 2 seconds
  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 2000)
  }
  
  // Handle priority changes - allow empty input during editing
  const handlePriorityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    // Allow empty string during editing
    if (newValue === '') {
      setPriority('' as any)  // Temporarily allow empty
      return
    }
    const numValue = parseInt(newValue)
    if (!isNaN(numValue)) {
      setPriority(numValue)
    }
  }
  
  // Validate priority on blur - ensure it's within range
  const handlePriorityBlur = () => {
    if (priority === '' || priority < 1) {
      setPriority(50)  // Default fallback
    } else if (priority > 100) {
      setPriority(100)  // Max value
    }
  }
  const [status, setStatus] = useState<TodoStatus>(todo.status)
  const [plannedStart, setPlannedStart] = useState(() => {
    if (!todo.planned_start) return ''
    
    // Handle both formats: "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS"
    const normalized = todo.planned_start.includes('T') 
      ? todo.planned_start.slice(0, 19)  // Already ISO format
      : todo.planned_start.replace(' ', 'T').slice(0, 19)  // Convert to ISO
    
    return normalized
  })
  const [totalDurationMinutes, setTotalDurationMinutes] = useState(
    todo.total_duration_minutes || 60
  )
  
  // Resource assignment
  const [assignedDepartmentId, setAssignedDepartmentId] = useState<number | null>(
    todo.assigned_department_id || null
  )
  const [assignedMachineId, setAssignedMachineId] = useState<number | null>(
    todo.assigned_machine_id || null
  )
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<number | null>(
    todo.assigned_employee_id || null
  )
  
  // Progress
  const [progress, setProgress] = useState(todo.progress || 0)
  
  // Resources
  const [departments, setDepartments] = useState<PPSResource[]>([])
  const [machines, setMachines] = useState<PPSResource[]>([])
  const [employees, setEmployees] = useState<PPSResource[]>([])
  // Qualified machines based on workplan_detail (workstep)
  const [qualifiedMachineIds, setQualifiedMachineIds] = useState<Set<number> | null>(null)
  
  // State
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load resources
  useEffect(() => {
    const loadResources = async () => {
      try {
        const resources = await getResources({ is_active: true })
        const deps = resources.filter(r => r.resource_type === 'department')
        const machs = resources.filter(r => r.resource_type === 'machine')
        const emps = resources.filter(r => r.resource_type === 'employee')
        setDepartments(deps)
        setMachines(machs)
        setEmployees(emps)
      } catch (err) {
        console.error('Error loading resources:', err)
      }
    }
    loadResources()
  }, [])
  
  // Load qualified machines if todo has a workplan_detail (workstep)
  useEffect(() => {
    const loadQualifiedMachines = async () => {
      if (!todo.erp_workplan_detail_id) {
        setQualifiedMachineIds(null)
        return
      }
      try {
        const qualifiedMachines = await getQualifiedMachinesForWorkplanDetail(todo.erp_workplan_detail_id)
        // Convert to Set of ERP IDs (qualificationitem.id = erp_id in our resource cache)
        const erpIds = new Set(qualifiedMachines.map(m => m.id))
        setQualifiedMachineIds(erpIds)
      } catch (err) {
        console.error('Error loading qualified machines:', err)
        setQualifiedMachineIds(null)
      }
    }
    loadQualifiedMachines()
  }, [todo.erp_workplan_detail_id])

  // Load dependencies when dependencies tab is selected
  useEffect(() => {
    if (activeTab === 'dependencies' && todo.id) {
      const loadDependencies = async () => {
        setLoadingDependencies(true)
        try {
          const deps = await getTodoDependencies(todo.id)
          setPredecessors(deps.predecessors)
          setSuccessors(deps.successors)
        } catch (err) {
          console.error('Error loading dependencies:', err)
        } finally {
          setLoadingDependencies(false)
        }
      }
      loadDependencies()
    }
  }, [activeTab, todo.id])


  // Calculate end date from start and duration
  const calculateEndDate = (): string => {
    if (!plannedStart || !totalDurationMinutes) return ''
    const start = new Date(plannedStart)
    const end = new Date(start.getTime() + totalDurationMinutes * 60 * 1000)
    return end.toLocaleString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  // Handle save
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    
    try {
      // Format planned_start correctly for backend
      let formattedPlannedStart: string | undefined = undefined
      if (plannedStart) {
        // plannedStart is already in ISO format (YYYY-MM-DDTHH:MM:SS)
        // Backend expects YYYY-MM-DD HH:MM:SS format
        formattedPlannedStart = plannedStart.replace('T', ' ')
      }
      
      const updateData: PPSTodoUpdate = {
        title: title !== todo.title ? title : undefined,  // Only send if changed
        description: description.trim() || undefined,
        status,
        priority: typeof priority === 'number' ? priority : 50,  // Ensure number before sending
        planned_start: formattedPlannedStart,
        total_duration_minutes: totalDurationMinutes,
        assigned_department_id: assignedDepartmentId || undefined,
        assigned_machine_id: assignedMachineId || undefined,
        assigned_employee_id: assignedEmployeeId || undefined,
        gantt_display_type: showGanttType ? ganttType : undefined,  // Only send if Planboard context
        progress: progress,  // 0.0 - 1.0
        version: todo.version,
      }
      
      const updated = await updateTodo(todo.id, updateData)
      // Merge ERP details from original todo since they don't change
      const updatedWithErp: PPSTodoWithERPDetails = {
        ...updated,
        order_name: todo.order_name,
        order_article_number: todo.order_article_number,
        bom_article_number: todo.bom_article_number,
        workstep_name: todo.workstep_name,
      }
      // Pass ganttType back to parent (for Planboard to update Gantt display)
      onSave(updatedWithErp, ganttType)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Speichern'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!onDelete) return
    if (!window.confirm('ToDo wirklich löschen?')) return
    
    setDeleting(true)
    setError(null)
    
    try {
      await deleteTodo(todo.id)
      onDelete(todo.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Löschen'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  // Round duration to 15-minute intervals (REQ-TODO-010, REQ-CAL-001)
  // Uses 7.5-minute threshold: < 7.5 remainder -> down, >= 7.5 remainder -> up
  const roundTo15Minutes = (minutes: number): number => {
    if (minutes <= 0) return 15
    const rounded = Math.round(minutes / 15) * 15
    return Math.max(15, rounded)  // Minimum 15 minutes
  }
  
  // Handle manual duration input - no rounding during typing
  const handleDurationChange = (value: string) => {
    const parsed = parseInt(value)
    if (!isNaN(parsed) && parsed >= 0) {
      setTotalDurationMinutes(parsed)
    }
  }
  
  // Round duration when field loses focus
  const handleDurationBlur = () => {
    const rounded = roundTo15Minutes(totalDurationMinutes)
    setTotalDurationMinutes(rounded)
  }
  
  // Copy path to clipboard with user feedback
  const copyToClipboard = (path: string) => {
    navigator.clipboard.writeText(path).then(() => {
      showToast('✓ Pfad kopiert')
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = path
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showToast('✓ Pfad kopiert')
    })
  }

  // Format date range for header
  const formatDateRange = (): string => {
    if (!plannedStart) return ''
    const start = new Date(plannedStart)
    const end = new Date(start.getTime() + totalDurationMinutes * 60 * 1000)
    const formatDate = (d: Date) => d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    return `${formatDate(start)} - ${formatDate(end)}`
  }

  // Check if ERP fields have values
  const hasErpData = todo.order_name || todo.order_article_number || 
                     todo.bom_article_number || todo.workstep_name

  // Filter machines based on:
  // 1. Selected department (if any)
  // 2. Qualified machines for the workstep (if todo has erp_workplan_detail_id)
  // The final result is the intersection of both filters
  const filteredMachines = useMemo(() => {
    let result = machines
    
    // Filter by qualification (workstep) if available
    if (qualifiedMachineIds && qualifiedMachineIds.size > 0) {
      result = result.filter(m => qualifiedMachineIds.has(m.erp_id))
    }
    
    // Filter by department if selected
    if (assignedDepartmentId) {
      const selectedDepartment = departments.find(d => d.id === assignedDepartmentId)
      if (selectedDepartment) {
        const deptFiltered = result.filter(m => m.erp_department_id === selectedDepartment.erp_id)
        // Only apply department filter if it produces results
        if (deptFiltered.length > 0) {
          result = deptFiltered
        }
      }
    }

    // Fallback: If no machines match any filter, show all machines
    return result.length > 0 ? result : machines
  }, [machines, departments, assignedDepartmentId, qualifiedMachineIds])

  // Filter employees based on selected department (same logic as machines)
  // If no department selected, show all employees
  // If department selected, show only employees belonging to that department
  const filteredEmployees = useMemo(() => {
    if (!assignedDepartmentId) {
      return employees
    }
    // Find the department's erp_id to match against employee's erp_department_id
    const selectedDepartment = departments.find(d => d.id === assignedDepartmentId)
    if (!selectedDepartment) {
      return employees
    }
    const result = employees.filter(e => e.erp_department_id === selectedDepartment.erp_id)

    // Fallback: If no employees match, show all employees
    return result.length > 0 ? result : employees
  }, [employees, departments, assignedDepartmentId])

  // Reset machine selection if it's no longer in filtered list
  useEffect(() => {
    if (assignedMachineId && filteredMachines.length > 0) {
      const machineStillValid = filteredMachines.some(m => m.id === assignedMachineId)
      if (!machineStillValid) {
        setAssignedMachineId(null)
      }
    }
  }, [filteredMachines, assignedMachineId])

  // Reset employee selection if it's no longer in filtered list
  useEffect(() => {
    if (assignedEmployeeId && filteredEmployees.length > 0) {
      const employeeStillValid = filteredEmployees.some(e => e.id === assignedEmployeeId)
      if (!employeeStillValid) {
        setAssignedEmployeeId(null)
      }
    }
  }, [filteredEmployees, assignedEmployeeId])

  // Handle mouse wheel on resource dropdowns
  const handleResourceWheel = (
    e: React.WheelEvent<HTMLSelectElement>,
    options: PPSResource[],
    currentValue: number | null,
    setValue: (v: number | null) => void
  ) => {
    e.preventDefault()
    if (options.length === 0) return
    
    const currentIndex = currentValue ? options.findIndex(o => o.id === currentValue) : -1
    const delta = e.deltaY > 0 ? 1 : -1
    const newIndex = Math.max(-1, Math.min(options.length - 1, currentIndex + delta))
    
    setValue(newIndex === -1 ? null : options[newIndex].id)
  }

  // Handle arrow keys on resource dropdowns
  const handleResourceKeyDown = (
    e: React.KeyboardEvent<HTMLSelectElement>,
    options: PPSResource[],
    currentValue: number | null,
    setValue: (v: number | null) => void
  ) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    
    e.preventDefault()
    if (options.length === 0) return
    
    const currentIndex = currentValue ? options.findIndex(o => o.id === currentValue) : -1
    const delta = e.key === 'ArrowDown' ? 1 : -1
    const newIndex = Math.max(-1, Math.min(options.length - 1, currentIndex + delta))
    
    setValue(newIndex === -1 ? null : options[newIndex].id)
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Orange Header */}
        <div style={styles.header}>
          <span style={styles.headerText}>{formatDateRange() || title}</span>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Tab Navigation */}
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'details' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'dependencies' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('dependencies')}
            >
              Verknüpfungen
            </button>
          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
            <>
              {/* Main layout: Left column (form fields) + Right column (image at top) */}
              <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                {/* Left column: All form fields */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Top row: Priority, Status, Gantt-Typ */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '10px' }}>
                    {/* Priority - 100px */}
                    <div style={{ width: '100px', flexShrink: 0 }}>
                      <label style={styles.label}>Priorität</label>
                      <input
                        type="number"
                        value={priority}
                        onChange={handlePriorityChange}
                        onBlur={handlePriorityBlur}
                        style={styles.input}
                        min={1}
                        max={100}
                      />
                    </div>
                    
                    {/* Status - 100px */}
                    <div style={{ width: '100px', flexShrink: 0 }}>
                      <label style={styles.label}>Status</label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value as TodoStatus)}
                        style={styles.select}
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Gantt Type - only in Planboard context, 120px */}
                    {showGanttType && (
                      <div style={{ width: '120px', flexShrink: 0 }}>
                        <label style={styles.label}>Gantt-Typ</label>
                        <select
                          value={ganttType}
                          onChange={e => setGanttType(e.target.value as 'task' | 'project' | 'milestone')}
                          style={styles.select}
                        >
                          <option value="task">Aufgabe</option>
                          <option value="project">Projekt</option>
                          <option value="milestone">Meilenstein</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* ToDo field - full width */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>ToDo</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      style={styles.input}
                      placeholder="Aufgabentitel..."
                    />
                  </div>

                  {/* ERP Reference Fields */}
                  {(hasErpData || todo.erp_order_id) && (
                    <div style={{ ...styles.erpSection, marginTop: '8px', marginBottom: '10px' }}>
                      {/* Auftrag */}
                      <div style={styles.erpRow}>
                        <span style={styles.erpLabel}>Auftrag:</span>
                        <span style={todo.order_name ? styles.erpValue : styles.erpValueEmpty}>
                          {todo.order_name || '-'}
                        </span>
                      </div>
                      
                      {/* Auftragsartikel */}
                      <div style={styles.erpRow}>
                        {todo.erp_order_id && onCreateFromPicker && (
                          <button
                            style={{
                              ...styles.plusButton,
                              ...(hoveredPlusButton === 'article' ? styles.plusButtonHover : {}),
                              ...(todo.order_article_number ? styles.plusButtonDisabled : {}),
                            }}
                            onClick={() => {
                              if (!todo.order_article_number && todo.erp_order_id) {
                                setPickerType('article')
                                setPickerParentId(todo.erp_order_id)
                              }
                            }}
                            onMouseEnter={() => setHoveredPlusButton('article')}
                            onMouseLeave={() => setHoveredPlusButton(null)}
                            disabled={!!todo.order_article_number}
                            title={todo.order_article_number ? 'Auftragsartikel bereits vorhanden' : 'Auftragsartikel auswählen'}
                          >
                            +
                          </button>
                        )}
                        <span style={styles.erpLabel}>Auftragsartikel:</span>
                        <span style={todo.order_article_number ? styles.erpValue : styles.erpValueEmpty}>
                          {todo.order_article_number || '-'}
                        </span>
                        {todo.order_article_path && (
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '14px',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              marginLeft: '4px',
                              borderRadius: '3px',
                              color: '#666',
                            }}
                            onClick={() => copyToClipboard(todo.order_article_path!)}
                            title={`Pfad kopieren: ${todo.order_article_path}`}
                          >
                            📁
                          </button>
                        )}
                      </div>
                      
                      {/* Stücklistenartikel */}
                      <div style={styles.erpRow}>
                        {todo.erp_order_article_id && onCreateFromPicker && (
                          <button
                            style={{
                              ...styles.plusButton,
                              ...(hoveredPlusButton === 'bom' ? styles.plusButtonHover : {}),
                              ...(todo.bom_article_number ? styles.plusButtonDisabled : {}),
                            }}
                            onClick={() => {
                              if (!todo.bom_article_number && todo.erp_order_article_id) {
                                setPickerType('bom')
                                setPickerParentId(todo.erp_order_article_id)
                              }
                            }}
                            onMouseEnter={() => setHoveredPlusButton('bom')}
                            onMouseLeave={() => setHoveredPlusButton(null)}
                            disabled={!!todo.bom_article_number}
                            title={todo.bom_article_number ? 'Stücklistenartikel bereits vorhanden' : 'Stücklistenartikel auswählen'}
                          >
                            +
                          </button>
                        )}
                        <span style={styles.erpLabel}>Stücklistenartikel:</span>
                        <span style={todo.bom_article_number ? styles.erpValue : styles.erpValueEmpty}>
                          {todo.bom_article_number || '-'}
                        </span>
                        {todo.bom_article_path && (
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '14px',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              marginLeft: '4px',
                              borderRadius: '3px',
                              color: '#666',
                            }}
                            onClick={() => copyToClipboard(todo.bom_article_path!)}
                            title={`Pfad kopieren: ${todo.bom_article_path}`}
                          >
                            📁
                          </button>
                        )}
                      </div>
                      
                      {/* Arbeitsgang */}
                      <div style={styles.erpRow}>
                        {((todo.erp_packingnote_details_id || todo.erp_order_article_id) && onCreateFromPicker) && (
                          <button
                            style={{
                              ...styles.plusButton,
                              ...(hoveredPlusButton === 'workstep' ? styles.plusButtonHover : {}),
                              ...(todo.workstep_name ? styles.plusButtonDisabled : {}),
                            }}
                            onClick={() => {
                              if (!todo.workstep_name) {
                                if (todo.erp_packingnote_details_id) {
                                  setPickerType('workstep')
                                  setPickerParentId(todo.erp_packingnote_details_id)
                                } else if (todo.erp_order_article_id) {
                                  setPickerType('generic_workstep')
                                  setPickerParentId(0)
                                }
                              }
                            }}
                            onMouseEnter={() => setHoveredPlusButton('workstep')}
                            onMouseLeave={() => setHoveredPlusButton(null)}
                            disabled={!!todo.workstep_name}
                            title={todo.workstep_name 
                              ? 'Arbeitsgang bereits vorhanden' 
                              : (todo.erp_packingnote_details_id 
                                  ? 'Arbeitsgang aus Workplan auswählen' 
                                  : 'Generischen Arbeitsgang auswählen')}
                          >
                            +
                          </button>
                        )}
                        <span style={styles.erpLabel}>Arbeitsgang:</span>
                        <span style={todo.workstep_name ? styles.erpValue : styles.erpValueEmpty}>
                          {todo.workstep_name || '-'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Time Section - below ERP section */}
                  <div style={styles.timeSection}>
                    <input
                      type="date"
                      value={plannedStart ? plannedStart.slice(0, 10) : ''}
                      onChange={e => {
                        if (e.target.value && plannedStart) {
                          const newDate = e.target.value + plannedStart.slice(10)
                          setPlannedStart(newDate)
                        } else if (e.target.value) {
                          setPlannedStart(e.target.value + 'T09:00:00')
                        }
                      }}
                      style={{ ...styles.input, width: '140px', ...(ganttType === 'project' ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}) }}
                      disabled={ganttType === 'project'}
                      title={ganttType === 'project' ? 'Projekt-Datum wird aus Kinder-Aufgaben berechnet' : undefined}
                    />
                    
                    <input
                      type="time"
                      value={plannedStart ? plannedStart.slice(11, 16) : '09:00'}
                      onChange={e => {
                        if (e.target.value && plannedStart) {
                          const newDate = plannedStart.slice(0, 11) + e.target.value + ':00'
                          setPlannedStart(newDate)
                        } else if (e.target.value) {
                          const today = new Date().toISOString().slice(0, 10)
                          setPlannedStart(today + 'T' + e.target.value + ':00')
                        }
                      }}
                      style={{ ...styles.input, width: '80px', ...(ganttType === 'project' ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}) }}
                      disabled={ganttType === 'project'}
                      title={ganttType === 'project' ? 'Projekt-Zeit wird aus Kinder-Aufgaben berechnet' : undefined}
                    />

                    <span style={styles.timeLabel}>Dauer:</span>
                    
                    <input
                      type="number"
                      value={totalDurationMinutes}
                      onChange={e => handleDurationChange(e.target.value)}
                      onBlur={handleDurationBlur}
                      style={{ ...styles.timeInput, width: '80px', ...(ganttType === 'project' ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}) }}
                      min={0}
                      disabled={ganttType === 'project'}
                      title={ganttType === 'project' ? 'Projekt-Dauer wird aus Kinder-Aufgaben berechnet' : undefined}
                    />
                    <span style={styles.timeLabel}>Min. → {calculateEndDate()}</span>
                  </div>
                </div>
                
                {/* Right column: Large Article Image (350x300) - aligned to top */}
                <div style={{ flexShrink: 0, alignSelf: 'flex-start' }}>
                  <EntityImageField
                    entityType="article"
                    entityId={todo.erp_order_article_id || todo.erp_packingnote_details_id || undefined}
                    size="large"
                    width={350}
                    height={300}
                    editable={true}
                    basePath={todo.order_article_path || todo.bom_article_path}
                  />
                </div>
              </div>
              
              {/* Description field with Rich Text Editor */}
              <div style={{ ...styles.formGroup, marginBottom: '15px' }}>
                <label style={styles.label}>Zusatzinfos</label>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Zusatzinfos eingeben..."
                  minHeight={180}
                  maxHeight={300}
                />
              </div>

          {/* Progress Slider */}
          <div style={{ ...styles.formGroup, marginTop: '10px' }}>
            <label style={styles.label}>Fortschritt: {Math.round(progress * 100)}%</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(progress * 100)}
                onChange={e => setProgress(parseInt(e.target.value) / 100)}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '12px', width: '40px', textAlign: 'right' }}>
                {Math.round(progress * 100)}%
              </span>
            </div>
          </div>

          {/* Resource Assignment */}
          <div style={{ ...styles.formGroup, marginTop: '10px' }}>
            <div style={styles.row}>
              <div style={styles.col}>
                <label style={styles.label}>Abteilung</label>
                <select
                  value={assignedDepartmentId || ''}
                  onChange={e => setAssignedDepartmentId(e.target.value ? parseInt(e.target.value) : null)}
                  onWheel={e => handleResourceWheel(e, departments, assignedDepartmentId, setAssignedDepartmentId)}
                  onKeyDown={e => handleResourceKeyDown(e, departments, assignedDepartmentId, setAssignedDepartmentId)}
                  style={styles.select}
                >
                  <option value="">--</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div style={styles.col}>
                <label style={styles.label}>Maschine</label>
                <select
                  value={assignedMachineId || ''}
                  onChange={e => setAssignedMachineId(e.target.value ? parseInt(e.target.value) : null)}
                  onWheel={e => handleResourceWheel(e, filteredMachines, assignedMachineId, setAssignedMachineId)}
                  onKeyDown={e => handleResourceKeyDown(e, filteredMachines, assignedMachineId, setAssignedMachineId)}
                  style={styles.select}
                >
                  <option value="">--</option>
                  {filteredMachines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={styles.col}>
                <label style={styles.label}>Mitarbeiter</label>
                <select
                  value={assignedEmployeeId || ''}
                  onChange={e => setAssignedEmployeeId(e.target.value ? parseInt(e.target.value) : null)}
                  onWheel={e => handleResourceWheel(e, filteredEmployees, assignedEmployeeId, setAssignedEmployeeId)}
                  onKeyDown={e => handleResourceKeyDown(e, filteredEmployees, assignedEmployeeId, setAssignedEmployeeId)}
                  style={styles.select}
                >
                  <option value="">--</option>
                  {filteredEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

            </>
          )}

          {/* Dependencies Tab */}
          {activeTab === 'dependencies' && (
            <div>
              {loadingDependencies ? (
                <div style={styles.dependencyEmpty}>Lade Verknüpfungen...</div>
              ) : (
                <>
                  {/* Predecessors */}
                  <div style={styles.dependencyList}>
                    <div style={styles.dependencyListTitle}>
                      Vorgänger (müssen zuerst abgeschlossen werden)
                    </div>
                    {predecessors.length === 0 ? (
                      <div style={styles.dependencyEmpty}>Keine Vorgänger</div>
                    ) : (
                      predecessors.map(pred => (
                        <div key={pred.id} style={styles.dependencyItem}>
                          <span>{pred.title}</span>
                          <button
                            style={styles.dependencyRemoveButton}
                            onClick={async () => {
                              // Find and delete the dependency
                              // Note: We need to find the dependency ID first
                              // For now, we'll just remove from UI
                              setPredecessors(prev => prev.filter(p => p.id !== pred.id))
                            }}
                            title="Verknüpfung entfernen"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Successors */}
                  <div style={styles.dependencyList}>
                    <div style={styles.dependencyListTitle}>
                      Nachfolger (warten auf dieses Todo)
                    </div>
                    {successors.length === 0 ? (
                      <div style={styles.dependencyEmpty}>Keine Nachfolger</div>
                    ) : (
                      successors.map(succ => (
                        <div key={succ.id} style={styles.dependencyItem}>
                          <span>{succ.title}</span>
                          <button
                            style={styles.dependencyRemoveButton}
                            onClick={async () => {
                              // Remove from UI
                              setSuccessors(prev => prev.filter(s => s.id !== succ.id))
                            }}
                            title="Verknüpfung entfernen"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ marginTop: '16px', fontSize: '11px', color: '#666' }}>
                    Tipp: Verknüpfungen können auch direkt im Gantt-Chart durch Ziehen einer Linie zwischen Tasks erstellt werden.
                  </div>
                </>
              )}
            </div>
          )}

          {/* Error message */}
          {error && <div style={styles.error}>{error}</div>}
        </div>

        {/* Footer with buttons */}
        <div style={styles.footer}>
          <div style={styles.footerLeft}>
            <button
              style={{
                ...styles.buttonSave,
                ...(saving ? styles.buttonDisabled : {}),
              }}
              onClick={handleSave}
              disabled={saving || deleting}
            >
              {saving ? '...' : '✓ Speichern'}
            </button>
            <button 
              style={styles.buttonCancel} 
              onClick={onClose} 
              disabled={saving || deleting}
            >
              ⊘ Abbrechen
            </button>
          </div>
          <div style={styles.footerRight}>
            {onDelete && (
              <button
                style={{
                  ...styles.buttonDelete,
                  ...(deleting ? styles.buttonDisabled : {}),
                }}
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? '...' : '🗑 Löschen'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ERP Picker Dialog */}
      {pickerType && pickerParentId !== null && (
        <ErpPickerDialog
          type={pickerType}
          parentId={pickerParentId}
          onClose={() => {
            setPickerType(null)
            setPickerParentId(null)
          }}
          onSelect={(selectedIds, selectedItems) => {
            // Close picker
            const currentPickerType = pickerType
            setPickerType(null)
            setPickerParentId(null)
            
            // For generic_workstep: Update title in current dialog, don't create new todo
            if (currentPickerType === 'generic_workstep' && selectedItems.length > 0) {
              const workstep = selectedItems[0] as AllWorkstepOption
              // Update title with workstep name (ohne AG: Präfix)
              setTitle(workstep.name)
              // Don't close dialog - let user continue editing
              return
            }
            
            // For other types: Notify parent to create new todos
            if (onCreateFromPicker && selectedItems.length > 0) {
              onCreateFromPicker(selectedItems, currentPickerType)
            }
          }}
        />
      )}
      
      {/* Toast notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#333',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '6px',
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  )
}
