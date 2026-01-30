/**
 * AdressenDataTable Component
 * Search and list component for addresses from HUGWAWI.
 * Features toggle buttons for switching between search groups (Kunde/Kontakt/Adresszeile).
 */
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  searchAddresses,
  getContactTypes,
  AddressItem,
  AddressFilters,
  ContactType,
  SearchGroup
} from '../../services/adressenApi'

interface AdressenDataTableProps {
  pageTitle: string
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
  toggleButtonGroup: {
    display: 'flex',
    gap: '4px',
    marginBottom: '12px',
  },
  toggleButton: {
    padding: '8px 16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: '#f0f0f0',
    color: '#333',
    transition: 'all 0.2s ease',
  },
  toggleButtonActive: {
    backgroundColor: '#4a90d9',
    color: 'white',
    borderColor: '#4a90d9',
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
    padding: '5px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    minWidth: '120px',
    height: '26px',
  },
  filterSelect: {
    padding: '5px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    minWidth: '150px',
    height: '30px',
  },
  filterCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    cursor: 'pointer',
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
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#666',
  },
  initialMessage: {
    textAlign: 'center',
    padding: '60px 40px',
    color: '#666',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    margin: '20px',
  },
  warningMessage: {
    textAlign: 'center',
    padding: '20px',
    color: '#856404',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeeba',
    borderRadius: '4px',
    margin: '10px 20px',
  },
  rowHover: {
    backgroundColor: '#f5f9ff',
  },
  rowClickable: {
    cursor: 'pointer',
  },
  autofilterInput: {
    width: '100%',
    padding: '4px',
    fontSize: '11px',
    border: '1px solid #ccc',
    borderRadius: '3px',
  },
  checkboxCell: {
    textAlign: 'center',
  },
}

