/**
 * Database Switch API Service
 * 
 * Provides API calls for the database switch feature that allows
 * toggling between Live HUGWAWI (10.233.159.44) and Test HUGWAWI (10.233.159.39).
 */
import api from './api'

// Types
export interface DbSwitchStatus {
  is_test_mode: boolean
  current_host: string
  live_host: string
  test_host: string
  feature_enabled: boolean
}

export interface TableRegistryItem {
  position: number
  table_name: string
  is_used_read: boolean
  remarks: string | null
  allow_write_production: boolean
}

export interface TableRegistryResponse {
  items: TableRegistryItem[]
  total: number
  is_test_mode: boolean
  feature_enabled: boolean
}

export interface CanWriteResponse {
  can_write: boolean
  table_name: string
  reason: string
  is_test_mode: boolean
  allow_write_production: boolean
}

// API Functions

/**
 * Get the current database switch status
 */
export async function getDbSwitchStatus(): Promise<DbSwitchStatus> {
  const response = await api.get<DbSwitchStatus>('/db-switch/status')
  return response.data
}

/**
 * Toggle between live and test database mode
 */
export async function toggleDbMode(useTestDb: boolean): Promise<DbSwitchStatus> {
  const response = await api.post<DbSwitchStatus>('/db-switch/toggle', {
    use_test_db: useTestDb
  })
  return response.data
}

/**
 * Get all tables from the registry
 */
export async function getTableRegistry(): Promise<TableRegistryResponse> {
  const response = await api.get<TableRegistryResponse>('/db-switch/table-registry')
  return response.data
}

/**
 * Get a specific table from the registry
 */
export async function getTableRegistryEntry(tableName: string): Promise<TableRegistryItem> {
  const response = await api.get<TableRegistryItem>(`/db-switch/table-registry/${tableName}`)
  return response.data
}

/**
 * Update a table registry entry (remarks and/or write permission)
 */
export async function updateTableRegistryEntry(
  tableName: string,
  updates: { remarks?: string | null; allow_write_production?: boolean }
): Promise<TableRegistryItem> {
  const response = await api.put<TableRegistryItem>(
    `/db-switch/table-registry/${tableName}`,
    updates
  )
  return response.data
}

/**
 * Check if writing to a specific table is allowed
 */
export async function canWriteToTable(tableName: string): Promise<CanWriteResponse> {
  const response = await api.get<CanWriteResponse>(`/db-switch/can-write/${tableName}`)
  return response.data
}
