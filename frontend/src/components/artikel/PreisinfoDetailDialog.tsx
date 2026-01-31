/**
 * PreisinfoDetailDialog Component
 * Shows price information details in a dialog.
 * Layout based on HUGWAWI Preisinformationen dialog.
 */
import React, { useState, useEffect } from 'react'
import { DistributorPriceinfo } from '../../services/artikelApi'

interface PreisinfoDetailDialogProps {
  priceinfo: DistributorPriceinfo
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
    width: '500px',
    maxWidth: '95vw',
    maxHeight: '90vh',
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
  toolbar: {
    display: 'flex',
    gap: '8px',
    padding: '8px 16px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#fafafa',
  },
  toolbarButton: {
    padding: '4px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer',
    fontSize: '11px',
  },
  toolbarButtonDisabled: {
    padding: '4px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#f0f0f0',
    cursor: 'not-allowed',
    fontSize: '11px',
    color: '#999',
  },
  body: {
    padding: '16px',
    overflow: 'auto',
    flex: 1,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  fieldLabel: {
    fontSize: '10px',
    color: '#666',
    fontWeight: 500,
  },
  input: {
    padding: '5px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    width: '100%',
    boxSizing: 'border-box' as const,
    height: '26px',
  },
  footer: {
    padding: '10px 16px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '8px',
    backgroundColor: '#fafafa',
  },
  footerButton: {
    padding: '6px 16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer',
    fontSize: '12px',
  },
  footerButtonDisabled: {
    padding: '6px 16px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#f0f0f0',
    cursor: 'not-allowed',
    fontSize: '12px',
    color: '#999',
  },
}

// Input field component
const InputField: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}> = ({ label, value, onChange, type = 'text' }) => (
  <div style={styles.fieldBlock}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
    />
  </div>
)

export default function PreisinfoDetailDialog({ priceinfo, onClose }: PreisinfoDetailDialogProps) {
  // Form state
  const [formData, setFormData] = useState({
    grade: priceinfo.grade?.toString() || '',
    price: priceinfo.price?.toString() || '',
    variablePrice: priceinfo.variablePrice?.toString() || '',
    purchasedate: priceinfo.purchasedate ? priceinfo.purchasedate.split('T')[0] : '',
    distributorofferid: priceinfo.distributorofferid || '',
  })

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>Preisinformationen</h3>
        </div>

        <div style={styles.toolbar}>
          <button style={styles.toolbarButtonDisabled} disabled title="Speichern">
            Speichern [alt+s]
          </button>
          <button style={styles.toolbarButton} onClick={onClose}>
            Schließen [alt+x]
          </button>
          <button style={styles.toolbarButtonDisabled} disabled title="Löschen">
            Löschen [alt+d]
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.fieldGrid}>
            <InputField
              label="Staffel"
              value={formData.grade}
              onChange={(v) => updateField('grade', v)}
              type="number"
            />
            <InputField
              label="Einkaufspreis"
              value={formData.price}
              onChange={(v) => updateField('price', v)}
              type="number"
            />
            <InputField
              label="Int. Verrechnungspreis"
              value={formData.variablePrice}
              onChange={(v) => updateField('variablePrice', v)}
              type="number"
            />

            <InputField
              label="Datum ANG/RG"
              value={formData.purchasedate}
              onChange={(v) => updateField('purchasedate', v)}
              type="date"
            />
            <InputField
              label="Nr. ANG/RG LN"
              value={formData.distributorofferid}
              onChange={(v) => updateField('distributorofferid', v)}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.footerButtonDisabled} disabled>
            Speichern
          </button>
          <button style={styles.footerButtonDisabled} disabled>
            Löschen
          </button>
          <button style={styles.footerButtonDisabled} disabled>
            Kopieren
          </button>
          <button style={styles.footerButton} onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
