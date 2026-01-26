/**
 * CRM Tasks Page
 * Task management with "My Day" view
 */
import React, { useState, useEffect } from 'react'
import { getTasks, getMyDay, createTask, updateTask, deleteTask } from '../services/crmApi'
import { Task, TaskCreate, TaskStatus, TaskType, TaskListResponse, MyDayResponse } from '../services/crmTypes'

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#333',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid #ddd',
    paddingBottom: '10px',
  },
  tab: {
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '4px',
    border: '1px solid transparent',
  },
  tabActive: {
    backgroundColor: '#2196F3',
    color: '#fff',
  },
  tabInactive: {
    backgroundColor: '#f5f5f5',
    color: '#333',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  statsBar: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
    fontSize: '13px',
  },
  statItem: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
  },
  statValue: {
    fontWeight: 'bold' as const,
    marginRight: '5px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px',
  },
  column: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  columnHeader: {
    padding: '12px 15px',
    borderBottom: '1px solid #ddd',
    fontWeight: 'bold' as const,
    fontSize: '14px',
    backgroundColor: '#f9f9f9',
  },
  columnHeaderOverdue: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  taskList: {
    padding: '10px',
    minHeight: '200px',
  },
  taskCard: {
    padding: '12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    marginBottom: '10px',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  taskCardOverdue: {
    borderLeft: '3px solid #f44336',
  },
  taskTitle: {
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '5px',
  },
  taskMeta: {
    fontSize: '11px',
    color: '#666',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  taskActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  actionButton: {
    padding: '4px 8px',
    fontSize: '11px',
    border: '1px solid #ddd',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: '#fff',
  },
  actionButtonComplete: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    border: '1px solid #a5d6a7',
  },
  badge: {
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 500,
  },
  badgeOverdue: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  badgeToday: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
  },
  emptyState: {
    padding: '30px',
    textAlign: 'center' as const,
    color: '#666',
    fontSize: '13px',
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '4px',
    width: '450px',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalHeader: {
    padding: '15px 20px',
    borderBottom: '1px solid #ddd',
    fontWeight: 'bold' as const,
    display: 'flex',
    justifyContent: 'space-between',
  },
  modalBody: {
    padding: '20px',
  },
  modalFooter: {
    padding: '15px 20px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  formGroup: {
    marginBottom: '15px',
  },
  formLabel: {
    display: 'block',
    marginBottom: '5px',
    fontSize: '13px',
    fontWeight: 500,
  },
  formInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
  },
  formSelect: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
  },
  formTextarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    minHeight: '80px',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
}

const taskTypeLabels: Record<string, string> = {
  follow_up: 'Nachfassen',
  call: 'Anruf',
  meeting: 'Meeting',
  internal: 'Intern',
  reminder: 'Erinnerung',
}

