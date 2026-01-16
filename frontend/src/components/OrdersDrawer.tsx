import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Order } from '../services/types'

interface OrdersDrawerProps {
  articleId: number | null
  articleNumber?: string
  onClose: () => void
}

export const OrdersDrawer: React.FC<OrdersDrawerProps> = ({ articleId, articleNumber, onClose }) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      if (!articleId) return
      setLoading(true)
      setError(null)
      try {
        const res = await api.get(`/articles/${articleId}/orders`)
        setOrders(Array.isArray(res.data) ? res.data : [])
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || 'Fehler beim Laden der Bestellungen')
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [articleId])

  if (!articleId) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: 1000
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: '520px',
          maxWidth: '92vw',
          backgroundColor: '#fff',
          zIndex: 1001,
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Bestellungen</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              Artikel: {articleNumber || '-'} (ID {articleId})
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: '1px solid #ddd',
              background: '#f7f7f7',
              borderRadius: 6,
              padding: '6px 10px',
              cursor: 'pointer'
            }}
          >
            Schließen
          </button>
        </div>

        <div style={{ padding: '12px 16px', overflow: 'auto', flex: 1 }}>
          {loading && <div style={{ color: '#666' }}>Lade…</div>}
          {error && <div style={{ color: '#c00' }}>Fehler: {error}</div>}

          {!loading && !error && orders.length === 0 && (
            <div style={{ color: '#666' }}>Keine Bestellungen gefunden.</div>
          )}

          {!loading && !error && orders.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 12, color: '#666', padding: '8px 6px' }}>Auftrag</th>
                  <th style={{ textAlign: 'left', fontSize: 12, color: '#666', padding: '8px 6px' }}>Status</th>
                  <th style={{ textAlign: 'right', fontSize: 12, color: '#666', padding: '8px 6px' }}>Menge</th>
                  <th style={{ textAlign: 'left', fontSize: 12, color: '#666', padding: '8px 6px' }}>LT</th>
                  <th style={{ textAlign: 'left', fontSize: 12, color: '#666', padding: '8px 6px' }}>LT bestätigt</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '8px 6px', fontSize: 13 }}>{o.hg_bnr || ''}</td>
                    <td style={{ padding: '8px 6px', fontSize: 13 }}>{o.bnr_status || ''}</td>
                    <td style={{ padding: '8px 6px', fontSize: 13, textAlign: 'right' }}>
                      {o.bnr_menge ?? ''}
                    </td>
                    <td style={{ padding: '8px 6px', fontSize: 13 }}>{o.hg_lt || ''}</td>
                    <td style={{ padding: '8px 6px', fontSize: 13 }}>{o.bestaetigter_lt || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !error && orders.some((o) => o.bestellkommentar) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Kommentare (ALT TEXT)</div>
              {orders
                .filter((o) => o.bestellkommentar)
                .map((o) => (
                  <div key={`c-${o.id}`} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 6, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{o.hg_bnr || 'Auftrag'}</div>
                    <div style={{ fontSize: 13 }}>{o.bestellkommentar}</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

