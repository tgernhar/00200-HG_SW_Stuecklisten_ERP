/**
 * Remarks API Service
 * Handles CRUD operations for hierarchy remarks
 */
import api from './api'
import { HierarchyRemark, RemarkCreate, RemarkListResponse, ChildRemarksResponse, ChildRemarksSummary, LevelType } from './types'

export const remarksApi = {
  /**
   * Get remark for a specific element
   */
  getRemark: async (levelType: LevelType, hugwawiId: number): Promise<HierarchyRemark | null> => {
    try {
      const response = await api.get(`/hierarchy-remarks/${levelType}/${hugwawiId}`)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Get remarks for multiple elements of the same level type (batch loading)
   */
  getRemarksByLevel: async (levelType: LevelType, hugwawiIds: number[]): Promise<RemarkListResponse> => {
    if (hugwawiIds.length === 0) {
      return { items: [], total: 0 }
    }
    const response = await api.get(`/hierarchy-remarks/by-level/${levelType}`, {
      params: { hugwawi_ids: hugwawiIds.join(',') }
    })
    return response.data
  },

  /**
   * Create or update a remark
   */
  saveRemark: async (data: RemarkCreate): Promise<HierarchyRemark> => {
    const response = await api.post('/hierarchy-remarks', data)
    return response.data
  },

  /**
   * Delete a remark
   */
  deleteRemark: async (remarkId: number): Promise<void> => {
    await api.delete(`/hierarchy-remarks/${remarkId}`)
  },

  /**
   * Get child remarks for display when parent is collapsed
   */
  getChildRemarks: async (levelType: LevelType, hugwawiId: number): Promise<ChildRemarksResponse> => {
    const response = await api.get(`/hierarchy-remarks/children/${levelType}/${hugwawiId}`)
    return response.data
  },

  /**
   * Get summary of all child remarks for an order (for badge display)
   */
  getChildRemarksSummary: async (orderId: number): Promise<ChildRemarksSummary> => {
    const response = await api.get(`/hierarchy-remarks/child-summary/${orderId}`)
    return response.data
  }
}

export default remarksApi
