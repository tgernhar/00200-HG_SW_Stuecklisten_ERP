/**
 * CRM Dashboard Page
 * Overview of communications, tasks, and leads
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard } from '../services/crmApi'
import { DashboardResponse, Task, Lead, RecentActivity } from '../services/crmTypes'

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1400px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    marginBottom: '20px',
    color: '#333',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '20px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '15px',
    marginBottom: '20px',
  },
  card: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '15px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    marginBottom: '10px',
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '8px',
  },
  statCard: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '15px',
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 'bold' as const,
    color: '#2196F3',
  },
  statLabel: {
    fontSize: '12px',
    color: '#666',
    marginTop: '5px',
  },
  statWarning: {
    color: '#f44336',
  },
  statSuccess: {
    color: '#4caf50',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    padding: '10px',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemHover: {
    backgroundColor: '#f5f5f5',
  },
  listItemTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#333',
  },
  listItemSub: {
    fontSize: '11px',
    color: '#666',
    marginTop: '3px',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 500,
  },
  badgeOpen: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
  },
  badgeOverdue: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  badgeNew: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  pipelineBar: {
    display: 'flex',
    height: '24px',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '10px',
  },
  pipelineSegment: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#fff',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#666',
    fontSize: '13px',
  },
  loading: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#666',
  },
  error: {
    padding: '20px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    marginBottom: '20px',
  },
}

const statusColors: Record<string, string> = {
  new: '#4caf50',
  qualified: '#2196F3',
  proposal: '#ff9800',
  negotiation: '#9c27b0',
  won: '#4caf50',
  lost: '#f44336',
}

export default function CRMDashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const response = await getDashboard()
      setData(response)
      setError(null)
    } catch (err) {
      setError('Fehler beim Laden des Dashboards')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
  }

  if (loading) {
    return <div style={styles.loading}>Lade Dashboard...</div>
  }

  if (error) {
    return <div style={styles.error}>{error}</div>
  }

  if (!data) {
    return <div style={styles.emptyState}>Keine Daten verfügbar</div>
  }

  const { stats, recent_activities, my_tasks, my_leads } = data

  // Calculate pipeline totals
  const pipelineTotal = Object.values(stats.leads_by_status).reduce((sum, val) => sum + val, 0)

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>CRM Dashboard</h2>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.unread_emails}</div>
          <div style={styles.statLabel}>Ungelesene E-Mails</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, ...(stats.overdue_tasks > 0 ? styles.statWarning : {}) }}>
            {stats.overdue_tasks}
          </div>
          <div style={styles.statLabel}>Überfällige Aufgaben</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.tasks_due_today}</div>
          <div style={styles.statLabel}>Aufgaben heute</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.total_leads}</div>
          <div style={styles.statLabel}>Offene Leads</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, ...styles.statSuccess }}>{formatCurrency(stats.pipeline_value)}</div>
          <div style={styles.statLabel}>Pipeline-Wert</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.communications_this_week}</div>
          <div style={styles.statLabel}>Kommunikation diese Woche</div>
        </div>
      </div>

      {/* Lead Pipeline */}
      {pipelineTotal > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Lead-Pipeline</div>
          <div style={styles.pipelineBar}>
            {Object.entries(stats.leads_by_status).map(([status, count]) => {
              if (count === 0) return null
              const percentage = (count / pipelineTotal) * 100
              return (
                <div
                  key={status}
                  style={{
                    ...styles.pipelineSegment,
                    width: `${percentage}%`,
                    backgroundColor: statusColors[status] || '#999',
                  }}
                  title={`${status}: ${count}`}
                >
                  {percentage > 10 ? count : ''}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '10px', fontSize: '11px' }}>
            {Object.entries(stats.leads_by_status).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: 10, height: 10, backgroundColor: statusColors[status], borderRadius: '2px' }} />
                <span>{status}: {count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div style={styles.grid}>
        {/* My Tasks */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Meine Aufgaben</div>
          {my_tasks.length === 0 ? (
            <div style={styles.emptyState}>Keine offenen Aufgaben</div>
          ) : (
            <ul style={styles.list}>
              {my_tasks.map((task) => (
                <li
                  key={task.id}
                  style={{
                    ...styles.listItem,
                    ...(hoveredItem === `task-${task.id}` ? styles.listItemHover : {}),
                  }}
                  onClick={() => navigate('/menu/crm/tasks')}
                  onMouseEnter={() => setHoveredItem(`task-${task.id}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div>
                    <div style={styles.listItemTitle}>{task.title}</div>
                    <div style={styles.listItemSub}>
                      {task.due_date ? `Fällig: ${formatDate(task.due_date)}` : 'Kein Fälligkeitsdatum'}
                    </div>
                  </div>
                  <span style={{
                    ...styles.badge,
                    ...(task.is_overdue ? styles.badgeOverdue : styles.badgeOpen),
                  }}>
                    {task.is_overdue ? 'Überfällig' : task.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* My Leads */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Meine Leads</div>
          {my_leads.length === 0 ? (
            <div style={styles.emptyState}>Keine offenen Leads</div>
          ) : (
            <ul style={styles.list}>
              {my_leads.map((lead) => (
                <li
                  key={lead.id}
                  style={{
                    ...styles.listItem,
                    ...(hoveredItem === `lead-${lead.id}` ? styles.listItemHover : {}),
                  }}
                  onClick={() => navigate('/menu/crm/leads')}
                  onMouseEnter={() => setHoveredItem(`lead-${lead.id}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div>
                    <div style={styles.listItemTitle}>{lead.title}</div>
                    <div style={styles.listItemSub}>
                      {lead.customer_name || 'Kein Kunde'}
                      {lead.expected_value && ` - ${formatCurrency(lead.expected_value)}`}
                    </div>
                  </div>
                  <span style={{
                    ...styles.badge,
                    backgroundColor: statusColors[lead.status] + '20',
                    color: statusColors[lead.status],
                  }}>
                    {lead.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Activity */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Letzte Aktivitäten</div>
          {recent_activities.length === 0 ? (
            <div style={styles.emptyState}>Keine Aktivitäten</div>
          ) : (
            <ul style={styles.list}>
              {recent_activities.map((activity, idx) => (
                <li
                  key={idx}
                  style={{
                    ...styles.listItem,
                    ...(hoveredItem === `activity-${idx}` ? styles.listItemHover : {}),
                  }}
                  onClick={() => navigate('/menu/crm/timeline')}
                  onMouseEnter={() => setHoveredItem(`activity-${idx}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div>
                    <div style={styles.listItemTitle}>{activity.title}</div>
                    <div style={styles.listItemSub}>
                      {formatDate(activity.date)}
                      {activity.customer_name && ` - ${activity.customer_name}`}
                    </div>
                  </div>
                  <span style={{ ...styles.badge, ...styles.badgeNew }}>
                    {activity.activity_type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
