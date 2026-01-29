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
    overflow: 'auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '14px',
    color: '#666',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
  },
  errorText: {
    fontSize: '14px',
    color: '#c00',
  },
  errorBackButton: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
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
      {loading ? (
        <div style={styles.loading}>Lade Auftragsdaten...</div>
      ) : error ? (
        <div style={styles.error}>
          <span style={styles.errorText}>{error}</span>
          <button style={styles.errorBackButton} onClick={handleBack}>
            Zurück zur Liste
          </button>
        </div>
      ) : order ? (
        <OrderDetailView 
          order={order} 
          documentTypeLabel={documentTypeLabel}
          orderType={order.orderType}
        />
      ) : null}
    </div>
  )
}
