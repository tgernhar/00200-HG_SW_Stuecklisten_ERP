/**
 * Stücklisten API Service
 * Provides API functions for the Stücklisten module
 */
import api from './api'

// Types
export interface MaterialgroupOption {
  id: number
  name: string
}

export interface ArticleOption {
  id: number
  articlenumber: string
  index: string | null
  description: string | null
}

export interface StuecklistenFilters {
  materialgroup_id?: number
  articlenumber?: string
  is_sub?: boolean
}

export interface StuecklisteItem {
  article_id: number
  article_display: string
  description: string | null
  packingnote_id: number
  is_sub: boolean
}

export interface BomContentItem {
  detail_id: number
  level: number
  pos: number | null
  pos_level1: number | null
  pos_level2: number | null
  pos_level3: number | null
  pos_level4: number | null
  article_display: string
  nettoamount: number | null
  factor: number | null
  purchaseprice: number | null
  salesfactor: number | null
}

/**
 * Autocomplete für Warengruppen
 */
export async function getMaterialgroupsAutocomplete(search: string): Promise<MaterialgroupOption[]> {
  const response = await api.get('/stuecklisten-data/materialgroups/autocomplete', {
    params: { search }
  })
  return response.data
}

/**
 * Autocomplete für Artikelnummern
 */
export async function getArticlesAutocomplete(
  search: string,
  materialgroup_id?: number
): Promise<ArticleOption[]> {
  const response = await api.get('/stuecklisten-data/articles/autocomplete', {
    params: { search, materialgroup_id }
  })
  return response.data
}

/**
 * Sucht Artikel die eine Stückliste haben
 */
export async function searchStuecklisten(filters: StuecklistenFilters): Promise<StuecklisteItem[]> {
  const response = await api.get('/stuecklisten-data/search', {
    params: {
      materialgroup_id: filters.materialgroup_id,
      articlenumber: filters.articlenumber,
      is_sub: filters.is_sub
    }
  })
  return response.data
}

/**
 * Lädt BOM-Inhalt für eine packingnote
 */
export async function getBomContent(packingnote_id: number): Promise<BomContentItem[]> {
  const response = await api.get(`/stuecklisten-data/${packingnote_id}/content`)
  return response.data
}
