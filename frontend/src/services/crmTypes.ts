/**
 * CRM TypeScript Types
 */

// Enums
export type CommunicationType = 'email_in' | 'email_out' | 'phone' | 'meeting' | 'note' | 'document'
export type LeadStatus = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type TaskType = 'follow_up' | 'call' | 'meeting' | 'internal' | 'reminder'
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'
export type TagType = 'industry' | 'rating' | 'region' | 'other'
export type DocumentLinkType = 'inquiry' | 'offer' | 'order' | 'purchase_order' | 'delivery_note' | 'invoice'

// Tag
export interface Tag {
  id: number
  name: string
  color?: string
  tag_type: TagType
  created_at?: string
}

// Attachment
export interface Attachment {
  id: number
  communication_id: number
  filename: string
  original_filename?: string
  content_type?: string
  file_size?: number
  storage_path: string
  is_inline: boolean
  created_at?: string
}

// Communication Link
export interface CommunicationLink {
  id: number
  communication_id: number
  link_type: DocumentLinkType
  erp_document_id: number
  erp_document_number?: string
  is_auto_assigned: boolean
  assigned_at?: string
}

// Communication Entry
export interface CommunicationEntry {
  id: number
  entry_type: CommunicationType
  subject?: string
  body_html?: string
  body_text?: string
  sender_email?: string
  sender_name?: string
  recipient_emails?: string[]
  cc_emails?: string[]
  bcc_emails?: string[]
  message_id?: string
  thread_id?: string
  mailbox_id?: number
  is_internal: boolean
  is_read: boolean
  erp_customer_id?: number
  erp_supplier_id?: number
  erp_contact_id?: number
  assignment_confidence?: number
  is_auto_assigned: boolean
  communication_date: string
  created_at?: string
  updated_at?: string
  attachments: Attachment[]
  links: CommunicationLink[]
  attachment_count: number
  // Extended fields
  customer_name?: string
  supplier_name?: string
}

export interface CommunicationCreate {
  entry_type: CommunicationType
  subject?: string
  body_html?: string
  body_text?: string
  sender_email?: string
  sender_name?: string
  recipient_emails?: string[]
  cc_emails?: string[]
  is_internal?: boolean
  erp_customer_id?: number
  erp_supplier_id?: number
  erp_contact_id?: number
  communication_date: string
  document_links?: { link_type: DocumentLinkType; erp_document_id: number; erp_document_number?: string }[]
}

// Lead
export interface Lead {
  id: number
  title: string
  description?: string
  erp_customer_id?: number
  customer_name?: string
  contact_email?: string
  contact_phone?: string
  status: LeadStatus
  lost_reason?: string
  expected_value?: number
  expected_close_date?: string
  assigned_employee_id?: number
  assigned_employee_name?: string
  erp_offer_id?: number
  source?: string
  priority: number
  created_at?: string
  updated_at?: string
  tags: Tag[]
}

export interface LeadCreate {
  title: string
  description?: string
  erp_customer_id?: number
  customer_name?: string
  contact_email?: string
  contact_phone?: string
  status?: LeadStatus
  expected_value?: number
  expected_close_date?: string
  assigned_employee_id?: number
  source?: string
  priority?: number
  tag_ids?: number[]
}

export interface LeadUpdate {
  title?: string
  description?: string
  erp_customer_id?: number
  customer_name?: string
  contact_email?: string
  contact_phone?: string
  status?: LeadStatus
  lost_reason?: string
  expected_value?: number
  expected_close_date?: string
  assigned_employee_id?: number
  source?: string
  priority?: number
  tag_ids?: number[]
}

// Task
export interface Task {
  id: number
  title: string
  description?: string
  task_type: TaskType
  status: TaskStatus
  priority: number
  due_date?: string
  due_time?: string
  assigned_employee_id?: number
  assigned_employee_name?: string
  erp_customer_id?: number
  erp_supplier_id?: number
  lead_id?: number
  communication_id?: number
  link_type?: string
  erp_document_id?: number
  completed_at?: string
  created_at?: string
  updated_at?: string
  is_overdue: boolean
  // Extended fields
  customer_name?: string
  supplier_name?: string
  lead_title?: string
}

export interface TaskCreate {
  title: string
  description?: string
  task_type?: TaskType
  status?: TaskStatus
  priority?: number
  due_date?: string
  due_time?: string
  assigned_employee_id?: number
  erp_customer_id?: number
  erp_supplier_id?: number
  lead_id?: number
  communication_id?: number
  link_type?: DocumentLinkType
  erp_document_id?: number
}

