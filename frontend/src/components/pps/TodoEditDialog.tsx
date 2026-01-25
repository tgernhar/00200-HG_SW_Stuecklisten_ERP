/**
 * Todo Edit Dialog - Reusable dialog for editing PPS todos
 * 
 * Styled like the Planboard Lightbox with orange header.
 * Can be used in both ProductionPlanningPage (Gantt) and TodoListPage.
 */
import React, { useState, useEffect } from 'react'
import { updateTodo, getResources, deleteTodo } from '../../services/ppsApi'
import { PPSTodoWithERPDetails, PPSTodoUpdate, PPSResource, TodoStatus, TodoType } from '../../services/ppsTypes'

interface TodoEditDialogProps {
  todo: PPSTodoWithERPDetails
  onClose: () => void
  onSave: (updatedTodo: PPSTodoWithERPDetails) => void
  onDelete?: (todoId: number) => void
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
    width: '520px',
    maxHeight: '90vh',
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
  { value: 'container_order', label: 'Auftrag' },
  { value: 'container_article', label: 'Artikel' },
  { value: 'operation', label: 'Arbeitsgang' },
  { value: 'eigene', label: 'Eigene' },
]

export default function TodoEditDialog({
  todo,
  onClose,
  onSave,
  onDelete,
}: TodoEditDialogProps) {
  // Form state
  const [priority, setPriority] = useState(todo.priority)
  const [todoType, setTodoType] = useState<TodoType>(todo.todo_type)
  const [description, setDescription] = useState(todo.description || '')
  const [status, setStatus] = useState<TodoStatus>(todo.status)
  const [plannedStart, setPlannedStart] = useState(
    todo.planned_start ? todo.planned_start.slice(0, 16) : ''
  )
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
  
  // Resources
  const [departments, setDepartments] = useState<PPSResource[]>([])
  const [machines, setMachines] = useState<PPSResource[]>([])
  const [employees, setEmployees] = useState<PPSResource[]>([])
  
  // State
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load resources
  useEffect(() => {
    const loadResources = async () => {
      try {
        const resources = await getResources({ is_active: true })
        setDepartments(resources.filter(r => r.resource_type === 'department'))
        setMachines(resources.filter(r => r.resource_type === 'machine'))
        setEmployees(resources.filter(r => r.resource_type === 'employee'))
      } catch (err) {
        console.error('Error loading resources:', err)
      }
    }
    loadResources()
  }, [])

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
      const updateData: PPSTodoUpdate = {
        description: description.trim() || undefined,
        status,
        priority,
        planned_start: plannedStart ? `${plannedStart}:00` : undefined,
        total_duration_minutes: totalDurationMinutes,
        assigned_department_id: assignedDepartmentId || undefined,
        assigned_machine_id: assignedMachineId || undefined,
        assigned_employee_id: assignedEmployeeId || undefined,
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
      onSave(updatedWithErp)
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

  // Duration adjustment
  const adjustDuration = (delta: number) => {
    const newDuration = Math.max(15, totalDurationMinutes + delta)
    setTotalDurationMinutes(newDuration)
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

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Orange Header */}
        <div style={styles.header}>
          <span style={styles.headerText}>{formatDateRange() || todo.title}</span>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Priority */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Priorität</label>
            <input
              type="number"
              value={priority}
              onChange={e => setPriority(parseInt(e.target.value) || 50)}
              style={{ ...styles.input, width: '80px' }}
              min={1}
              max={100}
            />
          </div>

          {/* ERP Reference Fields (read-only) - only shown if data exists */}
          {hasErpData && (
            <div style={styles.erpSection}>
              {todo.order_name && (
                <div style={styles.erpRow}>
                  <span style={styles.erpLabel}>Auftrag:</span>
                  <span style={styles.erpValue}>{todo.order_name}</span>
                </div>
              )}
              {todo.order_article_number && (
                <div style={styles.erpRow}>
                  <span style={styles.erpLabel}>Auftragsartikel:</span>
                  <span style={styles.erpValue}>{todo.order_article_number}</span>
                </div>
              )}
              {todo.bom_article_number && (
                <div style={styles.erpRow}>
                  <span style={styles.erpLabel}>Stücklistenartikel:</span>
                  <span style={styles.erpValue}>{todo.bom_article_number}</span>
                </div>
              )}
              {todo.workstep_name && (
                <div style={styles.erpRow}>
                  <span style={styles.erpLabel}>Arbeitsgang:</span>
                  <span style={styles.erpValue}>{todo.workstep_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Type */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Typ</label>
            <select
              value={todoType}
              onChange={e => setTodoType(e.target.value as TodoType)}
              style={styles.select}
              disabled // Type should not be editable
            >
              {typeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Beschreibung</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={styles.textarea}
              placeholder={todo.title}
            />
          </div>

          {/* Status */}
          <div style={styles.formGroup}>
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

          {/* Time Section with +/- controls */}
          <div style={styles.timeSection}>
            <select
              value={plannedStart ? new Date(plannedStart).getDate() : ''}
              onChange={e => {
                if (plannedStart) {
                  const d = new Date(plannedStart)
                  d.setDate(parseInt(e.target.value))
                  setPlannedStart(d.toISOString().slice(0, 16))
                }
              }}
              style={{ ...styles.select, width: '50px' }}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
            
            <select
              value={plannedStart ? new Date(plannedStart).toLocaleString('de-DE', { month: 'long' }) : ''}
              style={{ ...styles.select, width: '100px' }}
              disabled
            >
              <option>{plannedStart ? new Date(plannedStart).toLocaleString('de-DE', { month: 'long' }) : 'Januar'}</option>
            </select>
            
            <select
              value={plannedStart ? new Date(plannedStart).getFullYear() : 2026}
              style={{ ...styles.select, width: '70px' }}
              disabled
            >
              <option>{plannedStart ? new Date(plannedStart).getFullYear() : 2026}</option>
            </select>
            
            <select
              value={plannedStart ? new Date(plannedStart).toTimeString().slice(0, 5) : '09:00'}
              onChange={e => {
                if (plannedStart) {
                  const [hours, minutes] = e.target.value.split(':')
                  const d = new Date(plannedStart)
                  d.setHours(parseInt(hours), parseInt(minutes))
                  setPlannedStart(d.toISOString().slice(0, 16))
                }
              }}
              style={{ ...styles.select, width: '70px' }}
            >
              {Array.from({ length: 24 }, (_, h) => 
                Array.from({ length: 4 }, (_, q) => {
                  const time = `${h.toString().padStart(2, '0')}:${(q * 15).toString().padStart(2, '0')}`
                  return <option key={time} value={time}>{time}</option>
                })
              ).flat()}
            </select>

            <span style={styles.timeLabel}>-</span>
            
            <button 
              style={styles.timeButton} 
              onClick={() => adjustDuration(-15)}
              type="button"
            >
              -
            </button>
            <input
              type="number"
              value={totalDurationMinutes}
              onChange={e => setTotalDurationMinutes(parseInt(e.target.value) || 15)}
              style={styles.timeInput}
              min={15}
              step={15}
            />
            <button 
              style={styles.timeButton} 
              onClick={() => adjustDuration(15)}
              type="button"
            >
              +
            </button>
            <span style={styles.timeLabel}>Minutes {calculateEndDate()}</span>
          </div>

          {/* Resource Assignment */}
          <div style={{ ...styles.formGroup, marginTop: '10px' }}>
            <div style={styles.row}>
              <div style={styles.col}>
                <label style={styles.label}>Abteilung</label>
                <select
                  value={assignedDepartmentId || ''}
                  onChange={e => setAssignedDepartmentId(e.target.value ? parseInt(e.target.value) : null)}
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
                  style={styles.select}
                >
                  <option value="">--</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={styles.col}>
                <label style={styles.label}>Mitarbeiter</label>
                <select
                  value={assignedEmployeeId || ''}
                  onChange={e => setAssignedEmployeeId(e.target.value ? parseInt(e.target.value) : null)}
                  style={styles.select}
                >
                  <option value="">--</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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
    </div>
  )
}
