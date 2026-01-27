/**
 * Image API Service
 * 
 * Frontend service for the image management API.
 * Handles upload, retrieval, and deletion of entity images.
 */
import axios from 'axios'

const API_BASE = '/api/images'

// ============== Types ==============

export interface EntityImageData {
  id: number
  entity_type: string
  entity_id: number | null
  entity_reference: string | null
  original_filepath: string
  original_filename: string | null
  file_type: string | null
  thumbnail_size: string | null
  thumbnail_base64: string | null
  thumbnail_width: number | null
  thumbnail_height: number | null
}

export interface ImageUploadRequest {
  entity_type: string
  entity_id?: number
  entity_reference?: string
  filepath: string
  thumbnail_size?: 'small' | 'medium' | 'large'
}

export interface ImageUploadResponse {
  success: boolean
  id: number
  entity_type: string
  entity_id: number | null
  entity_reference: string | null
  original_filename: string | null
  thumbnail_size: string | null
  thumbnail_width: number | null
  thumbnail_height: number | null
}

export interface ThumbnailSizeConfig {
  width: number
  height: number
}

// ============== API Functions ==============

/**
 * Upload an image for an entity.
 * 
 * @param data Upload request data
 * @returns Upload response with image ID
 */
export async function uploadEntityImage(data: ImageUploadRequest): Promise<ImageUploadResponse> {
  const response = await axios.post<ImageUploadResponse>(`${API_BASE}/upload`, data)
  return response.data
}

/**
 * Get image for an entity by type and ID or reference.
 * 
 * @param entityType Type of entity (article, bom_item, workstep)
 * @param entityId Entity ID (optional)
 * @param entityReference Entity reference string (optional)
 * @returns Image data or null if not found
 */
export async function getEntityImage(
  entityType: string,
  entityId?: number,
  entityReference?: string
): Promise<EntityImageData | null> {
  try {
    let response
    
    if (entityId) {
      response = await axios.get<EntityImageData>(`${API_BASE}/${entityType}/${entityId}`)
    } else if (entityReference) {
      response = await axios.get<EntityImageData>(`${API_BASE}/by-reference/${entityType}/${encodeURIComponent(entityReference)}`)
    } else {
      return null
    }
    
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Delete an entity image.
 * 
 * @param imageId ID of the image to delete
 */
export async function deleteEntityImage(imageId: number): Promise<void> {
  await axios.delete(`${API_BASE}/${imageId}`)
}

/**
 * Get the URL to view the original file in the browser.
 * 
 * @param filepath Original file path
 * @returns URL to access the file
 */
export function getOriginalFileUrl(filepath: string): string {
  return `${API_BASE}/file?path=${encodeURIComponent(filepath)}`
}

/**
 * Get available thumbnail sizes configuration.
 * 
 * @returns Map of size names to dimensions
 */
export async function getAvailableSizes(): Promise<Record<string, ThumbnailSizeConfig>> {
  const response = await axios.get<Record<string, ThumbnailSizeConfig>>(`${API_BASE}/config/sizes`)
  return response.data
}

// Export as default object for convenience
const imageApi = {
  uploadEntityImage,
  getEntityImage,
  deleteEntityImage,
  getOriginalFileUrl,
  getAvailableSizes,
}

export default imageApi
