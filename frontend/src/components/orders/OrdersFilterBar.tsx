/**
 * Orders Filter Bar Component
 * Filter controls for the orders overview
 */
import React from 'react'

interface FilterValues {
  dateFrom: string
  dateTo: string
  responsible: string
  customer: string
  orderName: string
  text: string
  reference: string
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
  }
}

export default function OrdersFilterBar({
  filters,
  onFilterChange,
  onFilter,
  onClear,
  loading
}: OrdersFilterBarProps) {
  const handleChange = (field: keyof FilterValues, value: string) => {
    onFilterChange({ ...filters, [field]: value })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFilter()
    }
  }

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