export interface TaskUpdate {
  title?: string
  description?: string
  task_type?: TaskType
  status?: TaskStatus
  priority?: number
  due_date?: string
  due_time?: string
  assigned_employee_id?: number
  erp_customer_id?: number
  erp_supplier_id?: number
  lead_id?: number
  link_type?: DocumentLinkType
  erp_document_id?: number
}

// Timeline
export interface TimelineEntry {
  id: number
  entry_type: string
  date: string
  subject?: string
  body_preview?: string
  sender?: string
  is_internal: boolean
  has_attachments: boolean
  attachment_count: number
  status?: string
  is_overdue: boolean
  linked_documents: any[]
}

export interface TimelineResponse {
  entity_type: string
  entity_id: number
  entity_name?: string
  entries: TimelineEntry[]
  total: number
  email_count: number
  call_count: number
  meeting_count: number
  note_count: number
  task_count: number
}

// Dashboard
export interface DashboardStats {
  total_communications: number
  unread_emails: number
  communications_today: number
  communications_this_week: number
  open_tasks: number
  overdue_tasks: number
  tasks_due_today: number
  tasks_completed_this_week: number
  total_leads: number
  leads_by_status: Record<string, number>
  pipeline_value: number
  leads_won_this_month: number
  leads_lost_this_month: number
}

export interface RecentActivity {
  id: number
  activity_type: string
  title: string
  description?: string
  date: string
  customer_name?: string
}

export interface DashboardResponse {
  stats: DashboardStats
  recent_activities: RecentActivity[]
  my_tasks: Task[]
  my_leads: Lead[]
}

// My Day
export interface MyDayResponse {
  today_tasks: Task[]
  overdue_tasks: Task[]
  upcoming_tasks: Task[]
  total_open: number
}

// Search
export interface SearchResult {
  id: number
  entry_type: string
  subject?: string
  body_preview?: string
  sender?: string
  date: string
  customer_name?: string
  supplier_name?: string
  relevance_score: number
  highlight?: string
}

export interface SearchResponse {
  items: SearchResult[]
  total: number
  query: string
}

// Customer/Supplier Info
export interface CustomerInfo {
  id: number
  customer_number?: string
  name: string
  email?: string
  phone?: string
  city?: string
  salesperson_id?: number
  salesperson_name?: string
}

export interface SupplierInfo {
  id: number
  supplier_number?: string
  name: string
  email?: string
  phone?: string
  city?: string
}

// Email Template
export interface EmailTemplate {
  id: number
  name: string
  language: string
  subject_template?: string
  body_template?: string
  template_type: string
  is_active: boolean
  created_at?: string
}

// Mailbox
export interface Mailbox {
  id: number
  name: string
  email_address: string
  imap_host?: string
  smtp_host?: string
  is_active: boolean
  last_sync_at?: string
}

// List Responses
export interface CommunicationListResponse {
  items: CommunicationEntry[]
  total: number
  skip: number
  limit: number
}

export interface LeadListResponse {
  items: Lead[]
  total: number
  by_status: Record<string, number>
}

export interface TaskListResponse {
  items: Task[]
  total: number
  overdue_count: number
  today_count: number
}

export interface TagListResponse {
  items: Tag[]
  total: number
}

export interface CustomerSearchResponse {
  items: CustomerInfo[]
  total: number
}

export interface SupplierSearchResponse {
  items: SupplierInfo[]
  total: number
}

// Email Send
export interface EmailSendRequest {
  mailbox_id: number
  to_emails: string[]
  cc_emails?: string[]
  bcc_emails?: string[]
  subject: string
  body_html: string
  body_text?: string
  erp_customer_id?: number
  erp_supplier_id?: number
  lead_id?: number
  document_links?: { link_type: DocumentLinkType; erp_document_id: number; erp_document_number?: string }[]
  template_id?: number
  include_signature?: boolean
}

export interface EmailSendResponse {
  success: boolean
  communication_id?: number
  message_id?: string
  error?: string
}

export interface TemplateRenderRequest {
  template_id: number
  variables: Record<string, string>
}

export interface TemplateRenderResponse {
  subject: string
  body: string
}

export interface TemplatePreviewResponse {
  template_id: number
  template_name: string
  subject: string
  body: string
  available_variables: string[]
}
