/**
 * LieferantDetailDialog Component
 * Shows detailed distributor (supplier) information in a dialog.
 * Layout based on HUGWAWI Lieferant dialog.
 */
import React, { useState, useEffect } from 'react'
import {
  ArticleDistributor,
  getDistributorDetail,
} from '../../services/artikelApi'

interface LieferantDetailDialogProps {
  distributorId: number
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
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '700px',
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
  inputReadonly: {
    padding: '5px 8px',
    border: '1px solid #eee',
    borderRadius: '3px',
    fontSize: '12px',
    width: '100%',
    boxSizing: 'border-box' as const,
    backgroundColor: '#f9f9f9',
    color: '#666',
    height: '26px',
  },
  spinner: {
    padding: '5px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    width: '80px',
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
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '13px',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#c00',
    fontSize: '13px',
  },
}

// Input field component
const InputField: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  readonly?: boolean
  type?: string
}> = ({ label, value, onChange, readonly = false, type = 'text' }) => (
  <div style={styles.fieldBlock}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={readonly ? styles.inputReadonly : styles.input}
      readOnly={readonly}
    />
  </div>
)

// Spinner field component for rating
const SpinnerField: React.FC<{
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}> = ({ label, value, onChange, min = 1, max = 10 }) => (
  <div style={styles.fieldBlock}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const val = parseInt(e.target.value) || min
        onChange(Math.max(min, Math.min(max, val)))
      }}
      min={min}
      max={max}
      style={styles.spinner}
    />
  </div>
)

export default function LieferantDetailDialog({ distributorId, onClose }: LieferantDetailDialogProps) {
  const [distributor, setDistributor] = useState<ArticleDistributor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    distributor_name: '',
    rating: 1,
    comment: '',
    deliverytime: '',
    distributorarticlenumber: '',
    courier: '',
    minordervalue: '',
    packinggrade: '',
  })

  useEffect(() => {
    loadData()
  }, [distributorId])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDistributorDetail(distributorId)
      setDistributor(data)
      setFormData({
        distributor_name: data.distributor_name || '',
        rating: data.rating || 1,
        comment: data.comment || '',
        deliverytime: data.deliverytime?.toString() || '',
        distributorarticlenumber: data.distributorarticlenumber || '',
        courier: data.courier || '',
        minordervalue: data.minordervalue?.toString() || '',
        packinggrade: data.packinggrade?.toString() || '',
      })
    } catch (err: any) {
      console.error('Error loading distributor:', err)
      setError(err.response?.data?.detail || 'Fehler beim Laden der Lieferantendaten')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>Lieferant</h3>
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
          <button style={styles.toolbarButtonDisabled} disabled title="Neu">
            Neu [alt+n]
          </button>
        </div>

        <div style={styles.body}>
          {loading ? (
            <div style={styles.loading}>Lade Lieferantendaten...</div>
          ) : error ? (
            <div style={styles.error}>{error}</div>
          ) : (
            <div style={styles.fieldGrid}>
              <InputField
                label="Lieferant"
                value={formData.distributor_name}
                onChange={(v) => updateField('distributor_name', v)}
                readonly
              />
              <SpinnerField
                label="Bewertung"
                value={formData.rating}
                onChange={(v) => updateField('rating', v)}
                min={1}
                max={10}
              />
              <InputField
                label="Kommentar"
                value={formData.comment}
                onChange={(v) => updateField('comment', v)}
              />

              <InputField
                label="Lieferzeit (in Tagen)"
                value={formData.deliverytime}
                onChange={(v) => updateField('deliverytime', v)}
                type="number"
              />
              <InputField
                label="Lieferanten Artikel-Nr"
                value={formData.distributorarticlenumber}
                onChange={(v) => updateField('distributorarticlenumber', v)}
              />
              <InputField
                label="Versandunternehmen"
                value={formData.courier}
                onChange={(v) => updateField('courier', v)}
              />

              <InputField
                label="Mindestbestellwert"
                value={formData.minordervalue}
                onChange={(v) => updateField('minordervalue', v)}
                type="number"
              />
              <div style={styles.fieldBlock}>
                {/* Empty placeholder */}
              </div>
              <InputField
                label="Verpackungseinheit"
                value={formData.packinggrade}
                onChange={(v) => updateField('packinggrade', v)}
                type="number"
              />
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.footerButtonDisabled} disabled>
            Speichern
          </button>
          <button style={styles.footerButtonDisabled} disabled>
            Neu
          </button>
          <button style={styles.footerButton} onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
