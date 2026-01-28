/**
 * Filter Preset API Service
 * 
 * Handles persistent filter settings for PPS pages
 */
import api from './api'

const BASE_URL = '/pps/config'

// ============== Types ==============

export interface FilterPresetConfig {
  departmentFilter?: string
  machineFilter?: string
  employeeFilter?: string
  statusFilter?: string
  viewMode?: string
}

export interface FilterPreset {
  id: number
  user_id: number
  name: string
  page: string
  is_favorite: boolean
  filter_config: FilterPresetConfig
  created_at?: string
  updated_at?: string
}

export interface FilterPresetCreate {
  name: string
  page: string
  filter_config: FilterPresetConfig
}

export interface FilterPresetUpdate {
  name?: string
  filter_config?: FilterPresetConfig
  is_favorite?: boolean
}

// ============== API Functions ==============

/**
 * Get all filter presets for a specific page
 */
export async function getFilterPresets(page: string, userId: number): Promise<FilterPreset[]> {
  const response = await api.get(`${BASE_URL}/filter-presets`, {
    params: { page },
    headers: { 'X-User-ID': userId.toString() }
  })
  return response.data.items || []
}

/**
 * Get the favorite preset for a specific page (auto-load on page open)
 */
export async function getFavoritePreset(page: string, userId: number): Promise<FilterPreset | null> {
  const response = await api.get(`${BASE_URL}/filter-presets/favorite`, {
    params: { page },
    headers: { 'X-User-ID': userId.toString() }
  })
  return response.data || null
}

/**
 * Create a new filter preset
 */
export async function createFilterPreset(
  payload: FilterPresetCreate,
  userId: number
): Promise<FilterPreset> {
  const response = await api.post(`${BASE_URL}/filter-presets`, payload, {
    headers: { 'X-User-ID': userId.toString() }
  })
  return response.data
}

/**
 * Update an existing filter preset
 */
export async function updateFilterPreset(
  presetId: number,
  payload: FilterPresetUpdate,
  userId: number
): Promise<FilterPreset> {
  const response = await api.patch(`${BASE_URL}/filter-presets/${presetId}`, payload, {
    headers: { 'X-User-ID': userId.toString() }
  })
  return response.data
}

/**
 * Delete a filter preset
 */
export async function deleteFilterPreset(presetId: number, userId: number): Promise<void> {
  await api.delete(`${BASE_URL}/filter-presets/${presetId}`, {
    headers: { 'X-User-ID': userId.toString() }
  })
}

/**
 * Set a preset as favorite (auto-loads on page open)
 */
export async function setFavoritePreset(presetId: number, userId: number): Promise<FilterPreset> {
  const response = await api.post(`${BASE_URL}/filter-presets/${presetId}/set-favorite`, null, {
    headers: { 'X-User-ID': userId.toString() }
  })
  return response.data
}

// Export as object for convenience
export const filterPresetApi = {
  getFilterPresets,
  getFavoritePreset,
  createFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
  setFavoritePreset,
}

export default filterPresetApi
