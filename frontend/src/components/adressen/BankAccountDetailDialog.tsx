/**
 * BankAccountDetailDialog Component
 * Shows bank account details (IBAN, Swift) in a simple dialog.
 * Opens when clicking on a row in the Bank table.
 */
import React, { useState } from 'react'
import { AddressLineAccount } from '../../services/adressenApi'

interface BankAccountDetailDialogProps {
  account: AddressLineAccount
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
    zIndex: 1100,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '400px',
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#666',
    padding: '0 4px',
    lineHeight: 1,
  },
  body: {
    padding: '16px',
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '12px',
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 500,
  },
  input: {
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    width: '100%',
    boxSizing: 'border-box',
    height: '28px',
  },
  footer: {
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '8px',
  },
  button: {
    padding: '6px 14px',
    borderRadius: '3px',
    fontSize: '12px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    backgroundColor: '#f0f0f0',
    color: '#333',
  },
}

export default function BankAccountDetailDialog({ account, onClose }: BankAccountDetailDialogProps) {
  // Local form state
  const [formData, setFormData] = useState({
    iban: account.iban || '',
    swift: account.swift || '',
  })

  // Update form field
  const updateField = (field: 'iban' | 'swift', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Handle overlay click - don't close on overlay click for nested dialogs
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Kontonummer</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          <div style={styles.fieldBlock}>
            <span style={styles.fieldLabel}>IBAN</span>
            <input
              type="text"
              value={formData.iban}
              onChange={(e) => updateField('iban', e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.fieldBlock}>
            <span style={styles.fieldLabel}>Swift</span>
            <input
              type="text"
              value={formData.swift}
              onChange={(e) => updateField('swift', e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.button}>
            Speichern
          </button>
          <button style={styles.button} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
