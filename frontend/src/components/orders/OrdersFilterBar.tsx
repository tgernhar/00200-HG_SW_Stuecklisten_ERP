/**
 * Orders Filter Bar Component
 * Filter controls for the orders overview
 */
import React, { useState, useEffect, useRef } from 'react'
import api from '../../services/api'

export interface StatusOption {
  id: number
  name: string
  is_default: boolean
}

export interface FilterValues {
  dateFrom: string
  dateTo: string
  responsible: string
  customer: string
  orderName: string
  text: string
  reference: string
  statusIds: number[]
  articleSearch: string    // Deep-Filter: Suche in Artikelnummern/Bezeichnungen
  workstepSearch: string   // Deep-Filter: Suche in Arbeitsgängen
}

interface OrdersFilterBarProps {
  filters: FilterValues
  onFilterChange: (filters: FilterValues) => void
  onFilter: () => void
  onClear: () => void
  loading: boolean
}

const styles = {
  container: {
    display: 'flex',
    gap: '10px',
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
    fontSize: '11px',
    color: '#666666',
    fontFamily: 'Arial, sans-serif'
  },
  filterInput: {
    padding: '5px 8px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    width: '120px'
  },
  filterInputWide: {
    padding: '5px 8px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    width: '100px'
  },
  button: {
    padding: '5px 12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    height: '28px'
  },
  buttonPrimary: {
    padding: '5px 12px',
    backgroundColor: '#4a90d9',
    color: 'white',
    border: '1px solid #3a80c9',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    height: '28px'
  },
  statusDropdown: {
    position: 'relative' as const,
    display: 'inline-block'
  },
  statusButton: {
    padding: '5px 8px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    minWidth: '100px',
    height: '28px'
  },
  statusDropdownMenu: {
    position: 'absolute' as const,
    top: '100%',
    left: '0',
    backgroundColor: 'white',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 1000,
    minWidth: '180px',
    maxHeight: '250px',
    overflowY: 'auto' as const
  },
  statusOption: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '12px',
    gap: '6px'
  },
  statusOptionHover: {
    backgroundColor: '#f5f5f5'
  },
  statusActions: {
    display: 'flex',
    gap: '5px',
    padding: '6px 10px',
    borderBottom: '1px solid #eee'
  },
  statusActionBtn: {
    fontSize: '10px',
    color: '#4a90d9',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  deepFilterSection: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    marginLeft: '10px',
    paddingLeft: '10px',
    borderLeft: '2px solid #e0e0e0'
  },
  deepFilterInput: {
    padding: '5px 8px',
    border: '1px solid #9fc5e8',
    borderRadius: '3px',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    width: '120px',
    backgroundColor: '#f0f7ff'
  },
  deepFilterLabel: {
    fontSize: '11px',
    color: '#4a90d9',
    fontFamily: 'Arial, sans-serif'
  }
}

