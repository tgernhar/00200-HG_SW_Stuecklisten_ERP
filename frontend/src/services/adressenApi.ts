/**
 * Adressen Data API Service
 * API functions for Adressen module (addresses from HUGWAWI).
 */
import api from './api'

// ============ Types ============

export type SearchGroup = 'kunde' | 'kontakt' | 'adresszeile'

export interface AddressItem {
  id: number
  kdn: string | null
  suchname: string | null
  url: string | null
  comment: string | null
  currency: string | null
  customer: number | null
  distributor: number | null
  salesprospect: number | null
  reminderstop: number | null
  concern: number | null
  blocked: number | null
  zahlziel: number | null
}

export interface ContactType {
  id: number
  name: string
}

export interface AddressFilters {
  // Search group
  search_group: SearchGroup
  // Kunde group filters
  suchname?: string
  kdn?: string
  currency?: string
  is_customer?: boolean
  is_salesprospect?: boolean
  is_distributor?: boolean
  is_reminderstop?: boolean
  is_employee?: boolean
  is_concern?: boolean
  // Kontakt group filters
  contact_name?: string
  phone?: string
  email?: string
  contact_type_id?: number
  function?: string
  // Adresszeile group filters
  address?: string
  tax_number?: string
  sales_tax_id?: string
  iban?: string
  // Pagination and sorting
  page?: number
  page_size?: number
  sort_field?: string
  sort_dir?: string
}

export interface AddressSearchResponse {
  items: AddressItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ============ API Functions ============

/**
 * Loads all contact types for the contact type dropdown.
 */
export async function getContactTypes(): Promise<ContactType[]> {
  const response = await api.get('/adressen-data/contact-types')
  return response.data
}

/**
 * Searches addresses with the given filters.
 */
export async function searchAddresses(filters: AddressFilters): Promise<AddressSearchResponse> {
  const params = new URLSearchParams()
  
  // Search group
  params.append('search_group', filters.search_group)
  
  // Kunde group filters
  if (filters.suchname) params.append('suchname', filters.suchname)
  if (filters.kdn) params.append('kdn', filters.kdn)
  if (filters.currency) params.append('currency', filters.currency)
  if (filters.is_customer !== undefined) params.append('is_customer', String(filters.is_customer))
  if (filters.is_salesprospect !== undefined) params.append('is_salesprospect', String(filters.is_salesprospect))
  if (filters.is_distributor !== undefined) params.append('is_distributor', String(filters.is_distributor))
  if (filters.is_reminderstop !== undefined) params.append('is_reminderstop', String(filters.is_reminderstop))
  if (filters.is_employee !== undefined) params.append('is_employee', String(filters.is_employee))
  if (filters.is_concern !== undefined) params.append('is_concern', String(filters.is_concern))
  
  // Kontakt group filters
  if (filters.contact_name) params.append('contact_name', filters.contact_name)
  if (filters.phone) params.append('phone', filters.phone)
  if (filters.email) params.append('email', filters.email)
  if (filters.contact_type_id !== undefined) params.append('contact_type_id', String(filters.contact_type_id))
  if (filters.function) params.append('function', filters.function)
  
  // Adresszeile group filters
  if (filters.address) params.append('address', filters.address)
  if (filters.tax_number) params.append('tax_number', filters.tax_number)
  if (filters.sales_tax_id) params.append('sales_tax_id', filters.sales_tax_id)
  if (filters.iban) params.append('iban', filters.iban)
  
  // Pagination and sorting
  if (filters.page) params.append('page', String(filters.page))
  if (filters.page_size) params.append('page_size', String(filters.page_size))
  if (filters.sort_field) params.append('sort_field', filters.sort_field)
  if (filters.sort_dir) params.append('sort_dir', filters.sort_dir)
  
  const response = await api.get(`/adressen-data/search?${params.toString()}`)
  return response.data
}
