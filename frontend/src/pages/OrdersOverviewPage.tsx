/**
 * Orders Overview Page
 * Replaces the Excel pivot table for Auftragsübersicht
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import api from '../services/api'

interface OrderItem {
  pos: number
  au_verantwortlich: string | null
  lt_hg_bestaetigt: string | null
  auftrag: string | null
  kunde: string | null
  au_text: string | null
  produktionsinfo: string | null
  lt_kundenwunsch: string | null
  technischer_kontakt: string | null
  order_id: number | null
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    padding: '10px'
  },
  header: {
    marginBottom: '15px'
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    marginBottom: '10px',
    fontFamily: 'Arial, sans-serif',
    color: '#333333'
  },
  filters: {
    display: 'flex',
    gap: '15px',
    marginBottom: '15px',
    flexWrap: 'wrap' as const,
    alignItems: 'flex-end'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  filterLabel: {
    fontSize: '12px',
    color: '#666666',
    fontFamily: 'Arial, sans-serif'
  },
  filterInput: {
    padding: '6px 10px',
    border: '1px solid #cccccc',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'Arial, sans-serif',
    width: '150px'
  },
  button: {
    padding: '6px 15px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #cccccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'Arial, sans-serif'
  },
  gridContainer: {
    flex: 1,
    width: '100%'
  },
  statusBar: {
    padding: '8px 10px',
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #dddddd',
    fontSize: '12px',
    color: '#666666',
    fontFamily: 'Arial, sans-serif'
  }
}

// Date formatter for German format
const dateFormatter = (params: any) => {
  if (!params.value) return ''
  try {
    const date = new Date(params.value)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return params.value
  }
}

// Cell style for delivery date based on proximity
const getDeliveryDateStyle = (params: any) => {
  if (!params.value) return {}
  
  try {
    const date = new Date(params.value)
    const today = new Date()
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      // Overdue - red
      return { backgroundColor: '#ffcccc' }
    } else if (diffDays <= 7) {
      // Due within a week - orange
      return { backgroundColor: '#ffe0b3' }
    } else if (diffDays <= 14) {
      // Due within 2 weeks - yellow
      return { backgroundColor: '#ffffcc' }
    }
    return {}
  } catch {
    return {}
  }
}

export default function OrdersOverviewPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  
  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [responsible, setResponsible] = useState('')
  const [customer, setCustomer] = useState('')

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Pos.',
      field: 'pos',
      width: 70,
      pinned: 'left',
      sortable: false
    },
    {
      headerName: 'AU-Verantwortlich',
      field: 'au_verantwortlich',
      width: 130,
      filter: true,
      sortable: true
    },
    {
      headerName: 'LT-HG-Bestätigt',
      field: 'lt_hg_bestaetigt',
      width: 130,
      valueFormatter: dateFormatter,
      cellStyle: getDeliveryDateStyle,
      filter: 'agDateColumnFilter',
      sortable: true
    },
    {
      headerName: 'Auftrag',
      field: 'auftrag',
      width: 130,
      filter: true,
      sortable: true
    },
    {
      headerName: 'Kunde',
      field: 'kunde',
      width: 180,
      filter: true,
      sortable: true
    },
    {
      headerName: 'AU-Text',
      field: 'au_text',
      width: 300,
      filter: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { whiteSpace: 'normal', lineHeight: '1.4' }
    },
    {
      headerName: 'Produktionsinfo',
      field: 'produktionsinfo',
      width: 250,
      editable: true,
      filter: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { whiteSpace: 'normal', lineHeight: '1.4', backgroundColor: '#f0f8ff' }
    },
    {
      headerName: 'LT-Kundenwunsch',
      field: 'lt_kundenwunsch',
      width: 130,
      valueFormatter: dateFormatter,
      filter: 'agDateColumnFilter',
      sortable: true
    },
    {
      headerName: 'Technischer K.',
      field: 'technischer_kontakt',
      width: 150,
      filter: true,
      sortable: true
    }
  ], [])

  // Default column definition
  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true
  }), [])

  // Load orders
  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params: any = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (responsible) params.responsible = responsible
      if (customer) params.customer = customer
      
      const response = await api.get('/orders/overview', { params })
      const data = response.data
      
      setOrders(data.items || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Fehler beim Laden'
      setError(message)
      console.error('Error loading orders:', err)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, responsible, customer])

  // Load on mount and when filters change
  useEffect(() => {
    loadOrders()
  }, []) // Only load on mount, use button for filter updates

  // Handle cell value changes (for Produktionsinfo editing)
  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue } = event
    
    if (colDef.field === 'produktionsinfo' && data.order_id) {
      try {
        await api.patch(`/orders/${data.order_id}/production-info`, null, {
          params: { production_info: newValue || '' }
        })
      } catch (err: any) {
        const message = err.response?.data?.detail || err.message || 'Fehler beim Speichern'
        alert(`Fehler beim Speichern: ${message}`)
        // Revert the change
        event.node.setDataValue(colDef.field!, event.oldValue)
      }
    }
  }, [])

  // Handle filter submit
  const handleFilter = () => {
    loadOrders()
  }

  // Clear filters
  const handleClearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setResponsible('')
    setCustomer('')
    // Reload with cleared filters after state update
    setTimeout(() => loadOrders(), 0)
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Auftragsübersicht</h2>
        
        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>LT-HG-Bestätigt von:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={styles.filterInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>LT-HG-Bestätigt bis:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={styles.filterInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>AU-Verantwortlich:</label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="z.B. TG30"
              style={styles.filterInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Kunde:</label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Suchname"
              style={styles.filterInput}
            />
          </div>
          
          <button
            style={styles.button}
            onClick={handleFilter}
            disabled={loading}
          >
            {loading ? 'Lade...' : 'Filtern'}
          </button>
          
          <button
            style={styles.button}
            onClick={handleClearFilters}
            disabled={loading}
          >
            Filter löschen
          </button>
          
          <button
            style={styles.button}
            onClick={loadOrders}
            disabled={loading}
          >
            Aktualisieren
          </button>
        </div>
      </div>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '10px', padding: '10px', backgroundColor: '#ffeeee', borderRadius: '4px' }}>
          {error}
        </div>
      )}
      
      <div style={styles.gridContainer} className="ag-theme-alpine">
        <AgGridReact
          rowData={orders}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          animateRows={true}
          rowSelection="single"
          suppressRowClickSelection={true}
          domLayout="autoHeight"
          getRowId={(params) => String(params.data.order_id || params.data.pos)}
        />
      </div>
      
      <div style={styles.statusBar}>
        {loading ? (
          'Lade Daten...'
        ) : (
          `${orders.length} von ${total} Aufträgen angezeigt`
        )}
      </div>
    </div>
  )
}