export default function OrdersFilterBar({
  filters,
  onFilterChange,
  onFilter,
  onClear,
  loading
}: OrdersFilterBarProps) {
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load status options on mount
  useEffect(() => {
    const loadStatusOptions = async () => {
      try {
        const response = await api.get('/orders/status-options')
        const options: StatusOption[] = response.data.items || []
        setStatusOptions(options)
        
        // Initialize with default status IDs if not already set
        if (filters.statusIds.length === 0) {
          const defaultIds = options.filter(o => o.is_default).map(o => o.id)
          onFilterChange({ ...filters, statusIds: defaultIds })
        }
      } catch (err) {
        console.error('Error loading status options:', err)
      }
    }
    loadStatusOptions()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (field: keyof FilterValues, value: string) => {
    onFilterChange({ ...filters, [field]: value })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFilter()
    }
  }

  const toggleStatus = (statusId: number) => {
    const newStatusIds = filters.statusIds.includes(statusId)
      ? filters.statusIds.filter(id => id !== statusId)
      : [...filters.statusIds, statusId]
    onFilterChange({ ...filters, statusIds: newStatusIds })
  }

  const selectAllStatuses = () => {
    onFilterChange({ ...filters, statusIds: statusOptions.map(o => o.id) })
  }

  const selectDefaultStatuses = () => {
    onFilterChange({ ...filters, statusIds: statusOptions.filter(o => o.is_default).map(o => o.id) })
  }

  const selectedCount = filters.statusIds.length
  const statusButtonText = selectedCount === 0 
    ? 'Alle' 
    : selectedCount === statusOptions.length 
      ? 'Alle' 
      : `${selectedCount} ausgewählt`

  return (
    <div style={styles.container}>
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Auftragsnummer:</label>
        <input
          type="text"
          value={filters.orderName}
          onChange={(e) => handleChange('orderName', e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="z.B. AU-2024"
          style={styles.filterInputWide}
        />
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Kunde:</label>
        <input
          type="text"
          value={filters.customer}
          onChange={(e) => handleChange('customer', e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Suchname"
          style={styles.filterInputWide}
        />
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Text:</label>
        <input
          type="text"
          value={filters.text}
          onChange={(e) => handleChange('text', e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Auftragstext"
          style={styles.filterInputWide}
        />
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Referenz:</label>
        <input
          type="text"
          value={filters.reference}
          onChange={(e) => handleChange('reference', e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Referenz"
          style={styles.filterInputWide}
        />
      </div>

      {/* Status Multi-Select Dropdown */}
      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Status:</label>
        <div style={styles.statusDropdown} ref={dropdownRef}>
          <button
            type="button"
            style={styles.statusButton}
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
          >
            <span>{statusButtonText}</span>
            <span style={{ marginLeft: 'auto' }}>{statusDropdownOpen ? '▲' : '▼'}</span>
          </button>
          
          {statusDropdownOpen && (
            <div style={styles.statusDropdownMenu}>
              <div style={styles.statusActions}>
                <span style={styles.statusActionBtn} onClick={selectAllStatuses}>Alle</span>
                <span style={styles.statusActionBtn} onClick={selectDefaultStatuses}>Standard</span>
                <span style={styles.statusActionBtn} onClick={() => onFilterChange({ ...filters, statusIds: [] })}>Keine</span>
              </div>
              {statusOptions.map(option => (
                <div
                  key={option.id}
                  style={styles.statusOption}
                  onClick={() => toggleStatus(option.id)}
                >
                  <input
                    type="checkbox"
                    checked={filters.statusIds.includes(option.id)}
                    onChange={() => {}}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{option.name}</span>
                  {option.is_default && <span style={{ fontSize: '9px', color: '#999' }}>(Standard)</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>LT-HG von:</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handleChange('dateFrom', e.target.value)}
          style={styles.filterInputWide}
        />
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>LT-HG bis:</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handleChange('dateTo', e.target.value)}
          style={styles.filterInputWide}
        />
      </div>

      <div style={styles.filterGroup}>
        <label style={styles.filterLabel}>Verantwortlich:</label>
        <input
          type="text"
          value={filters.responsible}
          onChange={(e) => handleChange('responsible', e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="z.B. TG30"
          style={{ ...styles.filterInputWide, width: '80px' }}
        />
      </div>

      {/* Deep Filter Section */}
      <div style={styles.deepFilterSection}>
        <div style={styles.filterGroup}>
          <label style={styles.deepFilterLabel}>Artikel (Deep):</label>
          <input
            type="text"
            value={filters.articleSearch}
            onChange={(e) => handleChange('articleSearch', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Art.-Nr./Bez."
            style={styles.deepFilterInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.deepFilterLabel}>Arbeitsgang:</label>
          <input
            type="text"
            value={filters.workstepSearch}
            onChange={(e) => handleChange('workstepSearch', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Arbeitsgang"
            style={styles.deepFilterInput}
          />
        </div>
      </div>

      <button
        style={styles.buttonPrimary}
        onClick={onFilter}
        disabled={loading}
      >
        {loading ? 'Lade...' : 'Filtern'}
      </button>

      <button
        style={styles.button}
        onClick={onClear}
        disabled={loading}
      >
        Löschen
      </button>
    </div>
  )
}
