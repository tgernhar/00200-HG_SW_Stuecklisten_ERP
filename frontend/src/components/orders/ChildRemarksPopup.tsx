/**
 * Child Remarks Popup Component
 * Modal to display all child remarks for an order
 */
import React from 'react'
import { ChildRemarksSummary, ChildRemarkDetail } from '../../services/types'

interface ChildRemarksPopupProps {
  summary: ChildRemarksSummary
  onClose: () => void
  onNavigate?: (detail: ChildRemarkDetail) => void
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
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const
  },
  header: {
    padding: '15px 20px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#333'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666',
    padding: '0 5px'
  },
  summaryBar: {
    padding: '10px 20px',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    gap: '15px',
    fontSize: '12px',
    color: '#666'
  },
  levelBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px'
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '15px 20px'
  },
  remarkItem: {
    padding: '12px',
    borderBottom: '1px solid #f0f0f0',
    marginBottom: '8px',
    backgroundColor: '#fafafa',
    borderRadius: '4px'
  },
  remarkPath: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  remarkText: {
    fontSize: '13px',
    color: '#333',
    lineHeight: '1.4'
  },
  levelIndicator: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '3px',
    marginRight: '8px'
  },
  navigateButton: {
    fontSize: '11px',
    color: '#1976d2',
    cursor: 'pointer',
    marginLeft: 'auto',
    background: 'none',
    border: '1px solid #1976d2',
    borderRadius: '3px',
    padding: '3px 8px'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#999',
    fontSize: '14px'
  },
  footer: {
    padding: '10px 20px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  footerButton: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  }
}

const getLevelColor = (levelType: string): React.CSSProperties => {
  switch (levelType) {
    case 'order_article':
      return { backgroundColor: '#e3f2fd', color: '#1976d2' }
    case 'bom_detail':
      return { backgroundColor: '#f3e5f5', color: '#7b1fa2' }
    case 'workplan_detail':
      return { backgroundColor: '#e8f5e9', color: '#388e3c' }
    default:
      return { backgroundColor: '#f5f5f5', color: '#666' }
  }
}

const getLevelName = (levelType: string): string => {
  switch (levelType) {
    case 'order_article':
      return 'Artikel'
    case 'bom_detail':
      return 'Stückliste'
    case 'workplan_detail':
      return 'Arbeitsgang'
    default:
      return levelType
  }
}

export default function ChildRemarksPopup({ summary, onClose, onNavigate }: ChildRemarksPopupProps) {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.title}>Kind-Bemerkungen ({summary.total_count})</span>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.summaryBar}>
          <span>Gesamt: {summary.total_count}</span>
          {Object.entries(summary.by_level).map(([level, count]) => (
            count > 0 && (
              <span
                key={level}
                style={{ ...styles.levelBadge, ...getLevelColor(level) }}
              >
                {getLevelName(level)}: {count}
              </span>
            )
          ))}
        </div>

        <div style={styles.content}>
          {summary.items.length === 0 ? (
            <div style={styles.emptyState}>
              Keine Kind-Bemerkungen gefunden
            </div>
          ) : (
            summary.items.map((item) => (
              <div key={item.id} style={styles.remarkItem}>
                <div style={styles.remarkPath}>
                  <span style={{ ...styles.levelIndicator, ...getLevelColor(item.level_type) }}>
                    {getLevelName(item.level_type)}
                  </span>
                  <span>{item.path}</span>
                  {onNavigate && (
                    <button
                      style={styles.navigateButton}
                      onClick={() => onNavigate(item)}
                    >
                      Navigieren →
                    </button>
                  )}
                </div>
                <div style={styles.remarkText}>
                  {item.remark}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.footerButton} onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
