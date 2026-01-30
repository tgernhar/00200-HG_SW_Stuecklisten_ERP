/**
 * Database Context
 * 
 * Manages the database switch state for toggling between:
 * - Live HUGWAWI (10.233.159.44) - read-only
 * - Test HUGWAWI (10.233.159.39) - read + write (when allowed)
 * 
 * The switch feature can be completely hidden by setting DB_SWITCH_ENABLED=false
 * in the backend configuration.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { 
  getDbSwitchStatus, 
  toggleDbMode, 
  canWriteToTable,
  DbSwitchStatus,
  CanWriteResponse 
} from '../services/dbSwitchApi'

// Types
interface DatabaseContextType {
  /** True if test database is active */
  isTestMode: boolean
  /** True if the database switch feature is enabled */
  isFeatureEnabled: boolean
  /** Currently active database host */
  currentHost: string
  /** Live database host (10.233.159.44) */
  liveHost: string
  /** Test database host (10.233.159.39) */
  testHost: string
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Toggle between test and live database */
  setTestMode: (enabled: boolean) => Promise<void>
  /** Check if writing to a specific table is allowed */
  canWriteToTable: (tableName: string) => Promise<boolean>
  /** Refresh the status from backend */
  refreshStatus: () => Promise<void>
}

// Default values
const defaultContext: DatabaseContextType = {
  isTestMode: false,
  isFeatureEnabled: false,
  currentHost: '',
  liveHost: '',
  testHost: '',
  isLoading: true,
  error: null,
  setTestMode: async () => {},
  canWriteToTable: async () => false,
  refreshStatus: async () => {}
}

// Create context
const DatabaseContext = createContext<DatabaseContextType>(defaultContext)

// Provider props
interface DatabaseProviderProps {
  children: ReactNode
}

/**
 * Database Provider Component
 * 
 * Wraps the application and provides database switch functionality.
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [status, setStatus] = useState<DbSwitchStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial status
  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getDbSwitchStatus()
      setStatus(data)
    } catch (err: any) {
      console.error('Failed to fetch database status:', err)
      setError(err.message || 'Fehler beim Laden des Datenbank-Status')
      // Set defaults if feature is not available
      setStatus({
        is_test_mode: false,
        current_host: '',
        live_host: '10.233.159.44',
        test_host: '10.233.159.39',
        feature_enabled: false
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Toggle database mode
  const handleSetTestMode = useCallback(async (enabled: boolean) => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await toggleDbMode(enabled)
      setStatus(data)
    } catch (err: any) {
      console.error('Failed to toggle database mode:', err)
      setError(err.message || 'Fehler beim Umschalten der Datenbank')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check if writing to a table is allowed
  const handleCanWriteToTable = useCallback(async (tableName: string): Promise<boolean> => {
    try {
      const response: CanWriteResponse = await canWriteToTable(tableName)
      return response.can_write
    } catch (err: any) {
      console.error(`Failed to check write permission for ${tableName}:`, err)
      return false
    }
  }, [])

  // Build context value
  const contextValue: DatabaseContextType = {
    isTestMode: status?.is_test_mode ?? false,
    isFeatureEnabled: status?.feature_enabled ?? false,
    currentHost: status?.current_host ?? '',
    liveHost: status?.live_host ?? '10.233.159.44',
    testHost: status?.test_host ?? '10.233.159.39',
    isLoading,
    error,
    setTestMode: handleSetTestMode,
    canWriteToTable: handleCanWriteToTable,
    refreshStatus: fetchStatus
  }

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  )
}

/**
 * Hook to access database context
 * 
 * @returns DatabaseContextType with current state and functions
 * @throws Error if used outside of DatabaseProvider
 */
export function useDatabase(): DatabaseContextType {
  const context = useContext(DatabaseContext)
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider')
  }
  return context
}

export default DatabaseContext
