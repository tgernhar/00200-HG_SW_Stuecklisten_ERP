/**
 * OrderDetailView Component
 * Zeigt alle Details eines Auftrags/Angebots in einer 2-Spalten Ansicht (Read-Only).
 */
import React from 'react'
import { OrderDetailItem } from '../../services/ordersDataApi'

interface OrderDetailViewProps {
  order: OrderDetailItem
  documentTypeLabel: string  // z.B. "Auftrag", "Angebot", etc.
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    minHeight: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: '16px 20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  headerTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 600,
    color: '#333',
  },
  headerSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#666',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'white',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  cardTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '8px',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: '8px 12px',
    alignItems: 'start',
  },
  fieldLabel: {
    fontSize: '12px',
    color: '#666',
    fontWeight: 500,
  },
  fieldValue: {
    fontSize: '13px',
    color: '#333',
    wordBreak: 'break-word',
  },
  fieldValueEmpty: {
    fontSize: '13px',
    color: '#999',
    fontStyle: 'italic',
  },
  textArea: {
    backgroundColor: '#f9f9f9',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#333',
    minHeight: '60px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    border: '1px solid #eee',
  },
  textAreaEmpty: {
    backgroundColor: '#f9f9f9',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#999',
    fontStyle: 'italic',
    minHeight: '40px',
    border: '1px solid #eee',
  },
  priceValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#2e7d32',
  },
  checkbox: {
    width: '16px',
    height: '16px',
  },
  metaInfo: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    fontSize: '12px',
    color: '#666',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #eee',
  },
}

// Helper functions
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE')
  } catch {
    return dateStr
  }
}

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

const formatPrice = (price: number | null, currency: string | null): string => {
  if (price === null || price === undefined) return '-'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR'
  }).format(price)
}

// Field component for consistent styling
const Field: React.FC<{ label: string; value: string | null | undefined; isPrice?: boolean }> = ({ label, value, isPrice }) => (
  <>
    <span style={styles.fieldLabel}>{label}</span>
    <span style={value ? (isPrice ? styles.priceValue : styles.fieldValue) : styles.fieldValueEmpty}>
      {value || '-'}
    </span>
  </>
)

// TextArea field for multiline content
const TextAreaField: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ ...styles.fieldLabel, marginBottom: '4px' }}>{label}</div>
    <div style={value ? styles.textArea : styles.textAreaEmpty}>
      {value || 'Keine Angabe'}
    </div>
  </div>
)

export default function OrderDetailView({ order, documentTypeLabel }: OrderDetailViewProps) {
  // Build customer display string
  const kundeDisplay = order.kunde_name 
    ? (order.kunde_kdn ? `${order.kunde_name} (${order.kunde_kdn})` : order.kunde_name)
    : null

  return (
    <div style={styles.container}>
      {/* Header with document number and status */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>{order.name}</h1>
          <p style={styles.headerSubtitle}>
            {documentTypeLabel} {order.reference ? `• Referenz: ${order.reference}` : ''}
          </p>
        </div>
        {order.status_name && (
          <span style={{
            ...styles.statusBadge,
            backgroundColor: order.status_color || '#888',
          }}>
            {order.status_name}
          </span>
        )}
      </div>

      {/* Main content in 2-column grid */}
      <div style={styles.contentGrid}>
        {/* Left column: Hauptdaten */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Stammdaten</h2>
          <div style={styles.fieldGrid}>
            <Field label="Kunde" value={kundeDisplay} />
            <Field label="Angebotsadresse" value={order.kunde_name} />
            <Field label="Lieferadresse" value={order.lieferadresse_name} />
            <Field label="Techn. Kontakt" value={order.techkontakt_name} />
            <Field label="Kfm. Kontakt" value={order.kfmkontakt_name} />
          </div>

          <h2 style={{ ...styles.cardTitle, marginTop: '20px' }}>Termine & Preis</h2>
          <div style={styles.fieldGrid}>
            <Field label="Kunden Liefertermin" value={formatDate(order.date1)} />
            <Field label="H+G Liefertermin" value={formatDate(order.date2)} />
            <Field label="Gesamtpreis" value={formatPrice(order.price, order.currency)} isPrice />
            <Field label="Währung" value={order.currency} />
          </div>

          <h2 style={{ ...styles.cardTitle, marginTop: '20px' }}>Zuständigkeiten</h2>
          <div style={styles.fieldGrid}>
            <Field label="Backoffice" value={order.backoffice_name} />
            <Field label="Vertrieb" value={order.vertrieb_name} />
          </div>
        </div>

        {/* Right column: Texte & weitere Infos */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Beschreibung</h2>
          <TextAreaField label="Text" value={order.text} />
          <TextAreaField label="Notiz" value={order.notiz} />
          <TextAreaField label="Notiz Produktion" value={order.productionText} />
          <TextAreaField label="Notiz Nachkalkulation" value={order.calculationText} />

          <h2 style={{ ...styles.cardTitle, marginTop: '20px' }}>Konditionen</h2>
          <div style={styles.fieldGrid}>
            <Field label="Sprache" value={order.sprache_name} />
            <Field label="Zahlungsziel" value={order.zahlungsziel_text} />
            <Field label="Steuer" value={order.taxtype} />
            <Field label="Factoring" value={order.factoring_text} />
            <Field label="Factoring Datum" value={formatDate(order.factDat)} />
            <Field label="Rechnungskonto" value={order.accounting?.toString()} />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333' }}>
              <input
                type="checkbox"
                checked={order.printPos === 1}
                disabled
                style={styles.checkbox}
              />
              Alle Positionen drucken
            </label>
          </div>

          {/* Meta info footer */}
          <div style={styles.metaInfo}>
            <span>Erstellt: {formatDateTime(order.created)} {order.creator_name ? `von ${order.creator_name}` : ''}</span>
            <span>Bearbeitet: {formatDate(order.lupdat)} {order.lupdfrom ? `von ${order.lupdfrom}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
