/**
 * OrderDetailPage
 * Zeigt die Detailansicht eines Auftrags/Angebots/Bestellung etc.
 */
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import OrderDetailView from '../components/orders/OrderDetailView'
import { getOrderDetail, OrderDetailItem } from '../services/ordersDataApi'

// Mapping von URL-Typ zu Label
const typeLabels: Record<string, string> = {
  'gesamtliste': 'Dokument',
  'auftraege': 'Auftrag',
  'angebote': 'Angebot',
  'bestellungen': 'Bestellung',
  'beistellungen': 'Beistellung',
  'anfragen': 'Anfrage',
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    backgroundColor: 'white',
    borderBottom: '1px solid #ddd',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#333',
  },
  breadcrumb: {
    fontSize: '13px',
    color: '#666',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '16px',
    color: '#666',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
  },
  errorText: {
    fontSize: '16px',
    color: '#c00',
  },
}

export default function OrderDetailPage() {
  const { typ, orderId } = useParams<{ typ: string; orderId: string }>()
  const navigate = useNavigate()
  
  const [order, setOrder] = useState<OrderDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      loadOrder(parseInt(orderId))
    }
  }, [orderId])

  const loadOrder = async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getOrderDetail(id)
      setOrder(data)
    } catch (err: any) {
      console.error('Error loading order detail:', err)
      setError(err.response?.data?.detail || 'Fehler beim Laden der Auftragsdaten')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    // Navigate back to the list
    navigate(`/menu/auftragsdaten/${typ}`)
  }

  const documentTypeLabel = typ ? (typeLabels[typ] || 'Dokument') : 'Dokument'

  return (
    <div style={styles.container}>
      {/* Toolbar with back button */}
      <div style={styles.toolbar}>
        <button style={styles.backButton} onClick={handleBack}>
          ← Zurück zur Liste
        </button>
        <span style={styles.breadcrumb}>
          Auftragsdaten / {documentTypeLabel} / {order?.name || `#${orderId}`}
        </span>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>Lade Auftragsdaten...</div>
        ) : error ? (
          <div style={styles.error}>
            <span style={styles.errorText}>{error}</span>
            <button style={styles.backButton} onClick={handleBack}>
              Zurück zur Liste
            </button>
          </div>
        ) : order ? (
          <OrderDetailView 
            order={order} 
            documentTypeLabel={documentTypeLabel}
          />
        ) : null}
      </div>
    </div>
  )
}
