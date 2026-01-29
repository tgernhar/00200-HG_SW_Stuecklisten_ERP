/**
 * Orders Data API Service
 * Provides access to HUGWAWI ordertable data for Auftragsdaten module.
 */
import api from './api'

const ORDERS_DATA_BASE = '/orders-data'

// ============== Types ==============

export interface DocumentType {
  id: number
  name: string
}

export interface OrderStatus {
  id: number
  name: string
  color: string | null
  isClosed: number
}

export interface Address {
  id: number
  suchname: string
  line1: string | null
  city: string | null
  zipcode: string | null
}

export interface Contact {
  id: number
  suchname: string
  name: string | null
  prename: string | null
  function: string | null
}

export interface BackofficeUser {
  id: number
  loginname: string
  Vorname: string | null
  Nachname: string | null
  department_id: number | null
  department_name: string
}

export interface Customer {
  id: number
  suchname: string
  kdn: string | null
}

export interface Language {
  shortName: string
  name: string
}

export interface PaymentTerm {
  id: number
  text: string
}

export interface TaxType {
  id: string
  name: string
}

export interface FactoringOption {
  fact: string
  text: string
}

export interface SalesUser {
  id: number
  loginname: string
  Vorname: string | null
  Nachname: string | null
  department_id: number | null
  department_name: string
}

export interface OrderDataItem {
  id: number
  name: string
  text: string | null
  reference: string | null
  price: number | null
  date1: string | null
  date2: string | null
  created: string | null
  orderType: number
  notiz: string | null
  kid: number | null
  kunde_name: string | null
  kunde_kdn: string | null
  adresse_name: string | null
  kontakt_name: string | null
  status_id: number | null
  status_name: string | null
  status_color: string | null
  bearbeiter: string | null
  dokumenttyp_name: string | null
}

/**
 * Erweiterte Auftragsdetails mit allen Relationen für die Detailansicht.
 */
export interface OrderDetailItem extends OrderDataItem {
  // Lieferadresse
  lieferadresse_name: string | null
  // Kontakte
  techkontakt_name: string | null
  kfmkontakt_name: string | null
  // Mitarbeiter
  backoffice_name: string | null
  vertrieb_name: string | null
  creator_name: string | null
  // Weitere Felder
  sprache_name: string | null
  zahlungsziel_text: string | null
  factoring_text: string | null
  factDat: string | null
  accounting: number | null
  taxtype: string | null
  printPos: number | null
  productionText: string | null
  calculationText: string | null
  lupdat: string | null
  lupdfrom: string | null
  currency: string | null
  paymentTarget: string | null
}

export interface OrderDataSearchResponse {
  items: OrderDataItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface OrderDataFilters {
  order_types?: number[]
  year?: number
  name?: string
  text?: string
  customer?: string
  address_id?: number
  contact_id?: number
  price_min?: number
  price_max?: number
  reference?: string
  date_from?: string
  date_to?: string
  backoffice_id?: number
  status_ids?: number[]
  page?: number
  page_size?: number
  sort_field?: string
  sort_dir?: 'asc' | 'desc'
}

// ============== API Functions ==============

/**
 * Lädt alle Dokumenttypen aus billing_documenttype.
 */
export async function getDocumentTypes(): Promise<{ items: DocumentType[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/document-types`)
  return response.data
}

/**
 * Lädt Status-Optionen aus order_status.
 */
export async function getStatuses(orderType?: number): Promise<{ items: OrderStatus[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/statuses`, {
    params: { order_type: orderType }
  })
  return response.data
}

/**
 * Lädt alle Adressen eines Kunden.
 */
export async function getAddresses(kid: number): Promise<{ items: Address[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/addresses`, {
    params: { kid }
  })
  return response.data
}

/**
 * Lädt alle Kontakte eines Kunden.
 */
export async function getContacts(kid: number): Promise<{ items: Contact[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/contacts`, {
    params: { kid }
  })
  return response.data
}

/**
 * Lädt alle Backoffice-Mitarbeiter (userlogin), gruppiert nach Abteilung.
 */
export async function getBackofficeUsers(): Promise<{ items: BackofficeUser[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/backoffice-users`)
  return response.data
}

/**
 * Sucht Kunden nach Name oder Kundennummer.
 */
export async function searchCustomers(q: string, limit: number = 50): Promise<{ items: Customer[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/customers`, {
    params: { q, limit }
  })
  return response.data
}

/**
 * Hauptsuche für Auftragsdaten mit allen Filtern und Pagination.
 */
export async function searchOrders(filters: OrderDataFilters): Promise<OrderDataSearchResponse> {
  // Convert arrays to comma-separated strings for the API
  const params: Record<string, any> = { ...filters }
  
  if (filters.order_types && filters.order_types.length > 0) {
    params.order_types = filters.order_types.join(',')
  } else {
    delete params.order_types
  }
  
  if (filters.status_ids && filters.status_ids.length > 0) {
    params.status_ids = filters.status_ids.join(',')
  } else {
    delete params.status_ids
  }
  
  const response = await api.get(`${ORDERS_DATA_BASE}/search`, { params })
  return response.data
}

/**
 * Lädt alle Details eines Auftrags/Angebots inkl. aller Relationen.
 */
export async function getOrderDetail(orderId: number): Promise<OrderDetailItem> {
  const response = await api.get(`${ORDERS_DATA_BASE}/${orderId}`)
  return response.data
}

/**
 * Lädt alle verfügbaren Sprachen.
 */
export async function getLanguages(): Promise<{ items: Language[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/languages`)
  return response.data
}

/**
 * Lädt alle Zahlungsziele.
 */
export async function getPaymentTerms(): Promise<{ items: PaymentTerm[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/payment-terms`)
  return response.data
}

/**
 * Lädt alle Steuertypen.
 */
export async function getTaxTypes(): Promise<{ items: TaxType[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/tax-types`)
  return response.data
}

/**
 * Lädt alle Factoring-Optionen.
 */
export async function getFactoringOptions(): Promise<{ items: FactoringOption[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/factoring`)
  return response.data
}

/**
 * Lädt alle Vertriebsmitarbeiter.
 */
export async function getSalesUsers(): Promise<{ items: SalesUser[] }> {
  const response = await api.get(`${ORDERS_DATA_BASE}/sales-users`)
  return response.data
}
