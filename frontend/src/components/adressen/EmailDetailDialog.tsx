/**
 * EmailDetailDialog Component
 * Shows email details in a dialog when clicking on an email row.
 */
import React, { useState, useEffect } from 'react'
import {
  ContactEmail,
  EmailType,
  getEmailTypes,
} from '../../services/adressenApi'

interface EmailDetailDialogProps {
  email: ContactEmail
  onClose: () => void
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '400px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px 4px 0 0',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  content: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  section: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    padding: '8px 12px',
    fontWeight: 'bold',
    fontSize: '12px',
    borderBottom: '1px solid #ddd',
  },
  sectionContent: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  fieldLabel: {
    fontSize: '12px',
    color: '#333',
    minWidth: '60px',
  },
  input: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
  },
  select: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    backgroundColor: 'white',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    backgroundColor: '#f5f5f5',
    borderRadius: '0 0 4px 4px',
  },
  button: {
    padding: '6px 16px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
}

export default function EmailDetailDialog({ email, onClose }: EmailDetailDialogProps) {
  const [emailTypes, setEmailTypes] = useState<EmailType[]>([])
  const [formData, setFormData] = useState({
    email: email.email || '',
    type: email.type || 0,
  })

  useEffect(() => {
    loadEmailTypes()
  }, [])

  const loadEmailTypes = async () => {
    try {
      const types = await getEmailTypes()
      setEmailTypes(types)
    } catch (err) {
      console.error('Failed to load email types:', err)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.dialog}>
        <div style={styles.header}>Email</div>
        
        <div style={styles.content}>
          <div style={styles.section}>
            <div style={styles.sectionHeader}>Email</div>
            <div style={styles.sectionContent}>
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Email</span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Art</span>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: parseInt(e.target.value) })}
                  style={styles.select}
                >
                  <option value={0}>Bitte wählen</option>
                  {/* Show current value if not in options list */}
                  {email.type && !emailTypes.some(t => t.id === email.type) && (
                    <option key="current" value={email.type}>{email.type_name || `Typ ${email.type}`}</option>
                  )}
                  {emailTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name || '-'}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.button} disabled>
            💾 Speichern
          </button>
          <button style={styles.button} disabled>
            🗑️ Löschen
          </button>
          <button style={styles.button} onClick={onClose}>
            ⊘ Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
