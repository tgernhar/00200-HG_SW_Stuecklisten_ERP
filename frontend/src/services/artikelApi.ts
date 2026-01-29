/**
 * Artikel Data API Service
 * API functions for Artikel and Warengruppen module.
 */
import api from './api'

// ============ Types ============

export interface ArticleItem {
  id: number
  articlenumber: string | null
  index: string | null
  description: string | null
  sparepart: string | null
  din: string | null
  en: string | null
  iso: string | null
  eniso: string | null
  active: number | null
  kid: number | null
  materialgroup_id: number | null
  materialgroup_name: string | null
  customer_name: string | null
}

export interface MaterialgroupItem {
  id: number
  name: string | null
  description: string | null
  oldmaterialgroupid: string | null
  articlenumberPrefix: string | null
  showarticleindex: number | null
  active: number | null
  isMasterGroup: number | null
  hasgeneratedarticlenumber: number | null
}

export interface ArticleFilters {
  articlenumber?: string
  index_filter?: string
  barcode?: string
  description?: string
  customer?: string
  din_en_iso?: string
  din_checked?: boolean
  en_checked?: boolean
  iso_checked?: boolean
  eniso_checked?: boolean
  distributor_articlenumber?: string
  materialgroup_search?: string
  show_inactive?: boolean
  extended_limit?: boolean
  page?: number
  page_size?: number
  sort_field?: string
  sort_dir?: string
}

export interface MaterialgroupFilters {
  name?: string
  description?: string
  old_materialgroup?: string
  new_materialgroup?: string
  show_inactive?: boolean
  show_master_only?: boolean
  page?: number
  page_size?: number
  sort_field?: string
  sort_dir?: string
}

export interface ArticleSearchResponse {
  items: ArticleItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
  limit_applied: number
}

export interface MaterialgroupSearchResponse {
  items: MaterialgroupItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============ API Functions ============

/**
 * Sucht Artikel mit den angegebenen Filtern.
 */
export async function searchArticles(filters: ArticleFilters): Promise<ArticleSearchResponse> {
  const params = new URLSearchParams()
  
  if (filters.articlenumber) params.append('articlenumber', filters.articlenumber)
  if (filters.index_filter) params.append('index_filter', filters.index_filter)
  if (filters.barcode) params.append('barcode', filters.barcode)
  if (filters.description) params.append('description', filters.description)
  if (filters.customer) params.append('customer', filters.customer)
  if (filters.din_en_iso) params.append('din_en_iso', filters.din_en_iso)
  if (filters.din_checked !== undefined) params.append('din_checked', String(filters.din_checked))
  if (filters.en_checked !== undefined) params.append('en_checked', String(filters.en_checked))
  if (filters.iso_checked !== undefined) params.append('iso_checked', String(filters.iso_checked))
  if (filters.eniso_checked !== undefined) params.append('eniso_checked', String(filters.eniso_checked))
  if (filters.distributor_articlenumber) params.append('distributor_articlenumber', filters.distributor_articlenumber)
  if (filters.materialgroup_search) params.append('materialgroup_search', filters.materialgroup_search)
  if (filters.show_inactive !== undefined) params.append('show_inactive', String(filters.show_inactive))
  if (filters.extended_limit !== undefined) params.append('extended_limit', String(filters.extended_limit))
  if (filters.page) params.append('page', String(filters.page))
  if (filters.page_size) params.append('page_size', String(filters.page_size))
  if (filters.sort_field) params.append('sort_field', filters.sort_field)
  if (filters.sort_dir) params.append('sort_dir', filters.sort_dir)
  
  const response = await api.get(`/artikel-data/articles/search?${params.toString()}`)
  return response.data
}

/**
 * Sucht Warengruppen mit den angegebenen Filtern.
 */
export async function searchMaterialgroups(filters: MaterialgroupFilters): Promise<MaterialgroupSearchResponse> {
  const params = new URLSearchParams()
  
  if (filters.name) params.append('name', filters.name)
  if (filters.description) params.append('description', filters.description)
  if (filters.old_materialgroup) params.append('old_materialgroup', filters.old_materialgroup)
  if (filters.new_materialgroup) params.append('new_materialgroup', filters.new_materialgroup)
  if (filters.show_inactive !== undefined) params.append('show_inactive', String(filters.show_inactive))
  if (filters.show_master_only !== undefined) params.append('show_master_only', String(filters.show_master_only))
  if (filters.page) params.append('page', String(filters.page))
  if (filters.page_size) params.append('page_size', String(filters.page_size))
  if (filters.sort_field) params.append('sort_field', filters.sort_field)
  if (filters.sort_dir) params.append('sort_dir', filters.sort_dir)
  
  const response = await api.get(`/artikel-data/materialgroups/search?${params.toString()}`)
  return response.data
}
