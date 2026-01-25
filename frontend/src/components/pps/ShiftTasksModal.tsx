/**
 * ShiftTasksModal - Modal for batch shifting all tasks by a time offset
 */
import React, { useState } from 'react'

interface ShiftTasksModalProps {
  onClose: () => void
  onShift: (shiftMinutes: number, dateFrom?: string, departmentId?: number) => void
  departments?: Array<{ id: number; name: string }>
  currentDateFrom?: string
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
    zIndex: 1100,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '400px',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    backgroundColor: '#2196f3',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    lineHeight: 1,
  },
  body: {
    padding: '20px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 500,
    color: '#333',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    width: '100px',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    flex: 1,
    backgroundColor: 'white',
  },
  radioGroup: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    color: '#333',
    border: '1px solid #ddd',
  },
  shiftButton: {
    backgroundColor: '#2196f3',
    color: 'white',
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    marginTop: '8px',
  },
  warning: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '16px',
    color: '#856404',
    fontSize: '13px',
  },
}

export default function ShiftTasksModal({
  onClose,
  onShift,
  departments = [],
  currentDateFrom,
}: ShiftTasksModalProps) {
  const [shiftValue, setShiftValue] = useState(60)
  const [shiftUnit, setShiftUnit] = useState<'minutes' | 'hours' | 'days'>('minutes')
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined)
  const [useCurrentDateFilter, setUseCurrentDateFilter] = useState(true)

  const calculateShiftMinutes = (): number => {
    let minutes = shiftValue
    if (shiftUnit === 'hours') {
      minutes = shiftValue * 60
    } else if (shiftUnit === 'days') {
      minutes = shiftValue * 60 * 24
    }
    return direction === 'forward' ? minutes : -minutes
  }

  const handleShift = () => {
    const shiftMinutes = calculateShiftMinutes()
    const dateFrom = useCurrentDateFilter ? currentDateFrom : undefined
    onShift(shiftMinutes, dateFrom, departmentId)
  }

  const getPreviewText = (): string => {
    const shiftMinutes = Math.abs(calculateShiftMinutes())
    const hours = Math.floor(shiftMinutes / 60)
    const mins = shiftMinutes % 60
    
    let timeStr = ''
    if (hours > 0) {
      timeStr += `${hours} Stunde${hours !== 1 ? 'n' : ''}`
    }
    if (mins > 0) {
      if (hours > 0) timeStr += ' '
      timeStr += `${mins} Minute${mins !== 1 ? 'n' : ''}`
    }
    if (!timeStr) timeStr = '0 Minuten'
    
    const dirStr = direction === 'forward' ? 'nach vorne (später)' : 'nach hinten (früher)'
    return `${timeStr} ${dirStr}`
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.headerText}>Tasks verschieben</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          <div style={styles.warning}>
            Diese Aktion verschiebt alle gefilterten Tasks um den angegebenen Zeitraum.
            Die Änderung kann nicht rückgängig gemacht werden.
          </div>

          {/* Shift value */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Zeitraum:</label>
            <div style={styles.inputGroup}>
              <input
                type="number"
                min="1"
                value={shiftValue}
                onChange={e => setShiftValue(Math.max(1, parseInt(e.target.value) || 1))}
                style={styles.input}
              />
              <select
                value={shiftUnit}
                onChange={e => setShiftUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                style={styles.select}
              >
                <option value="minutes">Minuten</option>
                <option value="hours">Stunden</option>
                <option value="days">Tage</option>
              </select>
            </div>
          </div>

          {/* Direction */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Richtung:</label>
            <div style={styles.radioGroup}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  checked={direction === 'forward'}
                  onChange={() => setDirection('forward')}
                />
                Vorwärts (später)
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  checked={direction === 'backward'}
                  onChange={() => setDirection('backward')}
                />
                Rückwärts (früher)
              </label>
            </div>
          </div>

          {/* Department filter */}
          {departments.length > 0 && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Abteilung (optional):</label>
              <select
                value={departmentId || ''}
                onChange={e => setDepartmentId(e.target.value ? parseInt(e.target.value) : undefined)}
                style={{ ...styles.select, width: '100%' }}
              >
                <option value="">Alle Abteilungen</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date filter */}
          {currentDateFrom && (
            <div style={styles.formGroup}>
              <label style={styles.radioLabel}>
                <input
                  type="checkbox"
                  checked={useCurrentDateFilter}
                  onChange={e => setUseCurrentDateFilter(e.target.checked)}
                />
                Nur Tasks ab {new Date(currentDateFrom).toLocaleDateString('de-DE')} verschieben
              </label>
            </div>
          )}

          <div style={styles.hint}>
            <strong>Vorschau:</strong> {getPreviewText()}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.cancelButton }}
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            style={{ ...styles.button, ...styles.shiftButton }}
            onClick={handleShift}
          >
            Verschieben
          </button>
        </div>
      </div>
    </div>
  )
}
