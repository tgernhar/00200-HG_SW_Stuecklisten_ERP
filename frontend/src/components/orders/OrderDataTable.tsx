/**
 * OrderDataTable Component
 * Wiederverwendbare Tabellenkomponente für Auftragsdaten (Angebote, Aufträge, Bestellungen, etc.)
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  searchOrders,
  getStatuses,
  getBackofficeUsers,
  OrderDataItem,
  OrderDataFilters,
  OrderStatus,
  BackofficeUser
} from '../../services/ordersDataApi'

interface OrderDataTableProps {
  documentTypes: number[]  // IDs der anzuzeigenden Dokumenttypen
  pageTitle: string        // Seitentitel (z.B. "Angebotsliste")
  numberFieldLabel: string // Label für Nummernfeld (z.B. "Angebotsnummer")
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: '16px 20px',
    backgroundColor: 'white',
    borderBottom: '1px solid #ddd',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#333',
  },
  filterSection: {
    padding: '12px 20px',
    backgroundColor: 'white',
    borderBottom: '1px solid #ddd',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '8px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  filterLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 500,
  },
  filterInput: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    minWidth: '120px',
  },
  filterSelect: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    minWidth: '150px',
  },
  filterButton: {
    padding: '8px 16px',
    backgroundColor: '#4a90d9',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  filterButtonSecondary: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  tableContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '0 20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
    fontSize: '13px',
  },
  th: {
    position: 'sticky',
    top: 0,
    backgroundColor: '#f8f8f8',
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '2px solid #ddd',
    fontWeight: 600,
    color: '#333',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  thSortable: {
    cursor: 'pointer',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #eee',
    verticalAlign: 'top',
  },
  tdText: {
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 500,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    backgroundColor: 'white',
    borderTop: '1px solid #ddd',
  },
  paginationInfo: {
    fontSize: '13px',
    color: '#666',
  },
  paginationButtons: {
    display: 'flex',
    gap: '8px',
  },
  paginationButton: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  statusMultiSelect: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    maxHeight: '120px',
    minWidth: '200px',
    overflowY: 'auto',
    backgroundColor: 'white',
  },
  statusListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
    borderBottom: '1px solid #eee',
  },
  statusListItemSelected: {
    backgroundColor: '#e8f0fe',
  },
  statusColorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#666',
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
  },
  rowHover: {
    backgroundColor: '#f5f9ff',
  },
}

export default function OrderDataTable({
  documentTypes,
  pageTitle,
  numberFieldLabel
}: OrderDataTableProps) {
  // State
  const [items, setItems] = useState<OrderDataItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true) // Only shows "Lade Daten..." on first load
  const [statuses, setStatuses] = useState<OrderStatus[]>([])
  const [backofficeUsers, setBackofficeUsers] = useState<BackofficeUser[]>([])
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  
  // Filters
  const [filters, setFilters] = useState<OrderDataFilters>({
    order_types: documentTypes,
    year: new Date().getFullYear(),
    page: 1,
    page_size: 40,
    sort_field: 'created',
    sort_dir: 'desc',
  })
  
  // Temporary filter values (before submit)
  const [tempFilters, setTempFilters] = useState({
    name: '',
    text: '',
    customer: '',
    reference: '',
    price_min: '',
    price_max: '',
    date_from: '',
    date_to: '',
    backoffice_id: '',
    status_ids: [] as number[],
    year: String(new Date().getFullYear()),
  })

  // Column autofilters (instant filtering on table columns)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    name: '',
    reference: '',
    kunde_name: '',
    text: '',
    notiz: '',
    date1: '',
    date2: '',
    created: '',
    price: '',
    status_name: '',
  })

  // Stable key for documentTypes to prevent infinite re-renders
  // (Arrays are compared by reference, so we need a string comparison)
  const documentTypesKey = JSON.stringify(documentTypes)

  // Load initial data
  useEffect(() => {
    loadBackofficeUsers()
  }, [])

  // Load statuses when documentTypes change (filter by ordertype)
  useEffect(() => {
    loadStatuses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentTypesKey])

  // Load data when filters change
  useEffect(() => {
    loadData()
  }, [filters])

  // Update order_types when documentTypes prop changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, order_types: documentTypes, page: 1 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentTypesKey])

  const loadStatuses = async () => {
    try {
      // Load statuses filtered by ordertype (matching documentTypes or -1 for all)
      const orderType = documentTypes.length === 1 ? documentTypes[0] : undefined
      const response = await getStatuses(orderType)
      setStatuses(response.items)
    } catch (error) {
      console.error('Error loading statuses:', error)
    }
  }

  const loadBackofficeUsers = async () => {
    try {
      const response = await getBackofficeUsers()
      setBackofficeUsers(response.items)
    } catch (error) {
      console.error('Error loading backoffice users:', error)
    }
  }

  // Ref to track current request and prevent race conditions
  const loadRequestRef = useRef(0)

  const loadData = useCallback(async () => {
    // Increment request ID to track this specific request
    const currentRequest = ++loadRequestRef.current
    // Only show full loading state on initial load to prevent flicker
    if (initialLoading) {
      setLoading(true)
    }
    try {
      const response = await searchOrders(filters)
      // Only update state if this is still the latest request
      if (currentRequest !== loadRequestRef.current) {
        return // Ignore stale responses
      }
      setItems(response.items)
      setTotal(response.total)
      setTotalPages(response.total_pages)
    } catch (error) {
      if (currentRequest !== loadRequestRef.current) return // Ignore stale errors
      console.error('Error loading orders:', error)
      setItems([])
      setTotal(0)
    } finally {
      if (currentRequest === loadRequestRef.current) {
        setLoading(false)
        setInitialLoading(false)
      }
    }
  }, [filters, initialLoading])

  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      name: tempFilters.name || undefined,
      text: tempFilters.text || undefined,
      customer: tempFilters.customer || undefined,
      reference: tempFilters.reference || undefined,
      price_min: tempFilters.price_min ? parseFloat(tempFilters.price_min) : undefined,
      price_max: tempFilters.price_max ? parseFloat(tempFilters.price_max) : undefined,
      date_from: tempFilters.date_from || undefined,
      date_to: tempFilters.date_to || undefined,
      backoffice_id: tempFilters.backoffice_id ? parseInt(tempFilters.backoffice_id) : undefined,
      status_ids: tempFilters.status_ids.length > 0 ? tempFilters.status_ids : undefined,
      year: tempFilters.year ? parseInt(tempFilters.year) : undefined,
      page: 1,
    }))
  }

  const handleReset = () => {
    const currentYear = String(new Date().getFullYear())
    setTempFilters({
      name: '',
      text: '',
      customer: '',
      reference: '',
      price_min: '',
      price_max: '',
      date_from: '',
      date_to: '',
      backoffice_id: '',
      status_ids: [],
      year: currentYear,
    })
    // Reset column autofilters
    setColumnFilters({
      name: '',
      reference: '',
      kunde_name: '',
      text: '',
      notiz: '',
      date1: '',
      date2: '',
      created: '',
      price: '',
      status_name: '',
    })
    // Don't reset initialLoading - only show full loading on first load
    setFilters({
      order_types: documentTypes,
      year: parseInt(currentYear),
      page: 1,
      page_size: 40,
      sort_field: 'created',
      sort_dir: 'desc',
    })
  }

  const handleSort = (field: string) => {
    setFilters(prev => ({
      ...prev,
      sort_field: field,
      sort_dir: prev.sort_field === field && prev.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }))
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setFilters(prev => ({ ...prev, page: newPage }))
    }
  }

  const handleStatusToggle = (statusId: number) => {
    setTempFilters(prev => ({
      ...prev,
      status_ids: prev.status_ids.includes(statusId)
        ? prev.status_ids.filter(id => id !== statusId)
        : [...prev.status_ids, statusId]
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Group backoffice users by department
  const groupedUsers = useMemo(() => {
    const groups: Record<string, BackofficeUser[]> = {}
    backofficeUsers.forEach(user => {
      const dept = user.department_name || 'Ohne Abteilung'
      if (!groups[dept]) groups[dept] = []
      groups[dept].push(user)
    })
    return groups
  }, [backofficeUsers])

  const getSortIcon = (field: string) => {
    if (filters.sort_field !== field) return ' ⇅'
    return filters.sort_dir === 'asc' ? ' ▲' : ' ▼'
  }

  // Client-side filtering based on column autofilters
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      for (const [key, filterValue] of Object.entries(columnFilters)) {
        if (!filterValue) continue
        const searchTerm = filterValue.toLowerCase()
        let itemValue = ''
        
        switch (key) {
          case 'name':
            itemValue = item.name || ''
            break
          case 'reference':
            itemValue = item.reference || ''
            break
          case 'kunde_name':
            itemValue = item.kunde_name || ''
            break
          case 'text':
            itemValue = item.text || ''
            break
          case 'notiz':
            itemValue = item.notiz || ''
            break
          case 'date1':
          case 'date2':
          case 'created':
            itemValue = formatDate(item[key as keyof OrderDataItem] as string | null) || ''
            break
          case 'price':
            itemValue = formatPrice(item.price) || ''
            break
          case 'status_name':
            itemValue = item.status_name || ''
            break
        }
        
        if (!itemValue.toLowerCase().includes(searchTerm)) {
          return false
        }
      }
      return true
    })
  }, [items, columnFilters])

  const handleColumnFilterChange = (field: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [field]: value }))
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('de-DE')
    } catch {
      return dateStr
    }
  }

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '-'
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(price)
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{pageTitle}</h1>
      </div>

      {/* Filter Section */}
      <div style={styles.filterSection}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          {/* Left side: Filter fields in two rows */}
          <div style={{ flex: 1 }}>
            <div style={styles.filterRow}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>{numberFieldLabel}</label>
                <input
                  type="text"
                  style={styles.filterInput}
                  value={tempFilters.name}
                  onChange={e => setTempFilters(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  placeholder="z.B. ANG-2026-..."
                />
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Jahr</label>
                <input
                  type="number"
                  style={{ ...styles.filterInput, width: '80px' }}
                  value={tempFilters.year}
                  onChange={e => setTempFilters(prev => ({ ...prev, year: e.target.value }))}
                  onKeyDown={handleKeyDown}
                />
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Text</label>
                <input
                  type="text"
                  style={{ ...styles.filterInput, width: '200px' }}
                  value={tempFilters.text}
                  onChange={e => setTempFilters(prev => ({ ...prev, text: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  placeholder="Freitext..."
                />
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Kunde</label>
                <input
                  type="text"
                  style={{ ...styles.filterInput, width: '180px' }}
                  value={tempFilters.customer}
                  onChange={e => setTempFilters(prev => ({ ...prev, customer: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  placeholder="Name oder KdNr..."
                />
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Referenz</label>
                <input
                  type="text"
                  style={styles.filterInput}
                  value={tempFilters.reference}
                  onChange={e => setTempFilters(prev => ({ ...prev, reference: e.target.value }))}
                  onKeyDown={handleKeyDown}
                />
              </div>
              
              <div style={{ ...styles.filterGroup, justifyContent: 'flex-end' }}>
                <label style={{ ...styles.filterLabel, visibility: 'hidden' }}>Aktionen</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={styles.filterButton} onClick={handleSearch}>
                    🔍 Suchen
                  </button>
                  <button style={styles.filterButtonSecondary} onClick={handleReset}>
                    ✕ Leeren
                  </button>
                </div>
              </div>
            </div>
            
            <div style={styles.filterRow}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Preis von</label>
                <input
                  type="number"
                  style={{ ...styles.filterInput, width: '80px' }}
                  value={tempFilters.price_min}
                  onChange={e => setTempFilters(prev => ({ ...prev, price_min: e.target.value }))}
                  onKeyDown={handleKeyDown}
                />
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Preis bis</label>
                <input
                  type="number"
                  style={{ ...styles.filterInput, width: '80px' }}
                  value={tempFilters.price_max}
                  onChange={e => setTempFilters(prev => ({ ...prev, price_max: e.target.value }))}
                  onKeyDown={handleKeyDown}
                />
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Lieferdatum von</label>
                <input
                  type="date"
                  style={{ ...styles.filterInput, width: '130px' }}
                  value={tempFilters.date_from}
                  onChange={e => setTempFilters(prev => ({ ...prev, date_from: e.target.value }))}
                />
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Lieferdatum bis</label>
                <input
                  type="date"
                  style={{ ...styles.filterInput, width: '130px' }}
                  value={tempFilters.date_to}
                  onChange={e => setTempFilters(prev => ({ ...prev, date_to: e.target.value }))}
                />
              </div>
              
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Aufträge von</label>
                <select
                  style={{ ...styles.filterSelect, minWidth: '120px' }}
                  value={tempFilters.backoffice_id}
                  onChange={e => setTempFilters(prev => ({ ...prev, backoffice_id: e.target.value }))}
                >
                  <option value="">Alle</option>
                  {Object.entries(groupedUsers).map(([dept, users]) => (
                    <optgroup key={dept} label={dept}>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.loginname}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* Right side: Status list */}
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Status</label>
            <div style={{ ...styles.statusMultiSelect, maxHeight: '130px', minWidth: '160px' }}>
              {statuses.map(status => (
                <div
                  key={status.id}
                  onClick={() => handleStatusToggle(status.id)}
                  style={{
                    ...styles.statusListItem,
                    padding: '4px 8px',
                    ...(tempFilters.status_ids.includes(status.id) ? styles.statusListItemSelected : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.statusColorDot,
                      backgroundColor: status.color || '#888',
                    }}
                  />
                  <span>{status.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{
        ...styles.tableContainer,
        opacity: (loading && !initialLoading) ? 0.6 : 1,
        transition: 'opacity 0.2s ease',
      }}>
        {loading && initialLoading ? (
          <div style={styles.loading}>Lade Daten...</div>
        ) : items.length === 0 ? (
          <div style={styles.noData}>Keine Einträge gefunden</div>
        ) : filteredItems.length === 0 ? (
          <div style={styles.noData}>Keine Einträge entsprechen dem Filter (Spaltenfilter zurücksetzen)</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th} onClick={() => handleSort('name')}>
                  {numberFieldLabel}{getSortIcon('name')}
                </th>
                <th style={styles.th} onClick={() => handleSort('reference')}>
                  Referenz{getSortIcon('reference')}
                </th>
                <th style={styles.th} onClick={() => handleSort('kunde_name')}>
                  Kunde{getSortIcon('kunde_name')}
                </th>
                <th style={styles.th}>Text</th>
                <th style={styles.th}>Notiz</th>
                <th style={styles.th} onClick={() => handleSort('date1')}>
                  Kunden Liefertermin{getSortIcon('date1')}
                </th>
                <th style={styles.th} onClick={() => handleSort('date2')}>
                  H+G Liefertermin{getSortIcon('date2')}
                </th>
                <th style={styles.th} onClick={() => handleSort('created')}>
                  Erstell-Datum{getSortIcon('created')}
                </th>
                <th style={styles.th} onClick={() => handleSort('price')}>
                  Preis{getSortIcon('price')}
                </th>
                <th style={styles.th} onClick={() => handleSort('status_name')}>
                  Status{getSortIcon('status_name')}
                </th>
              </tr>
              {/* Autofilter row */}
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.name}
                    onChange={e => handleColumnFilterChange('name', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.reference}
                    onChange={e => handleColumnFilterChange('reference', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.kunde_name}
                    onChange={e => handleColumnFilterChange('kunde_name', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.text}
                    onChange={e => handleColumnFilterChange('text', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.notiz}
                    onChange={e => handleColumnFilterChange('notiz', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.date1}
                    onChange={e => handleColumnFilterChange('date1', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.date2}
                    onChange={e => handleColumnFilterChange('date2', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.created}
                    onChange={e => handleColumnFilterChange('created', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.price}
                    onChange={e => handleColumnFilterChange('price', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={columnFilters.status_name}
                    onChange={e => handleColumnFilterChange('status_name', e.target.value)}
                    style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '3px' }}
                    onClick={e => e.stopPropagation()}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr
                  key={item.id}
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={hoveredRow === item.id ? styles.rowHover : undefined}
                >
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>{item.reference || '-'}</td>
                  <td style={styles.td}>{item.kunde_name || '-'}</td>
                  <td style={{ ...styles.td, ...styles.tdText }} title={item.text || ''}>
                    {item.text || '-'}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdText }} title={item.notiz || ''}>
                    {item.notiz || '-'}
                  </td>
                  <td style={styles.td}>{formatDate(item.date1)}</td>
                  <td style={styles.td}>{formatDate(item.date2)}</td>
                  <td style={styles.td}>{formatDate(item.created)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatPrice(item.price)}</td>
                  <td style={styles.td}>
                    {item.status_name ? (
                      <span
                        style={{
                          ...styles.statusBadge,
                          backgroundColor: item.status_color || '#888',
                          color: 'white',
                        }}
                      >
                        {item.status_name}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div style={styles.pagination}>
        <div style={styles.paginationInfo}>
          {filteredItems.length !== items.length 
            ? `${filteredItems.length} von ${items.length} (gefiltert) | `
            : `${total} Einträge | `}
          Seite {filters.page} von {totalPages}
          {loading && !initialLoading && <span style={{ marginLeft: '10px', color: '#4a90d9' }}>Lade...</span>}
        </div>
        <div style={styles.paginationButtons}>
          <button
            style={{
              ...styles.paginationButton,
              ...(filters.page <= 1 ? styles.paginationButtonDisabled : {}),
            }}
            onClick={() => handlePageChange(filters.page! - 1)}
            disabled={filters.page! <= 1}
          >
            ← Zurück
          </button>
          <button
            style={{
              ...styles.paginationButton,
              ...(filters.page! >= totalPages ? styles.paginationButtonDisabled : {}),
            }}
            onClick={() => handlePageChange(filters.page! + 1)}
            disabled={filters.page! >= totalPages}
          >
            Weiter →
          </button>
        </div>
      </div>
    </div>
  )
}
