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

// ============ Article Detail Types ============

export interface ArticleDetailItem {
  id: number
  mandant: number | null
  articlenumber: string | null
  index: string | null
  description: string | null
  materialgroup: number | null
  materialgroup_name: string | null
  kid: number | null
  customer_name: string | null
  evk: number | null
  purchasecalctype: number | null
  purchasecalctype_name: string | null
  salescalctype: number | null
  salescalctype_name: string | null
  purchasegrade: number | null
  salesgrade: number | null
  ekdatum: string | null
  ekmenge: number | null
  department: number | null
  department_name: string | null
  calculation: number | null
  calculation_name: string | null
  sparepart: string | null
  din: string | null
  en: string | null
  iso: string | null
  eniso: string | null
  origin: string | null
  commoditycode: string | null
  weight: number | null
  active: number | null
  salesfactor: number | null
  wastefactor: number | null
  imageurl: string | null
  imageoriginalurl: string | null
  picturepath: string | null
  manufacturer: number | null
  manufacturerArticleNumber: string | null
  lastUpdated: string | null
  // Custom text fields
  customtext1: string | null
  customtext2: string | null
  customtext3: string | null
  customtext4: string | null
  customtext5: string | null
  customtext6: string | null
  customtext7: string | null
  customtext8: string | null
  customtext9: string | null
  customtext10: string | null
  customtext11: string | null
  customtext12: string | null
  customtext13: string | null
  customtext14: string | null
  customtext15: string | null
  // Custom date fields
  customdate1: string | null
  customdate2: string | null
  customdate3: string | null
  customdate4: string | null
  customdate5: string | null
  // Custom int fields
  customint1: number | null
  customint2: number | null
  customint3: number | null
  customint4: number | null
  customint5: number | null
  customint6: number | null
  // Custom float fields
  customfloat1: number | null
  customfloat2: number | null
  customfloat3: number | null
  customfloat4: number | null
  customfloat5: number | null
  customfloat6: number | null
  customfloat7: number | null
  customfloat8: number | null
  customfloat9: number | null
  customfloat10: number | null
  // Custom boolean fields
  customboolean1: number | null
  customboolean2: number | null
  customboolean3: number | null
  customboolean4: number | null
  customboolean5: number | null
  customboolean6: number | null
}

export interface CustomFieldLabel {
  id: number
  customfield: number
  field_name: string
  field_type: string
  label: string
  mandatory: number | null
  position: number | null
  selectlist: number | null
  standardvalue: string | null
  showincustomtable: number | null
  important: number | null
}

export interface Department {
  id: number
  name: string | null
}

export interface CalculationType {
  id: number
  name: string | null
}

export interface Calculation {
  id: number
  name: string | null
}

export interface MaterialgroupDropdownItem {
  id: number
  name: string | null
}

export interface CustomerSearchResult {
  id: number
  suchname: string | null
  kdn: string | null
}

export interface SelectlistValue {
  id: number
  value: string | null
}

// ============ Article Detail API Functions ============

/**
 * Loads detailed data for a single article.
 */
export async function getArticleDetail(articleId: number): Promise<ArticleDetailItem> {
  const response = await api.get(`/artikel-data/${articleId}`)
  return response.data
}

/**
 * Loads custom field labels for an article's materialgroup.
 */
export async function getCustomFieldLabels(articleId: number): Promise<CustomFieldLabel[]> {
  const response = await api.get(`/artikel-data/${articleId}/custom-field-labels`)
  return response.data
}

/**
 * Loads calculations (VK-Berechnung) for an article's materialgroup.
 */
export async function getCalculationsForArticle(articleId: number): Promise<Calculation[]> {
  const response = await api.get(`/artikel-data/${articleId}/calculations`)
  return response.data
}

/**
 * Loads all departments for dropdown selection.
 */
export async function getDepartments(): Promise<Department[]> {
  const response = await api.get('/artikel-data/departments')
  return response.data
}

/**
 * Loads all calculation types (units) for dropdown selection.
 */
export async function getCalculationTypes(): Promise<CalculationType[]> {
  const response = await api.get('/artikel-data/calculation-types')
  return response.data
}

/**
 * Loads materialgroups for dropdown/autocomplete.
 */
export async function getMaterialgroupsForDropdown(search?: string, limit?: number): Promise<MaterialgroupDropdownItem[]> {
  const params = new URLSearchParams()
  if (search) params.append('search', search)
  if (limit) params.append('limit', String(limit))
  const response = await api.get(`/artikel-data/materialgroups/dropdown?${params.toString()}`)
  return response.data
}

/**
 * Searches customers by suchname for autocomplete.
 */
export async function searchCustomers(term: string, limit?: number): Promise<CustomerSearchResult[]> {
  const params = new URLSearchParams()
  params.append('term', term)
  if (limit) params.append('limit', String(limit))
  const response = await api.get(`/artikel-data/customers/search?${params.toString()}`)
  return response.data
}

/**
 * Loads all values for a specific selectlist.
 * Used for custom fields that have a selectlist assigned.
 */
export async function getSelectlistValues(selectlistId: number): Promise<SelectlistValue[]> {
  const response = await api.get(`/artikel-data/selectlist/${selectlistId}/values`)
  return response.data
}
