/**
 * Conflict Panel - Shows detected conflicts
 * 
 * Displays a list of conflicts with severity indicators
 * and allows clicking to navigate to the affected task
 */
import React from 'react'
import { PPSConflictWithTodos, ConflictType, ConflictSeverity } from '../../services/ppsTypes'

interface ConflictPanelProps {
  conflicts: PPSConflictWithTodos[]
  onConflictClick?: (conflict: PPSConflictWithTodos) => void
  onRefresh?: () => void
}

const styles = {
  container: {
    padding: '10px',
    height: '100%',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#cc0000',
  },
  refreshButton: {
    padding: '4px 8px',
    backgroundColor: '#ffffff',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  conflictList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  conflictItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 10px',
    backgroundColor: '#ffffff',
    border: '1px solid #ffcccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  conflictItemError: {
    borderColor: '#ff6666',
    backgroundColor: '#fff5f5',
  },
  conflictItemWarning: {
    borderColor: '#ffcc66',
    backgroundColor: '#fffef5',
  },
  severityIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },
  conflictContent: {
    flex: 1,
    minWidth: 0,
  },
  conflictDescription: {
    color: '#333333',
    lineHeight: 1.4,
  },
  conflictMeta: {
    fontSize: '10px',
    color: '#888888',
    marginTop: '4px',
  },
  typeLabel: {
    display: 'inline-block',
    padding: '1px 6px',
    backgroundColor: '#f0f0f0',
    borderRadius: '3px',
    fontSize: '10px',
    color: '#666666',
    marginRight: '6px',
  },
  noConflicts: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#666666',
    fontSize: '12px',
  },
}

const conflictTypeLabels: Record<ConflictType, string> = {
  resource_overlap: 'Ressource',
  calendar: 'Kalender',
  dependency: 'Abhängigkeit',
  delivery_date: 'Termin',
  qualification: 'Qualifikation',
}

const severityIcons: Record<ConflictSeverity, string> = {
  error: '⛔',
  warning: '⚠️',
}

export default function ConflictPanel({
  conflicts,
  onConflictClick,
  onRefresh,
}: ConflictPanelProps) {
  const handleClick = (conflict: PPSConflictWithTodos) => {
    if (onConflictClick) {
      onConflictClick(conflict)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          Konflikte ({conflicts.length})
        </span>
        {onRefresh && (
          <button style={styles.refreshButton} onClick={onRefresh}>
            Aktualisieren
          </button>
        )}
      </div>

      {conflicts.length === 0 ? (
        <div style={styles.noConflicts}>
          Keine Konflikte gefunden
        </div>
      ) : (
        <div style={styles.conflictList}>
          {conflicts.map(conflict => (
            <div
              key={conflict.id}
              style={{
                ...styles.conflictItem,
                ...(conflict.severity === 'error' ? styles.conflictItemError : styles.conflictItemWarning),
              }}
              onClick={() => handleClick(conflict)}
              title="Klicken um zum Task zu navigieren"
            >
              <span style={styles.severityIcon}>
                {severityIcons[conflict.severity]}
              </span>
              <div style={styles.conflictContent}>
                <div style={styles.conflictDescription}>
                  {conflict.description}
                </div>
                <div style={styles.conflictMeta}>
                  <span style={styles.typeLabel}>
                    {conflictTypeLabels[conflict.conflict_type]}
                  </span>
                  {conflict.todo_title && (
                    <span>Task: {conflict.todo_title}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
