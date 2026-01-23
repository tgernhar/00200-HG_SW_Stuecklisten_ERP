import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Order, DeliveryNote, DeliveryNotesResponse } from '../services/types'

interface OrdersDrawerProps {
  articleId: number | null
  articleNumber?: string
  onClose: () => void
}

// Hilfsfunktion für Zeilenfarbe basierend auf BNR-Status
const getRowBackgroundColor = (bnrStatus: string): string => {
  const status = String(bnrStatus || '').trim().toLowerCase()
  switch (status) {
    case 'geliefert':
      return '#c8e6c9'  // Grün
    case 'unbearbeitet':
      return '#ffcdd2'  // Rot
    case 'bestellt':
      return '#ffcc80'  // Orange
    case 'ab erhalten':
      return '#fff9c4'  // Gelb
    default:
      return '#e0e0e0'  // Grau
  }
}

export const OrdersDrawer: React.FC<OrdersDrawerProps> = ({ articleId, articleNumber, onClose }) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Lieferscheine pro Auftrag (hg_bnr)
  const [deliveryNotesMap, setDeliveryNotesMap] = useState<Record<string, DeliveryNote[]>>({})
  const [loadingDeliveryNotes, setLoadingDeliveryNotes] = useState<Record<string, boolean>>({})
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchOrders = async () => {
      if (!articleId) return
      setLoading(true)
      setError(null)
      setDeliveryNotesMap({})
      setExpandedOrders(new Set())
      try {
        const res = await api.get(`/articles/${articleId}/orders`)
        const ordersData: Order[] = Array.isArray(res.data) ? res.data : []
        setOrders(ordersData)
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || 'Fehler beim Laden der Bestellungen')
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [articleId])

  // Lade Lieferscheine für einen Auftrag
  const fetchDeliveryNotes = async (orderName: string) => {
    if (!orderName || deliveryNotesMap[orderName] !== undefined) return
    
    setLoadingDeliveryNotes(prev => ({ ...prev, [orderName]: true }))
    try {
      const res = await api.get(`/orders/${encodeURIComponent(orderName)}/delivery-notes`)
      const data = res.data as DeliveryNotesResponse
      setDeliveryNotesMap(prev => ({ 
        ...prev, 
        [orderName]: data.delivery_notes || [] 
      }))
    } catch (e: any) {
      console.error('Fehler beim Laden der Lieferscheine:', e)
      setDeliveryNotesMap(prev => ({ ...prev, [orderName]: [] }))
    } finally {
      setLoadingDeliveryNotes(prev => ({ ...prev, [orderName]: false }))
    }
  }

  // Toggle Lieferschein-Ansicht für einen Auftrag
  const toggleOrderExpanded = (orderName: string) => {
    const newExpanded = new Set(expandedOrders)
    if (newExpanded.has(orderName)) {
      newExpanded.delete(orderName)
    } else {
      newExpanded.add(orderName)
      // Lade Lieferscheine wenn noch nicht geladen
      fetchDeliveryNotes(orderName)
    }
    setExpandedOrders(newExpanded)
  }

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
          width: '680px',
          maxWidth: '95vw',
          backgroundColor: '#fff',
          zIndex: 1001,
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Bestellungen & Lieferscheine</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              Artikel: {articleNumber || '-'} (ID {articleId})
            </div>
          </div>
          <button
            onClick={onClose}
            title="Drawer schließen"
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
          {/* Legende für BNR-Status Farben */}
          <div style={{ 
            marginBottom: 12, 
            padding: '8px 12px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: 6,
            fontSize: 11,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: 600, color: '#333' }}>Legende BNR-Status:</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ 
                display: 'inline-block', 
                width: 16, 
                height: 16, 
                backgroundColor: '#c8e6c9', 
                border: '1px solid #81c784', 
                borderRadius: 3 
              }}></span>
              <span>Geliefert</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ 
                display: 'inline-block', 
                width: 16, 
                height: 16, 
                backgroundColor: '#ffcdd2', 
                border: '1px solid #ef9a9a', 
                borderRadius: 3 
              }}></span>
              <span>Unbearbeitet</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ 
                display: 'inline-block', 
                width: 16, 
                height: 16, 
                backgroundColor: '#ffcc80', 
                border: '1px solid #ffb74d', 
                borderRadius: 3 
              }}></span>
              <span>Bestellt</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ 
                display: 'inline-block', 
                width: 16, 
                height: 16, 
                backgroundColor: '#fff9c4', 
                border: '1px solid #fdd835', 
                borderRadius: 3 
              }}></span>
              <span>AB erhalten</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ 
                display: 'inline-block', 
                width: 16, 
                height: 16, 
                backgroundColor: '#e0e0e0', 
                border: '1px solid #bdbdbd', 
                borderRadius: 3 
              }}></span>
              <span>Sonstige</span>
            </span>
          </div>

          {loading && <div style={{ color: '#666' }}>Lade…</div>}
          {error && <div style={{ color: '#c00' }}>Fehler: {error}</div>}

          {!loading && !error && orders.length === 0 && (
            <div style={{ color: '#666' }}>Keine Bestellungen gefunden.</div>
          )}

          {!loading && !error && orders.length > 0 && (
            <>
              {/* Bestell-Tabelle */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>
                  Bestellungen ({orders.length})
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f8f8' }}>
                      <th style={{ textAlign: 'left', fontSize: 11, color: '#666', padding: '8px 6px' }}>Auftrag</th>
                      <th style={{ textAlign: 'left', fontSize: 11, color: '#666', padding: '8px 6px' }}>Status</th>
                      <th style={{ textAlign: 'right', fontSize: 11, color: '#666', padding: '8px 6px' }}>Menge</th>
                      <th style={{ textAlign: 'left', fontSize: 11, color: '#666', padding: '8px 6px' }}>LT</th>
                      <th style={{ textAlign: 'left', fontSize: 11, color: '#666', padding: '8px 6px' }}>LT bestätigt</th>
                      <th style={{ textAlign: 'center', fontSize: 11, color: '#666', padding: '8px 6px' }}>Lieferscheine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const orderName = o.hg_bnr || ''
                      const isExpanded = expandedOrders.has(orderName)
                      const isLoadingDN = loadingDeliveryNotes[orderName]
                      const deliveryNotes = deliveryNotesMap[orderName] || []
                      const rowBgColor = getRowBackgroundColor(o.bnr_status || '')
                      
                      return (
                        <React.Fragment key={o.id}>
                          <tr style={{ 
                            borderTop: '1px solid #eee',
                            backgroundColor: rowBgColor
                          }}>
                            <td style={{ padding: '8px 6px', fontSize: 12 }}>{orderName}</td>
                            <td style={{ padding: '8px 6px', fontSize: 12, fontWeight: 500 }}>{o.bnr_status || ''}</td>
                            <td style={{ padding: '8px 6px', fontSize: 12, textAlign: 'right' }}>
                              {o.bnr_menge ?? ''}
                            </td>
                            <td style={{ padding: '8px 6px', fontSize: 12 }}>{o.hg_lt || ''}</td>
                            <td style={{ padding: '8px 6px', fontSize: 12 }}>{o.bestaetigter_lt || ''}</td>
                            <td style={{ padding: '8px 6px', fontSize: 12, textAlign: 'center' }}>
                              {orderName && (
                                <button
                                  onClick={() => toggleOrderExpanded(orderName)}
                                  title="Lieferscheine für diesen Auftrag anzeigen/ausblenden"
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: 11,
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                    background: isExpanded ? '#e3f2fd' : '#fff',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {isLoadingDN ? '...' : isExpanded ? '▼' : '▶'}
                                </button>
                              )}
                            </td>
                          </tr>
                          
                          {/* Lieferschein-Details (expandiert) */}
                          {isExpanded && orderName && (
                            <tr>
                              <td colSpan={6} style={{ padding: 0, backgroundColor: '#fafafa' }}>
                                <div style={{ padding: '12px 16px', borderLeft: '3px solid #2196f3' }}>
                                  {isLoadingDN && (
                                    <div style={{ color: '#666', fontSize: 12 }}>Lade Lieferscheine...</div>
                                  )}
                                  
                                  {!isLoadingDN && deliveryNotes.length === 0 && (
                                    <div style={{ color: '#666', fontSize: 12 }}>
                                      Keine Lieferscheine für diesen Auftrag gefunden.
                                    </div>
                                  )}
                                  
                                  {!isLoadingDN && deliveryNotes.map((dn, dnIndex) => (
                                    <div 
                                      key={dn.delivery_note_id} 
                                      style={{ 
                                        marginBottom: dnIndex < deliveryNotes.length - 1 ? 16 : 0,
                                        padding: 12,
                                        backgroundColor: '#fff',
                                        borderRadius: 6,
                                        border: '1px solid #e0e0e0'
                                      }}
                                    >
                                      {/* Lieferschein Header */}
                                      <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(2, 1fr)', 
                                        gap: '8px 16px',
                                        marginBottom: 12,
                                        fontSize: 12
                                      }}>
                                        <div>
                                          <span style={{ color: '#666' }}>Lieferschein Nr:</span>{' '}
                                          <strong>{dn.number || '-'}</strong>
                                        </div>
                                        <div>
                                          <span style={{ color: '#666' }}>Lieferdatum:</span>{' '}
                                          <strong>{dn.delivery_date || '-'}</strong>
                                        </div>
                                        <div>
                                          <span style={{ color: '#666' }}>Gebucht am:</span>{' '}
                                          {dn.booked_at || '-'}
                                        </div>
                                        <div>
                                          <span style={{ color: '#666' }}>Gebucht von:</span>{' '}
                                          {dn.booked_by || '-'}
                                        </div>
                                        {dn.description && (
                                          <div style={{ gridColumn: '1 / -1' }}>
                                            <span style={{ color: '#666' }}>Bemerkung:</span>{' '}
                                            {dn.description}
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Lieferschein-Artikel Tabelle */}
                                      {dn.articles && dn.articles.length > 0 && (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#f5f5f5' }}>
                                              <th style={{ textAlign: 'center', padding: '6px 4px', color: '#666' }}>Pos.</th>
                                              <th style={{ textAlign: 'left', padding: '6px 4px', color: '#666' }}>Artikelnr</th>
                                              <th style={{ textAlign: 'left', padding: '6px 4px', color: '#666' }}>Bezeichnung</th>
                                              <th style={{ textAlign: 'right', padding: '6px 4px', color: '#666' }}>Menge</th>
                                              <th style={{ textAlign: 'left', padding: '6px 4px', color: '#666' }}>Beschreibung</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {dn.articles.map((art) => (
                                              <tr key={`${dn.delivery_note_id}-${art.pos}`} style={{ borderTop: '1px solid #eee' }}>
                                                <td style={{ textAlign: 'center', padding: '6px 4px' }}>{art.pos}</td>
                                                <td style={{ padding: '6px 4px' }}>{art.article_number}</td>
                                                <td style={{ padding: '6px 4px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={art.article_description}>
                                                  {art.article_description}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '6px 4px' }}>{art.amount}</td>
                                                <td style={{ padding: '6px 4px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={art.note || ''}>
                                                  {art.note || ''}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bestellkommentare (wie vorher) */}
              {orders.some((o) => o.bestellkommentar) && (
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
