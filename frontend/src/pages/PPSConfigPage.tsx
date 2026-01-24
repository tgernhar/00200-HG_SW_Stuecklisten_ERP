/**
 * PPS Configuration Page
 * 
 * Allows configuring core working hours for production planning
 */
import React, { useState, useEffect, useCallback } from 'react'
import { getWorkingHours, updateWorkingHours, WorkingHours, WorkingHoursUpdate } from '../services/ppsApi'

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '800px',
  },
  header: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    marginBottom: '10px',
    color: '#333333',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666666',
    marginBottom: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    backgroundColor: '#ffffff',
    border: '1px solid #dddddd',
  },
  th: {
    padding: '10px 12px',
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #cccccc',
    textAlign: 'left' as const,
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#333333',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #eeeeee',
    fontSize: '13px',
  },
  input: {
    padding: '6px 8px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '13px',
    width: '80px',
    fontFamily: 'Arial, sans-serif',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999999',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  dayLabel: {
    fontWeight: 'normal' as const,
  },
  weekend: {
    backgroundColor: '#fafafa',
  },
  buttonContainer: {
    marginTop: '20px',
    display: 'flex',
    gap: '10px',
  },
  button: {
    padding: '8px 16px',
    fontSize: '13px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
  },
  buttonPrimary: {
    backgroundColor: '#4a90d9',
    color: '#ffffff',
    border: '1px solid #357abd',
  },
  buttonSecondary: {
    backgroundColor: '#ffffff',
    color: '#333333',
    border: '1px solid #cccccc',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  message: {
    marginTop: '15px',
    padding: '10px 15px',
    borderRadius: '4px',
    fontSize: '13px',
  },
  success: {
    backgroundColor: '#e6f7e6',
    color: '#2e7d32',
    border: '1px solid #a5d6a7',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #ef9a9a',
  },
  loading: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#666666',
  },
}

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

export default function PPSConfigPage() {
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Load working hours on mount
  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await getWorkingHours()
      // Ensure we have all 7 days, fill with defaults if needed
      const fullWeek: WorkingHours[] = DAY_NAMES.map((name, index) => {
        const existing = data.find(d => d.day_of_week === index)
        return existing || {
          id: 0,
          day_of_week: index,
          day_name: name,
          start_time: index < 5 ? '07:00' : null,
          end_time: index < 5 ? '16:00' : null,
          is_working_day: index < 5,
        }
      })
      setWorkingHours(fullWeek)
    } catch (err) {
      console.error('Error loading working hours:', err)
      setMessage({ type: 'error', text: 'Fehler beim Laden der Arbeitszeiten' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle field changes
  const handleChange = (dayIndex: number, field: keyof WorkingHours, value: string | boolean) => {
    setWorkingHours(prev => prev.map(day => {
      if (day.day_of_week === dayIndex) {
        const updated = { ...day, [field]: value }
        // If unchecking is_working_day, clear times
        if (field === 'is_working_day' && !value) {
          updated.start_time = null
          updated.end_time = null
        }
        // If checking is_working_day, set default times
        if (field === 'is_working_day' && value && !day.start_time) {
          updated.start_time = '07:00'
          updated.end_time = '16:00'
        }
        return updated
      }
      return day
    }))
    setHasChanges(true)
    setMessage(null)
  }

  // Save changes
  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const payload: WorkingHoursUpdate[] = workingHours.map(day => ({
        day_of_week: day.day_of_week,
        start_time: day.is_working_day ? day.start_time : null,
        end_time: day.is_working_day ? day.end_time : null,
        is_working_day: day.is_working_day,
      }))
      await updateWorkingHours(payload)
      setMessage({ type: 'success', text: 'Arbeitszeiten wurden gespeichert' })
      setHasChanges(false)
    } catch (err) {
      console.error('Error saving working hours:', err)
      setMessage({ type: 'error', text: 'Fehler beim Speichern der Arbeitszeiten' })
    } finally {
      setSaving(false)
    }
  }

  // Reset to defaults
  const handleReset = () => {
    setWorkingHours(DAY_NAMES.map((name, index) => ({
      id: 0,
      day_of_week: index,
      day_name: name,
      start_time: index < 5 ? '07:00' : null,
      end_time: index < 5 ? '16:00' : null,
      is_working_day: index < 5,
    })))
    setHasChanges(true)
    setMessage(null)
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Konfiguration...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Produktionsplanung Konfiguration</h1>
        <p style={styles.subtitle}>
          Übliche Wochen Kernzeit - Diese Zeiten werden im Gantt-Diagramm als planbare Zeit (weiß) dargestellt.
          Zeiten außerhalb der Kernzeit werden grau hinterlegt.
        </p>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Tag</th>
            <th style={styles.th}>Aktiv</th>
            <th style={styles.th}>Beginn</th>
            <th style={styles.th}>Ende</th>
          </tr>
        </thead>
        <tbody>
          {workingHours.map((day) => {
            const isWeekend = day.day_of_week >= 5
            const rowStyle = isWeekend ? { ...styles.td, ...styles.weekend } : styles.td
            
            return (
              <tr key={day.day_of_week}>
                <td style={{ ...rowStyle, ...styles.dayLabel }}>
                  {DAY_NAMES[day.day_of_week]}
                </td>
                <td style={rowStyle}>
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={day.is_working_day}
                    onChange={(e) => handleChange(day.day_of_week, 'is_working_day', e.target.checked)}
                  />
                </td>
                <td style={rowStyle}>
                  <input
                    type="time"
                    style={{
                      ...styles.input,
                      ...(day.is_working_day ? {} : styles.inputDisabled),
                    }}
                    value={day.start_time || ''}
                    onChange={(e) => handleChange(day.day_of_week, 'start_time', e.target.value)}
                    disabled={!day.is_working_day}
                  />
                </td>
                <td style={rowStyle}>
                  <input
                    type="time"
                    style={{
                      ...styles.input,
                      ...(day.is_working_day ? {} : styles.inputDisabled),
                    }}
                    value={day.end_time || ''}
                    onChange={(e) => handleChange(day.day_of_week, 'end_time', e.target.value)}
                    disabled={!day.is_working_day}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={styles.buttonContainer}>
        <button
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(saving || !hasChanges ? styles.buttonDisabled : {}),
          }}
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
        <button
          style={{
            ...styles.button,
            ...styles.buttonSecondary,
            ...(saving ? styles.buttonDisabled : {}),
          }}
          onClick={handleReset}
          disabled={saving}
        >
          Standardwerte
        </button>
      </div>

      {message && (
        <div style={{
          ...styles.message,
          ...(message.type === 'success' ? styles.success : styles.error),
        }}>
          {message.text}
        </div>
      )}
    </div>
  )
}
