/**
 * Workplan Panel Component
 * Displays workplan (Arbeitsplan) for a packingnote detail - Level 4
 * The workplan is connected via: packingnote_relation.detail = workplan.packingnoteid
 */
import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import { WorkplanItem } from '../../services/types'

interface WorkplanPanelProps {
  detailId: number
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
    borderBottom: '1px solid #e6d9b3'
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
    color: '#333333'
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
  }
}

export default function WorkplanPanel({ detailId }: WorkplanPanelProps) {
  const [items, setItems] = useState<WorkplanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadWorkplan = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(`/packingnote-details/${detailId}/workplan`)
        setItems(response.data.items || [])
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Fehler beim Laden')
        console.error('Error loading workplan:', err)
      } finally {
        setLoading(false)
      }
    }

    loadWorkplan()
  }, [detailId])

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
      <div style={styles.header}>Arbeitsplan</div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '60px' }}>Pos</th>
            <th style={styles.th}>Arbeitsgang</th>
            <th style={styles.th}>Maschine</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={styles.td}>{item.pos || '-'}</td>
              <td style={styles.td}>{item.workstep_name || '-'}</td>
              <td style={styles.td}>{item.machine_name || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