export default function CRMTasksPage() {
  const [view, setView] = useState<'my-day' | 'all'>('my-day')
  const [myDay, setMyDay] = useState<MyDayResponse | null>(null)
  const [allTasks, setAllTasks] = useState<TaskListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newTask, setNewTask] = useState<TaskCreate>({
    title: '',
    description: '',
    task_type: 'internal',
    priority: 50,
  })

  useEffect(() => {
    loadData()
  }, [view])

  const loadData = async () => {
    setLoading(true)
    try {
      if (view === 'my-day') {
        const data = await getMyDay()
        setMyDay(data)
      } else {
        const data = await getTasks({ status: 'open,in_progress', limit: 100 })
        setAllTasks(data)
      }
    } catch (err) {
      console.error('Error loading tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Kein Datum'
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const handleCreateTask = async () => {
    if (!newTask.title) return
    try {
      await createTask(newTask)
      setShowModal(false)
      setNewTask({ title: '', description: '', task_type: 'internal', priority: 50 })
      loadData()
    } catch (err) {
      console.error('Error creating task:', err)
    }
  }

  const handleCompleteTask = async (taskId: number) => {
    try {
      await updateTask(taskId, { status: 'completed' })
      loadData()
    } catch (err) {
      console.error('Error completing task:', err)
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Aufgabe wirklich löschen?')) return
    try {
      await deleteTask(taskId)
      loadData()
    } catch (err) {
      console.error('Error deleting task:', err)
    }
  }

  const renderTaskCard = (task: Task) => (
    <div
      key={task.id}
      style={{
        ...styles.taskCard,
        ...(task.is_overdue ? styles.taskCardOverdue : {}),
      }}
    >
      <div style={styles.taskTitle}>{task.title}</div>
      <div style={styles.taskMeta}>
        <span>{taskTypeLabels[task.task_type] || task.task_type}</span>
        <span>Fällig: {formatDate(task.due_date)}</span>
        {task.is_overdue && (
          <span style={{ ...styles.badge, ...styles.badgeOverdue }}>Überfällig</span>
        )}
      </div>
      <div style={styles.taskActions}>
        <button
          style={{ ...styles.actionButton, ...styles.actionButtonComplete }}
          onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id) }}
        >
          Erledigt
        </button>
        <button
          style={styles.actionButton}
          onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id) }}
        >
          Löschen
        </button>
      </div>
    </div>
  )

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Aufgaben</h2>
        <button style={styles.addButton} onClick={() => setShowModal(true)}>
          + Neue Aufgabe
        </button>
      </div>

      <div style={styles.tabs}>
        <div
          style={{ ...styles.tab, ...(view === 'my-day' ? styles.tabActive : styles.tabInactive) }}
          onClick={() => setView('my-day')}
        >
          Mein Tag
        </div>
        <div
          style={{ ...styles.tab, ...(view === 'all' ? styles.tabActive : styles.tabInactive) }}
          onClick={() => setView('all')}
        >
          Alle Aufgaben
        </div>
      </div>

      {loading ? (
        <div style={styles.emptyState}>Lade Aufgaben...</div>
      ) : view === 'my-day' && myDay ? (
        <>
          <div style={styles.statsBar}>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{myDay.total_open}</span>
              Offen
            </div>
            <div style={styles.statItem}>
              <span style={{ ...styles.statValue, color: '#f44336' }}>{myDay.overdue_tasks.length}</span>
              Überfällig
            </div>
            <div style={styles.statItem}>
              <span style={{ ...styles.statValue, color: '#2196F3' }}>{myDay.today_tasks.length}</span>
              Heute
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.column}>
              <div style={{ ...styles.columnHeader, ...styles.columnHeaderOverdue }}>
                Überfällig ({myDay.overdue_tasks.length})
              </div>
              <div style={styles.taskList}>
                {myDay.overdue_tasks.length === 0 ? (
                  <div style={styles.emptyState}>Keine überfälligen Aufgaben</div>
                ) : (
                  myDay.overdue_tasks.map(renderTaskCard)
                )}
              </div>
            </div>

            <div style={styles.column}>
              <div style={styles.columnHeader}>Heute ({myDay.today_tasks.length})</div>
              <div style={styles.taskList}>
                {myDay.today_tasks.length === 0 ? (
                  <div style={styles.emptyState}>Keine Aufgaben für heute</div>
                ) : (
                  myDay.today_tasks.map(renderTaskCard)
                )}
              </div>
            </div>

            <div style={styles.column}>
              <div style={styles.columnHeader}>Demnächst ({myDay.upcoming_tasks.length})</div>
              <div style={styles.taskList}>
                {myDay.upcoming_tasks.length === 0 ? (
                  <div style={styles.emptyState}>Keine anstehenden Aufgaben</div>
                ) : (
                  myDay.upcoming_tasks.map(renderTaskCard)
                )}
              </div>
            </div>
          </div>
        </>
      ) : allTasks ? (
        <div style={styles.column}>
          <div style={styles.columnHeader}>
            Offene Aufgaben ({allTasks.total})
          </div>
          <div style={styles.taskList}>
            {allTasks.items.length === 0 ? (
              <div style={styles.emptyState}>Keine offenen Aufgaben</div>
            ) : (
              allTasks.items.map(renderTaskCard)
            )}
          </div>
        </div>
      ) : null}

      {/* Add Task Modal */}
      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span>Neue Aufgabe</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Titel *</label>
                <input
                  type="text"
                  style={styles.formInput}
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Aufgabentitel..."
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Typ</label>
                <select
                  style={styles.formSelect}
                  value={newTask.task_type}
                  onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value as TaskType })}
                >
                  <option value="follow_up">Nachfassen</option>
                  <option value="call">Anruf</option>
                  <option value="meeting">Meeting</option>
                  <option value="internal">Intern</option>
                  <option value="reminder">Erinnerung</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Fälligkeitsdatum</label>
                <input
                  type="date"
                  style={styles.formInput}
                  value={newTask.due_date || ''}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Beschreibung</label>
                <textarea
                  style={styles.formTextarea}
                  value={newTask.description || ''}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Beschreibung..."
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setShowModal(false)}>Abbrechen</button>
              <button style={styles.addButton} onClick={handleCreateTask}>Erstellen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
