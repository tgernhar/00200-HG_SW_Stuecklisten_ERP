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
  name: string | null
}

export interface Salutation {
  id: number
  name: string | null
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

// Detail view types
export interface AddressDetailItem {
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
  blocked: number | null
  employee: number | null
  concern: number | null
  termofpayment: number | null
  packingConditions: number | null
  tage: number | null
  stage: number | null
  skonto: number | null
  butext: string | null
  invlid: number | null
  dnlid: number | null
  oldSupplierId: string | null
  code: string | null
  materialgroupid: string | null
  distriMaterialgroup: string | null
  upsAccount: string | null
  kdnAtDistributor: string | null
  sendUpsEmail: number | null
  notificationInfo: string | null
  notificationDate: string | null
  zahlziel_days: number | null
  zahlziel_text: string | null
  versandbedingung_name: string | null
  rechnungsadresse_name: string | null
  lieferadresse_name: string | null
}

export interface AddressContact {
  id: number
  suchname: string | null
  phones: string | null
  emails: string | null
  type_name: string | null
  function: string | null
  favorite: number | null
}

export interface AddressLine {
  id: number
  kdn: string | null
  suchname: string | null
  street: string | null
  zipcode: string | null
  city: string | null
}

export interface PaymentTerm {
  id: number
  days: number | null
  text: string | null
}

export interface PackingCondition {
  id: number
  name: string | null
}

// Contact Detail types
export interface ContactDetailItem {
  id: number
  mandant: number | null
  adrnr: number | null
  firstname: string | null
  lastname: string | null
  suchname: string | null
  addname: string | null
  salutation: string | null
  title: string | null
  url: string | null
  birthdate: string | null
  function: string | null
  description: string | null
  type_name: string | null
  favorite: number | null
  blocked: number | null
}

export interface ContactEmail {
  id: number
  email: string | null
  type: number | null
  type_name: string | null
}

export interface ContactPhone {
  id: number
  phonenumber: string | null
  type: number | null
  type_name: string | null
}

export interface EmailType {
  id: number
  name: string | null
}

export interface PhoneType {
  id: number
  name: string | null
}

// Address Line Detail types
export interface AddressLineDetailItem {
  id: number
  kid: number | null
  kdn: string | null
  suchname: string | null
  line1: string | null
  line2: string | null
  line3: string | null
  line4: string | null
  street: string | null
  zipcode: string | null
  city: string | null
  country: number | null
  country_name: string | null
  isPrivate: number | null
  salestax: string | null
  steuernum: string | null
  email: string | null
  blocked: number | null
}

export interface AddressLineAccount {
  id: number
  taxnumber: string | null
  bankcode: string | null
  accountnumber: string | null
  iban: string | null
  swift: string | null
}

export interface AddressLineMLine {
  id: number | null
  islsv: number | null
  directDebitMandateDate: string | null
  directDebitMandateId: string | null
  fact: number | null
  factoring_name: string | null
}

export interface Country {
  id: number
  name: string | null
}

export interface FactoringOption {
  id: number
  name: string | null
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
 * Loads all salutations for the salutation dropdown.
 */
export async function getSalutations(): Promise<Salutation[]> {
  const response = await api.get('/adressen-data/salutations')
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

/**
 * Loads detail data for a single address.
 */
export async function getAddressDetail(addressId: number): Promise<AddressDetailItem> {
  const response = await api.get(`/adressen-data/${addressId}`)
  return response.data
}

/**
 * Loads all contacts for an address.
 */
export async function getAddressContacts(addressId: number): Promise<AddressContact[]> {
  const response = await api.get(`/adressen-data/${addressId}/contacts`)
  return response.data
}

/**
 * Loads all address lines for an address.
 */
export async function getAddressLines(addressId: number): Promise<AddressLine[]> {
  const response = await api.get(`/adressen-data/${addressId}/address-lines`)
  return response.data
}

/**
 * Loads all payment terms for dropdown.
 */
export async function getPaymentTerms(): Promise<PaymentTerm[]> {
  const response = await api.get('/adressen-data/payment-terms')
  return response.data
}

/**
 * Loads all packing conditions for dropdown.
 */
export async function getPackingConditions(): Promise<PackingCondition[]> {
  const response = await api.get('/adressen-data/packing-conditions')
  return response.data
}

/**
 * Loads detailed data for a single contact.
 */
export async function getContactDetail(contactId: number): Promise<ContactDetailItem> {
  const response = await api.get(`/adressen-data/contacts/${contactId}`)
  return response.data
}

/**
 * Loads all emails for a contact.
 */
export async function getContactEmails(contactId: number): Promise<ContactEmail[]> {
  const response = await api.get(`/adressen-data/contacts/${contactId}/emails`)
  return response.data
}

/**
 * Loads all phone numbers for a contact.
 */
export async function getContactPhones(contactId: number): Promise<ContactPhone[]> {
  const response = await api.get(`/adressen-data/contacts/${contactId}/phones`)
  return response.data
}

/**
 * Loads all email types for dropdown.
 */
export async function getEmailTypes(): Promise<EmailType[]> {
  const response = await api.get('/adressen-data/email-types')
  return response.data
}

/**
 * Loads all phone types for dropdown.
 */
export async function getPhoneTypes(): Promise<PhoneType[]> {
  const response = await api.get('/adressen-data/phone-types')
  return response.data
}

/**
 * Loads detailed data for a single address line.
 */
export async function getAddressLineDetail(lineId: number): Promise<AddressLineDetailItem> {
  const response = await api.get(`/adressen-data/address-lines/${lineId}`)
  return response.data
}

/**
 * Loads all bank accounts for an address line.
 */
export async function getAddressLineAccounts(lineId: number): Promise<AddressLineAccount[]> {
  const response = await api.get(`/adressen-data/address-lines/${lineId}/accounts`)
  return response.data
}

/**
 * Loads direct debit data for an address line.
 */
export async function getAddressLineMLine(lineId: number): Promise<AddressLineMLine | null> {
  const response = await api.get(`/adressen-data/address-lines/${lineId}/mline`)
  return response.data
}

/**
 * Loads all countries for dropdown.
 */
export async function getCountries(): Promise<Country[]> {
  const response = await api.get('/adressen-data/countries')
  return response.data
}

/**
 * Loads all factoring options for dropdown.
 */
export async function getFactoringOptions(): Promise<FactoringOption[]> {
  const response = await api.get('/adressen-data/factoring')
  return response.data
}
