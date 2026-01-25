/**
 * Todo Edit Dialog - Reusable dialog for editing PPS todos
 * 
 * Can be used in both ProductionPlanningPage (Gantt) and TodoListPage
 */
import React, { useState, useEffect, useCallback } from 'react'
import { updateTodo, getResources } from '../../services/ppsApi'
import { PPSTodo, PPSTodoUpdate, PPSResource, TodoStatus } from '../../services/ppsTypes'

interface TodoEditDialogProps {
  todo: PPSTodo
  onClose: () => void
  onSave: (updatedTodo: PPSTodo) => void
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
    width: '550px',
    maxHeight: '90vh',
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
  formGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#555555',
    marginBottom: '5px',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #cccccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #cccccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
    backgroundColor: '#ffffff',
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #cccccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
    minHeight: '60px',
    resize: 'vertical' as const,
  },
  row: {
    display: 'flex',
    gap: '15px',
  },
  col: {
    flex: 1,
  },
  section: {
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #eeeeee',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#333333',
    marginBottom: '15px',
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
}

// Status options
const statusOptions: { value: TodoStatus; label: string }[] = [
  { value: 'new', label: 'Neu' },
  { value: 'planned', label: 'Geplant' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'completed', label: 'Erledigt' },
  { value: 'blocked', label: 'Blockiert' },
]

export default function TodoEditDialog({
  todo,
  onClose,
  onSave,
}: TodoEditDialogProps) {
  // Form state
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description || '')
  const [status, setStatus] = useState<TodoStatus>(todo.status)
  const [priority, setPriority] = useState(todo.priority)
  const [plannedStart, setPlannedStart] = useState(
    todo.planned_start ? todo.planned_start.slice(0, 16) : ''
  )
  const [plannedEnd, setPlannedEnd] = useState(
    todo.planned_end ? todo.planned_end.slice(0, 16) : ''
  )
  const [totalDurationMinutes, setTotalDurationMinutes] = useState(
    todo.total_duration_minutes || 60
  )
  const [blockReason, setBlockReason] = useState(todo.block_reason || '')
  
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

  // Handle save
  const handleSave = async () => {
    if (!title.trim()) {
      setError('Titel ist erforderlich')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      const updateData: PPSTodoUpdate = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        planned_start: plannedStart ? `${plannedStart}:00` : undefined,
        planned_end: plannedEnd ? `${plannedEnd}:00` : undefined,
        total_duration_minutes: totalDurationMinutes,
        block_reason: status === 'blocked' ? blockReason : undefined,
        assigned_department_id: assignedDepartmentId || undefined,
        assigned_machine_id: assignedMachineId || undefined,
        assigned_employee_id: assignedEmployeeId || undefined,
        version: todo.version,
      }
      
      const updated = await updateTodo(todo.id, updateData)
      onSave(updated)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Speichern'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  // Format datetime for display
  const formatDatetimeLocal = (isoString?: string): string => {
    if (!isoString) return ''
    return isoString.slice(0, 16)
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>ToDo bearbeiten</span>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Title */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Titel *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={styles.input}
              placeholder="Titel eingeben..."
            />
          </div>

          {/* Description */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Beschreibung</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={styles.textarea}
              placeholder="Beschreibung eingeben..."
            />
          </div>

          {/* Status and Priority */}
          <div style={styles.row}>
            <div style={{ ...styles.col, ...styles.formGroup }}>
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
            <div style={{ ...styles.col, ...styles.formGroup }}>
              <label style={styles.label}>Priorität (1 = höchste)</label>
              <input
                type="number"
                value={priority}
                onChange={e => setPriority(parseInt(e.target.value) || 50)}
                style={styles.input}
                min={1}
                max={100}
              />
            </div>
          </div>

          {/* Block reason (only shown when blocked) */}
          {status === 'blocked' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Blockierungsgrund</label>
              <input
                type="text"
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                style={styles.input}
                placeholder="Grund für Blockierung..."
              />
            </div>
          )}

          {/* Time Planning Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Zeitplanung</div>
            
            <div style={styles.row}>
              <div style={{ ...styles.col, ...styles.formGroup }}>
                <label style={styles.label}>Geplanter Start</label>
                <input
                  type="datetime-local"
                  value={plannedStart}
                  onChange={e => setPlannedStart(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={{ ...styles.col, ...styles.formGroup }}>
                <label style={styles.label}>Geplantes Ende</label>
                <input
                  type="datetime-local"
                  value={plannedEnd}
                  onChange={e => setPlannedEnd(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Dauer (Minuten)</label>
              <input
                type="number"
                value={totalDurationMinutes}
                onChange={e => setTotalDurationMinutes(parseInt(e.target.value) || 0)}
                style={{ ...styles.input, width: '150px' }}
                min={0}
              />
            </div>
          </div>

          {/* Resource Assignment Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Ressourcen-Zuweisung</div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Abteilung</label>
              <select
                value={assignedDepartmentId || ''}
                onChange={e => setAssignedDepartmentId(e.target.value ? parseInt(e.target.value) : null)}
                style={styles.select}
              >
                <option value="">-- Keine Zuweisung --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.row}>
              <div style={{ ...styles.col, ...styles.formGroup }}>
                <label style={styles.label}>Maschine</label>
                <select
                  value={assignedMachineId || ''}
                  onChange={e => setAssignedMachineId(e.target.value ? parseInt(e.target.value) : null)}
                  style={styles.select}
                >
                  <option value="">-- Keine Zuweisung --</option>
                  {machines.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ ...styles.col, ...styles.formGroup }}>
                <label style={styles.label}>Mitarbeiter</label>
                <select
                  value={assignedEmployeeId || ''}
                  onChange={e => setAssignedEmployeeId(e.target.value ? parseInt(e.target.value) : null)}
                  style={styles.select}
                >
                  <option value="">-- Keine Zuweisung --</option>
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

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.button} onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            style={{
              ...styles.buttonPrimary,
              ...(saving ? styles.buttonDisabled : {}),
            }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
