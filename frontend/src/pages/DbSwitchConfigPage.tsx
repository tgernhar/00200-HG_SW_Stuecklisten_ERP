/**
 * Database Switch Configuration Page
 * 
 * Admin page for managing the HUGWAWI table registry.
 * Allows viewing and editing:
 * - Which tables are used for reading
 * - Remarks/notes for each table
 * - Write permissions (allow_write_production)
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useDatabase } from '../contexts/DatabaseContext'
import { 
  getTableRegistry, 
  updateTableRegistryEntry,
  TableRegistryItem,
  TableRegistryResponse 
} from '../services/dbSwitchApi'

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '20px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: '#333',
    marginBottom: '10px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '20px'
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '12px 16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px'
  },
  statusLabel: {
    fontWeight: 500,
    color: '#666'
  },
  statusValue: {
    fontWeight: 'bold' as const,
    color: '#333'
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold' as const
  },
  statusLive: {
    backgroundColor: '#28a745',
    color: '#fff'
  },
  statusTest: {
    backgroundColor: '#dc3545',
    color: '#fff'
  },
  searchBar: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    maxWidth: '400px'
  },
  filterSelect: {
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#fff'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px'
  },
  th: {
    padding: '12px 10px',
    backgroundColor: '#f0f0f0',
    borderBottom: '2px solid #ccc',
    textAlign: 'left' as const,
    fontWeight: 'bold' as const,
    color: '#333',
    position: 'sticky' as const,
    top: 0
  },
  td: {
    padding: '10px',
    borderBottom: '1px solid #eee',
    verticalAlign: 'middle' as const
  },
  tdCenter: {
    padding: '10px',
    borderBottom: '1px solid #eee',
    verticalAlign: 'middle' as const,
    textAlign: 'center' as const
  },
  rowEven: {
    backgroundColor: '#fafafa'
  },
  rowOdd: {
    backgroundColor: '#ffffff'
  },
  usedBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 'bold' as const
  },
  usedYes: {
    backgroundColor: '#d4edda',
    color: '#155724'
  },
  usedNo: {
    backgroundColor: '#f8f9fa',
    color: '#6c757d'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  remarksInput: {
    width: '100%',
    padding: '6px 10px',
    fontSize: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fff'
  },
  saveButton: {
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: '#4a90d9',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '8px'
  },
  loadingOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  loadingText: {
    fontSize: '16px',
    color: '#666'
  },
  tableWrapper: {
    maxHeight: 'calc(100vh - 300px)',
    overflowY: 'auto' as const,
    border: '1px solid #ddd',
    borderRadius: '4px'
  },
  warningBox: {
    padding: '12px 16px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    marginBottom: '20px',
    fontSize: '13px',
    color: '#856404'
  },
  statsRow: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px'
  },
  statBox: {
    padding: '12px 20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #dee2e6'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: '#333'
  },
  statLabel: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px'
  }
}

export default function DbSwitchConfigPage() {
  const { isTestMode, isFeatureEnabled, currentHost } = useDatabase()
  const [tables, setTables] = useState<TableRegistryItem[]>([])
  const [filteredTables, setFilteredTables] = useState<TableRegistryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterUsed, setFilterUsed] = useState<'all' | 'used' | 'unused'>('all')
  const [editingRemarks, setEditingRemarks] = useState<{ [key: string]: string }>({})
  const [savingTable, setSavingTable] = useState<string | null>(null)

  // Load table registry
  const loadTables = useCallback(async () => {
    setIsLoading(true)
    try {
      const response: TableRegistryResponse = await getTableRegistry()
      setTables(response.items)
      setFilteredTables(response.items)
    } catch (error) {
      console.error('Failed to load table registry:', error)
      alert('Fehler beim Laden der Tabellen-Registry')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  // Filter tables
  useEffect(() => {
    let filtered = tables

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(t => 
        t.table_name.toLowerCase().includes(term) ||
        (t.remarks && t.remarks.toLowerCase().includes(term))
      )
    }

    // Filter by usage
    if (filterUsed === 'used') {
      filtered = filtered.filter(t => t.is_used_read)
    } else if (filterUsed === 'unused') {
      filtered = filtered.filter(t => !t.is_used_read)
    }

    setFilteredTables(filtered)
  }, [tables, searchTerm, filterUsed])

  // Handle remarks change
  const handleRemarksChange = (tableName: string, value: string) => {
    setEditingRemarks(prev => ({ ...prev, [tableName]: value }))
  }

  // Save remarks
  const handleSaveRemarks = async (tableName: string) => {
    const remarks = editingRemarks[tableName]
    if (remarks === undefined) return

    setSavingTable(tableName)
    try {
      await updateTableRegistryEntry(tableName, { remarks })
      // Update local state
      setTables(prev => prev.map(t => 
        t.table_name === tableName ? { ...t, remarks } : t
      ))
      // Clear editing state
      setEditingRemarks(prev => {
        const next = { ...prev }
        delete next[tableName]
        return next
      })
    } catch (error) {
      console.error('Failed to save remarks:', error)
      alert('Fehler beim Speichern der Bemerkung')
    } finally {
      setSavingTable(null)
    }
  }

  // Toggle write permission
  const handleToggleWritePermission = async (tableName: string, currentValue: boolean) => {
    if (!isTestMode) {
      alert('Schreibberechtigungen können nur im Test-Modus geändert werden.')
      return
    }

    const newValue = !currentValue
    const confirmMessage = newValue
      ? `WARNUNG: Schreibberechtigung für "${tableName}" aktivieren?\n\nDies erlaubt Schreiboperationen in der Test-Datenbank für diese Tabelle.`
      : `Schreibberechtigung für "${tableName}" deaktivieren?`

    if (!window.confirm(confirmMessage)) return

    setSavingTable(tableName)
    try {
      await updateTableRegistryEntry(tableName, { allow_write_production: newValue })
      // Update local state
      setTables(prev => prev.map(t => 
        t.table_name === tableName ? { ...t, allow_write_production: newValue } : t
      ))
    } catch (error) {
      console.error('Failed to toggle write permission:', error)
      alert('Fehler beim Ändern der Schreibberechtigung')
    } finally {
      setSavingTable(null)
    }
  }

  // Calculate stats
  const totalTables = tables.length
  const usedTables = tables.filter(t => t.is_used_read).length
  const writeEnabledTables = tables.filter(t => t.allow_write_production).length

  if (!isFeatureEnabled) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Datenbank-Umschalter</h1>
        <div style={styles.warningBox}>
          Das Datenbank-Umschalter Feature ist deaktiviert. 
          Setzen Sie DB_SWITCH_ENABLED=true in der Backend-Konfiguration, um es zu aktivieren.
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <span style={styles.loadingText}>Lade Tabellen-Registry...</span>
        </div>
      )}

      <div style={styles.header}>
        <h1 style={styles.title}>HUGWAWI Tabellen-Registry</h1>
        <p style={styles.subtitle}>
          Übersicht aller HUGWAWI-Datenbanktabellen mit Lese-/Schreibberechtigungen
        </p>
      </div>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Modus:</span>
          <span style={{
            ...styles.statusBadge,
            ...(isTestMode ? styles.statusTest : styles.statusLive)
          }}>
            {isTestMode ? 'TEST' : 'LIVE'}
          </span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Host:</span>
          <span style={styles.statusValue}>{currentHost}</span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Schreiboperationen:</span>
          <span style={styles.statusValue}>
            {isTestMode ? 'Erlaubt (Test-DB)' : 'Blockiert (Live-DB)'}
          </span>
        </div>
      </div>

      {/* Warning if in live mode */}
      {!isTestMode && (
        <div style={styles.warningBox}>
          <strong>Hinweis:</strong> Sie befinden sich im Live-Modus. 
          Schreibberechtigungen können nur im Test-Modus aktiviert werden.
          Wechseln Sie zur Test-Datenbank über den Umschalter im Header.
        </div>
      )}

      {/* Statistics */}
      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <div style={styles.statValue}>{totalTables}</div>
          <div style={styles.statLabel}>Tabellen gesamt</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statValue}>{usedTables}</div>
          <div style={styles.statLabel}>Lesend verwendet</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statValue}>{writeEnabledTables}</div>
          <div style={styles.statLabel}>Schreiben erlaubt</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statValue}>{filteredTables.length}</div>
          <div style={styles.statLabel}>Gefiltert</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={styles.searchBar}>
        <input
          type="text"
          style={styles.searchInput}
          placeholder="Tabelle suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          style={styles.filterSelect}
          value={filterUsed}
          onChange={(e) => setFilterUsed(e.target.value as 'all' | 'used' | 'unused')}
        >
          <option value="all">Alle Tabellen</option>
          <option value="used">Nur verwendete</option>
          <option value="unused">Nur ungenutzte</option>
        </select>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '60px' }}>Pos</th>
              <th style={{ ...styles.th, width: '250px' }}>Tabellenname</th>
              <th style={{ ...styles.th, width: '100px', textAlign: 'center' }}>Lesend verwendet</th>
              <th style={styles.th}>Bemerkungen</th>
              <th style={{ ...styles.th, width: '120px', textAlign: 'center' }}>Schreiben erlaubt</th>
            </tr>
          </thead>
          <tbody>
            {filteredTables.map((table, index) => (
              <tr 
                key={table.table_name}
                style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
              >
                <td style={styles.td}>{table.position}</td>
                <td style={styles.td}>
                  <code>{table.table_name}</code>
                </td>
                <td style={styles.tdCenter}>
                  <span style={{
                    ...styles.usedBadge,
                    ...(table.is_used_read ? styles.usedYes : styles.usedNo)
                  }}>
                    {table.is_used_read ? 'Ja' : 'Nein'}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      style={styles.remarksInput}
                      value={editingRemarks[table.table_name] ?? table.remarks ?? ''}
                      onChange={(e) => handleRemarksChange(table.table_name, e.target.value)}
                      placeholder="Bemerkung eingeben..."
                    />
                    {editingRemarks[table.table_name] !== undefined && 
                     editingRemarks[table.table_name] !== (table.remarks ?? '') && (
                      <button
                        style={styles.saveButton}
                        onClick={() => handleSaveRemarks(table.table_name)}
                        disabled={savingTable === table.table_name}
                      >
                        {savingTable === table.table_name ? '...' : 'Speichern'}
                      </button>
                    )}
                  </div>
                </td>
                <td style={styles.tdCenter}>
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={table.allow_write_production}
                    onChange={() => handleToggleWritePermission(table.table_name, table.allow_write_production)}
                    disabled={!isTestMode || savingTable === table.table_name}
                    title={
                      !isTestMode 
                        ? 'Nur im Test-Modus änderbar' 
                        : table.allow_write_production 
                          ? 'Schreiben erlaubt - klicken zum Deaktivieren'
                          : 'Schreiben nicht erlaubt - klicken zum Aktivieren'
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