export default function AdressenDataTable({ pageTitle }: AdressenDataTableProps) {
  const navigate = useNavigate()

  // Active search group
  const [activeGroup, setActiveGroup] = useState<SearchGroup>('kunde')

  // Contact types for dropdown
  const [contactTypes, setContactTypes] = useState<ContactType[]>([])

  // Search results
  const [items, setItems] = useState<AddressItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchExecuted, setSearchExecuted] = useState(false)
  const [showEmptyFilterWarning, setShowEmptyFilterWarning] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  // Kunde group filters
  const [kundeFilters, setKundeFilters] = useState({
    suchname: '',
    kdn: '',
    currency: '',
    is_customer: false,
    is_salesprospect: false,
    is_distributor: false,
    is_reminderstop: false,
    is_employee: false,
    is_concern: false,
  })

  // Kontakt group filters
  const [kontaktFilters, setKontaktFilters] = useState({
    contact_name: '',
    phone: '',
    email: '',
    contact_type_id: 0,
    function: '',
  })

  // Adresszeile group filters
  const [adresszeileFilters, setAdresszeileFilters] = useState({
    address: '',
    tax_number: '',
    sales_tax_id: '',
    iban: '',
  })

  // Pagination and sorting
  const [page, setPage] = useState(1)
  const [pageSize] = useState(500)
  const [sortField, setSortField] = useState('suchname')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Column autofilters
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    kdn: '',
    suchname: '',
    url: '',
    comment: '',
    currency: '',
  })

  const loadRequestRef = useRef(0)

  // Load contact types on mount
  useEffect(() => {
    loadContactTypes()
  }, [])

  const loadContactTypes = async () => {
    try {
      const types = await getContactTypes()
      setContactTypes(types)
    } catch (error) {
      console.error('Error loading contact types:', error)
    }
  }

  // Check if any search filter is filled
  const hasSearchFilters = useCallback(() => {
    if (activeGroup === 'kunde') {
      return !!(
        kundeFilters.suchname ||
        kundeFilters.kdn ||
        kundeFilters.currency ||
        kundeFilters.is_customer ||
        kundeFilters.is_salesprospect ||
        kundeFilters.is_distributor ||
        kundeFilters.is_reminderstop ||
        kundeFilters.is_employee ||
        kundeFilters.is_concern
      )
    } else if (activeGroup === 'kontakt') {
      return !!(
        kontaktFilters.contact_name ||
        kontaktFilters.phone ||
        kontaktFilters.email ||
        kontaktFilters.contact_type_id ||
        kontaktFilters.function
      )
    } else {
      return !!(
        adresszeileFilters.address ||
        adresszeileFilters.tax_number ||
        adresszeileFilters.sales_tax_id ||
        adresszeileFilters.iban
      )
    }
  }, [activeGroup, kundeFilters, kontaktFilters, adresszeileFilters])

  // Load data
  const loadData = useCallback(async () => {
    const currentRequest = ++loadRequestRef.current
    setLoading(true)

    try {
      const filters: AddressFilters = {
        search_group: activeGroup,
        page,
        page_size: pageSize,
        sort_field: sortField,
        sort_dir: sortDir,
      }

      // Add active group filters
      if (activeGroup === 'kunde') {
        if (kundeFilters.suchname) filters.suchname = kundeFilters.suchname
        if (kundeFilters.kdn) filters.kdn = kundeFilters.kdn
        if (kundeFilters.currency) filters.currency = kundeFilters.currency
        if (kundeFilters.is_customer) filters.is_customer = true
        if (kundeFilters.is_salesprospect) filters.is_salesprospect = true
        if (kundeFilters.is_distributor) filters.is_distributor = true
        if (kundeFilters.is_reminderstop) filters.is_reminderstop = true
        if (kundeFilters.is_employee) filters.is_employee = true
        if (kundeFilters.is_concern) filters.is_concern = true
      } else if (activeGroup === 'kontakt') {
        if (kontaktFilters.contact_name) filters.contact_name = kontaktFilters.contact_name
        if (kontaktFilters.phone) filters.phone = kontaktFilters.phone
        if (kontaktFilters.email) filters.email = kontaktFilters.email
        if (kontaktFilters.contact_type_id) filters.contact_type_id = kontaktFilters.contact_type_id
        if (kontaktFilters.function) filters.function = kontaktFilters.function
      } else {
        if (adresszeileFilters.address) filters.address = adresszeileFilters.address
        if (adresszeileFilters.tax_number) filters.tax_number = adresszeileFilters.tax_number
        if (adresszeileFilters.sales_tax_id) filters.sales_tax_id = adresszeileFilters.sales_tax_id
        if (adresszeileFilters.iban) filters.iban = adresszeileFilters.iban
      }

      const response = await searchAddresses(filters)
      if (currentRequest !== loadRequestRef.current) return

      setItems(response.items)
      setTotal(response.total)
      setTotalPages(response.total_pages)
    } catch (error) {
      if (currentRequest !== loadRequestRef.current) return
      console.error('Error loading data:', error)
      setItems([])
      setTotal(0)
    } finally {
      if (currentRequest === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }, [activeGroup, kundeFilters, kontaktFilters, adresszeileFilters, page, pageSize, sortField, sortDir])

  // Search handler
  const handleSearch = () => {
    if (!hasSearchFilters()) {
      setShowEmptyFilterWarning(true)
      return
    }
    setShowEmptyFilterWarning(false)
    setSearchExecuted(true)
    setPage(1)
    loadData()
  }

  // Reset handler
  const handleReset = () => {
    setShowEmptyFilterWarning(false)
    setSearchExecuted(false)
    setKundeFilters({
      suchname: '',
      kdn: '',
      currency: '',
      is_customer: false,
      is_salesprospect: false,
      is_distributor: false,
      is_reminderstop: false,
      is_employee: false,
      is_concern: false,
    })
    setKontaktFilters({
      contact_name: '',
      phone: '',
      email: '',
      contact_type_id: 0,
      function: '',
    })
    setAdresszeileFilters({
      address: '',
      tax_number: '',
      sales_tax_id: '',
      iban: '',
    })
    setColumnFilters({
      kdn: '',
      suchname: '',
      url: '',
      comment: '',
      currency: '',
    })
    setItems([])
    setTotal(0)
    setTotalPages(1)
    setPage(1)
  }

  // Sort handler
  const handleSort = (field: string) => {
    if (!searchExecuted) return
    const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc'
    setSortField(field)
    setSortDir(newDir)
    // Note: useEffect would need to be added to trigger loadData on sort change
  }

  // Reload on sort change
  useEffect(() => {
    if (searchExecuted) {
      loadData()
    }
  }, [sortField, sortDir])

  // Key handler for Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Column filter handler
  const handleColumnFilterChange = (field: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [field]: value }))
  }

  // Filtered items based on column autofilters
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      for (const [key, filterValue] of Object.entries(columnFilters)) {
        if (!filterValue) continue
        const searchTerm = filterValue.toLowerCase()
        let itemValue = ''
        
        switch (key) {
          case 'kdn':
            itemValue = item.kdn || ''
            break
          case 'suchname':
            itemValue = item.suchname || ''
            break
          case 'url':
            itemValue = item.url || ''
            break
          case 'comment':
            itemValue = item.comment || ''
            break
          case 'currency':
            itemValue = item.currency || ''
            break
        }
        
        if (!itemValue.toLowerCase().includes(searchTerm)) {
          return false
        }
      }
      return true
    })
  }, [items, columnFilters])

  // Get sort icon
  const getSortIcon = (field: string) => {
    if (!searchExecuted) return ''
    if (sortField !== field) return ' ⇅'
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  // Row click handler - navigate to detail page
  const handleRowClick = (item: AddressItem) => {
    navigate(`/menu/adressen/${item.id}`)
  }

  // Render toggle buttons
  const renderToggleButtons = () => (
    <div style={styles.toggleButtonGroup}>
      <button
        style={{
          ...styles.toggleButton,
          ...(activeGroup === 'kunde' ? styles.toggleButtonActive : {})
        }}
        onClick={() => setActiveGroup('kunde')}
      >
        Kunde
      </button>
      <button
        style={{
          ...styles.toggleButton,
          ...(activeGroup === 'kontakt' ? styles.toggleButtonActive : {})
        }}
        onClick={() => setActiveGroup('kontakt')}
      >
        Kontakt
      </button>
      <button
        style={{
          ...styles.toggleButton,
          ...(activeGroup === 'adresszeile' ? styles.toggleButtonActive : {})
        }}
        onClick={() => setActiveGroup('adresszeile')}
      >
        Adresszeile
      </button>
    </div>
  )

  // Render Kunde filters
  const renderKundeFilters = () => (
    <>
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Suchname</label>
          <input
            type="text"
            style={{ ...styles.filterInput, width: '180px' }}
            value={kundeFilters.suchname}
            onChange={e => setKundeFilters(prev => ({ ...prev, suchname: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>KDNr</label>
          <input
            type="text"
            style={{ ...styles.filterInput, width: '100px' }}
            value={kundeFilters.kdn}
            onChange={e => setKundeFilters(prev => ({ ...prev, kdn: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Währung</label>
          <input
            type="text"
            style={{ ...styles.filterInput, width: '60px', minWidth: '60px' }}
            value={kundeFilters.currency}
            onChange={e => setKundeFilters(prev => ({ ...prev, currency: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
      <div style={styles.filterRow}>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={kundeFilters.is_customer}
            onChange={e => setKundeFilters(prev => ({ ...prev, is_customer: e.target.checked }))}
          />
          Kunde
        </label>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={kundeFilters.is_salesprospect}
            onChange={e => setKundeFilters(prev => ({ ...prev, is_salesprospect: e.target.checked }))}
          />
          Interessent
        </label>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={kundeFilters.is_distributor}
            onChange={e => setKundeFilters(prev => ({ ...prev, is_distributor: e.target.checked }))}
          />
          Lieferant
        </label>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={kundeFilters.is_reminderstop}
            onChange={e => setKundeFilters(prev => ({ ...prev, is_reminderstop: e.target.checked }))}
          />
          Mahnstop
        </label>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={kundeFilters.is_employee}
            onChange={e => setKundeFilters(prev => ({ ...prev, is_employee: e.target.checked }))}
          />
          Mitarbeiter
        </label>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={kundeFilters.is_concern}
            onChange={e => setKundeFilters(prev => ({ ...prev, is_concern: e.target.checked }))}
          />
          Suchen im Konzern
        </label>
      </div>
    </>
  )

  // Render Kontakt filters
  const renderKontaktFilters = () => (
    <div style={styles.filterRow}>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Name</label>
        <input
          type="text"
          style={{ ...styles.filterInput, width: '180px' }}
          value={kontaktFilters.contact_name}
          onChange={e => setKontaktFilters(prev => ({ ...prev, contact_name: e.target.value }))}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Telefon</label>
        <input
          type="text"
          style={{ ...styles.filterInput, width: '140px' }}
          value={kontaktFilters.phone}
          onChange={e => setKontaktFilters(prev => ({ ...prev, phone: e.target.value }))}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Email</label>
        <input
          type="text"
          style={{ ...styles.filterInput, width: '200px' }}
          value={kontaktFilters.email}
          onChange={e => setKontaktFilters(prev => ({ ...prev, email: e.target.value }))}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Typ</label>
        <select
          style={styles.filterSelect}
          value={kontaktFilters.contact_type_id}
          onChange={e => setKontaktFilters(prev => ({ ...prev, contact_type_id: parseInt(e.target.value) || 0 }))}
        >
          <option value={0}>-- Alle --</option>
          {contactTypes.map(type => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </select>
      </div>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Funktion</label>
        <input
          type="text"
          style={{ ...styles.filterInput, width: '140px' }}
          value={kontaktFilters.function}
          onChange={e => setKontaktFilters(prev => ({ ...prev, function: e.target.value }))}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )

  // Render Adresszeile filters
  const renderAdresszeileFilters = () => (
    <div style={styles.filterRow}>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Adresse</label>
        <input
          type="text"
          style={{ ...styles.filterInput, width: '250px' }}
          value={adresszeileFilters.address}
          onChange={e => setAdresszeileFilters(prev => ({ ...prev, address: e.target.value }))}
          onKeyDown={handleKeyDown}
          placeholder="line1-4, street"
        />
      </div>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>SteuerNr</label>
        <input
          type="text"
          style={{ ...styles.filterInput, width: '140px' }}
          value={adresszeileFilters.tax_number}
          onChange={e => setAdresszeileFilters(prev => ({ ...prev, tax_number: e.target.value }))}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Ust-Id</label>
        <input
          type="text"
          style={{ ...styles.filterInput, width: '140px' }}
          value={adresszeileFilters.sales_tax_id}
          onChange={e => setAdresszeileFilters(prev => ({ ...prev, sales_tax_id: e.target.value }))}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>IBAN</label>
        <input
          type="text"
          style={{ ...styles.filterInput, width: '200px' }}
          value={adresszeileFilters.iban}
          onChange={e => setAdresszeileFilters(prev => ({ ...prev, iban: e.target.value }))}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )

  // Render table
  const renderTable = () => (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th} onClick={() => handleSort('kdn')}>
            KDN{getSortIcon('kdn')}
          </th>
          <th style={styles.th} onClick={() => handleSort('suchname')}>
            Suchname{getSortIcon('suchname')}
          </th>
          <th style={styles.th} onClick={() => handleSort('url')}>
            URL{getSortIcon('url')}
          </th>
          <th style={styles.th} onClick={() => handleSort('comment')}>
            Kommentar{getSortIcon('comment')}
          </th>
          <th style={styles.th} onClick={() => handleSort('currency')}>
            Währung{getSortIcon('currency')}
          </th>
          <th style={styles.th} onClick={() => handleSort('customer')}>
            Kunde{getSortIcon('customer')}
          </th>
          <th style={styles.th} onClick={() => handleSort('distributor')}>
            Lieferant{getSortIcon('distributor')}
          </th>
          <th style={styles.th} onClick={() => handleSort('salesprospect')}>
            Interessent{getSortIcon('salesprospect')}
          </th>
          <th style={styles.th} onClick={() => handleSort('reminderstop')}>
            Mahnstop{getSortIcon('reminderstop')}
          </th>
          <th style={styles.th} onClick={() => handleSort('zahlziel')}>
            Zahlziel{getSortIcon('zahlziel')}
          </th>
          <th style={styles.th} onClick={() => handleSort('concern')}>
            Konzern{getSortIcon('concern')}
          </th>
          <th style={styles.th} onClick={() => handleSort('blocked')}>
            Geblockt{getSortIcon('blocked')}
          </th>
        </tr>
        {/* Autofilter row */}
        <tr style={{ backgroundColor: '#f0f0f0' }}>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={columnFilters.kdn}
              onChange={e => handleColumnFilterChange('kdn', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={columnFilters.suchname}
              onChange={e => handleColumnFilterChange('suchname', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={columnFilters.url}
              onChange={e => handleColumnFilterChange('url', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={columnFilters.comment}
              onChange={e => handleColumnFilterChange('comment', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={columnFilters.currency}
              onChange={e => handleColumnFilterChange('currency', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}></th>
          <th style={{ padding: '4px 6px' }}></th>
          <th style={{ padding: '4px 6px' }}></th>
          <th style={{ padding: '4px 6px' }}></th>
          <th style={{ padding: '4px 6px' }}></th>
          <th style={{ padding: '4px 6px' }}></th>
          <th style={{ padding: '4px 6px' }}></th>
        </tr>
      </thead>
      <tbody>
        {filteredItems.length === 0 ? (
          <tr>
            <td colSpan={12} style={{ ...styles.td, textAlign: 'center', color: '#999', padding: '40px' }}>
              {items.length === 0 ? 'Keine Einträge gefunden' : 'Keine Einträge entsprechen dem Spaltenfilter'}
            </td>
          </tr>
        ) : (
          filteredItems.map(item => (
            <tr
              key={item.id}
              onMouseEnter={() => setHoveredRow(item.id)}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => handleRowClick(item)}
              style={{
                ...(hoveredRow === item.id ? styles.rowHover : {}),
                ...styles.rowClickable,
              }}
            >
              <td style={styles.td}>{item.kdn || '-'}</td>
              <td style={styles.td}>{item.suchname || '-'}</td>
              <td style={{ ...styles.td, ...styles.tdText }} title={item.url || ''}>
                {item.url || '-'}
              </td>
              <td style={{ ...styles.td, ...styles.tdText }} title={item.comment || ''}>
                {item.comment || '-'}
              </td>
              <td style={styles.td}>{item.currency || '-'}</td>
              <td style={{ ...styles.td, ...styles.checkboxCell }}>
                <input type="checkbox" checked={item.customer === 1} disabled />
              </td>
              <td style={{ ...styles.td, ...styles.checkboxCell }}>
                <input type="checkbox" checked={item.distributor === 1} disabled />
              </td>
              <td style={{ ...styles.td, ...styles.checkboxCell }}>
                <input type="checkbox" checked={item.salesprospect === 1} disabled />
              </td>
              <td style={{ ...styles.td, ...styles.checkboxCell }}>
                <input type="checkbox" checked={item.reminderstop === 1} disabled />
              </td>
              <td style={styles.td}>{item.zahlziel != null ? `${item.zahlziel} Tage` : '-'}</td>
              <td style={{ ...styles.td, ...styles.checkboxCell }}>
                <input type="checkbox" checked={item.concern != null && item.concern > 0} disabled />
              </td>
              <td style={{ ...styles.td, ...styles.checkboxCell }}>
                <input type="checkbox" checked={item.blocked === 1} disabled />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  // Render initial message
  const renderInitialMessage = () => (
    <div style={styles.initialMessage}>
      <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
        Adressen-Suche
      </h3>
      <p style={{ margin: 0 }}>
        Bitte wählen Sie eine Suchgruppe, geben Sie mindestens ein Suchkriterium ein und klicken Sie auf "Suchen".
      </p>
    </div>
  )

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{pageTitle}</h1>
      </div>

      {/* Filter Section */}
      <div style={styles.filterSection}>
        {/* Toggle Buttons */}
        {renderToggleButtons()}

        {/* Active group filters */}
        {activeGroup === 'kunde' && renderKundeFilters()}
        {activeGroup === 'kontakt' && renderKontaktFilters()}
        {activeGroup === 'adresszeile' && renderAdresszeileFilters()}

        {/* Search/Reset buttons */}
        <div style={{ ...styles.filterRow, marginTop: '8px' }}>
          <button style={styles.filterButton} onClick={handleSearch}>
            Suchen
          </button>
          <button style={styles.filterButtonSecondary} onClick={handleReset}>
            Leeren
          </button>
        </div>
      </div>

      {/* Warning message for empty filters */}
      {showEmptyFilterWarning && (
        <div style={styles.warningMessage}>
          Bitte geben Sie mindestens ein Suchkriterium ein, bevor Sie die Suche starten.
        </div>
      )}

      {/* Table */}
      <div style={{
        ...styles.tableContainer,
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.2s ease',
      }}>
        {loading ? (
          <div style={styles.loading}>Lade Daten...</div>
        ) : !searchExecuted ? (
          renderInitialMessage()
        ) : (
          renderTable()
        )}
      </div>

      {/* Status Bar */}
      <div style={styles.pagination}>
        <div style={styles.paginationInfo}>
          {searchExecuted ? (
            <>
              {filteredItems.length !== items.length 
                ? `${filteredItems.length} von ${items.length} Einträgen angezeigt (Spaltenfilter aktiv)`
                : `${items.length} Einträge gefunden`}
            </>
          ) : (
            'Bitte Suchgruppe wählen, Suchkriterien eingeben und "Suchen" klicken'
          )}
          {loading && <span style={{ marginLeft: '10px', color: '#4a90d9' }}>Lade...</span>}
        </div>
      </div>
    </div>
  )
}
