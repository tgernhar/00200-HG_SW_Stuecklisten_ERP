/**
 * CRM API Service
 */
import api from './api'
import {
  CommunicationEntry,
  CommunicationCreate,
  CommunicationListResponse,
  Lead,
  LeadCreate,
  LeadUpdate,
  LeadListResponse,
  Task,
  TaskCreate,
  TaskUpdate,
  TaskListResponse,
  MyDayResponse,
  Tag,
  TagListResponse,
  TimelineResponse,
  DashboardResponse,
  SearchResponse,
  CustomerSearchResponse,
  SupplierSearchResponse,
  EmailTemplate,
  Mailbox,
  EmailSendRequest,
  EmailSendResponse,
  TemplateRenderRequest,
  TemplateRenderResponse,
  TemplatePreviewResponse,
} from './crmTypes'

const CRM_BASE = '/crm'

// ============== Communications ==============

export async function getCommunications(params?: {
  skip?: number
  limit?: number
  entry_type?: string
  erp_customer_id?: number
  erp_supplier_id?: number
  date_from?: string
  date_to?: string
  is_read?: boolean
  search?: string
}): Promise<CommunicationListResponse> {
  const response = await api.get(`${CRM_BASE}/communications`, { params })
  return response.data
}

export async function getCommunication(id: number): Promise<CommunicationEntry> {
  const response = await api.get(`${CRM_BASE}/communications/${id}`)
  return response.data
}

export async function createCommunication(data: CommunicationCreate): Promise<CommunicationEntry> {
  const response = await api.post(`${CRM_BASE}/communications`, data)
  return response.data
}

export async function updateCommunication(id: number, data: Partial<CommunicationEntry>): Promise<CommunicationEntry> {
  const response = await api.patch(`${CRM_BASE}/communications/${id}`, data)
  return response.data
}

export async function deleteCommunication(id: number): Promise<void> {
  await api.delete(`${CRM_BASE}/communications/${id}`)
}

// ============== Timeline ==============

export async function getCustomerTimeline(erpCustomerId: number, limit?: number): Promise<TimelineResponse> {
  const response = await api.get(`${CRM_BASE}/timeline/customer/${erpCustomerId}`, {
    params: { limit }
  })
  return response.data
}

export async function getDocumentTimeline(linkType: string, erpDocumentId: number, limit?: number): Promise<TimelineResponse> {
  const response = await api.get(`${CRM_BASE}/timeline/document/${linkType}/${erpDocumentId}`, {
    params: { limit }
  })
  return response.data
}

// ============== Tasks ==============

export async function getTasks(params?: {
  skip?: number
  limit?: number
  status?: string
  task_type?: string
  assigned_employee_id?: number
  erp_customer_id?: number
  due_from?: string
  due_to?: string
}): Promise<TaskListResponse> {
  const response = await api.get(`${CRM_BASE}/tasks`, { params })
  return response.data
}

export async function getMyDay(employeeId?: number): Promise<MyDayResponse> {
  const response = await api.get(`${CRM_BASE}/tasks/my-day`, {
    params: { employee_id: employeeId }
  })
  return response.data
}

export async function getTask(id: number): Promise<Task> {
  const response = await api.get(`${CRM_BASE}/tasks/${id}`)
  return response.data
}

export async function createTask(data: TaskCreate): Promise<Task> {
  const response = await api.post(`${CRM_BASE}/tasks`, data)
  return response.data
}

export async function updateTask(id: number, data: TaskUpdate): Promise<Task> {
  const response = await api.patch(`${CRM_BASE}/tasks/${id}`, data)
  return response.data
}

export async function deleteTask(id: number): Promise<void> {
  await api.delete(`${CRM_BASE}/tasks/${id}`)
}

// ============== Leads ==============

export async function getLeads(params?: {
  skip?: number
  limit?: number
  status?: string
  assigned_employee_id?: number
  erp_customer_id?: number
  search?: string
}): Promise<LeadListResponse> {
  const response = await api.get(`${CRM_BASE}/leads`, { params })
  return response.data
}

export async function getLead(id: number): Promise<Lead> {
  const response = await api.get(`${CRM_BASE}/leads/${id}`)
  return response.data
}

export async function createLead(data: LeadCreate): Promise<Lead> {
  const response = await api.post(`${CRM_BASE}/leads`, data)
  return response.data
}

export async function updateLead(id: number, data: LeadUpdate): Promise<Lead> {
  const response = await api.patch(`${CRM_BASE}/leads/${id}`, data)
  return response.data
}

export async function deleteLead(id: number): Promise<void> {
  await api.delete(`${CRM_BASE}/leads/${id}`)
}

// ============== Tags ==============

export async function getTags(tagType?: string): Promise<TagListResponse> {
  const response = await api.get(`${CRM_BASE}/tags`, {
    params: { tag_type: tagType }
  })
  return response.data
}

export async function createTag(data: { name: string; color?: string; tag_type?: string }): Promise<Tag> {
  const response = await api.post(`${CRM_BASE}/tags`, data)
  return response.data
}

export async function updateTag(id: number, data: Partial<Tag>): Promise<Tag> {
  const response = await api.patch(`${CRM_BASE}/tags/${id}`, data)
  return response.data
}

export async function deleteTag(id: number): Promise<void> {
  await api.delete(`${CRM_BASE}/tags/${id}`)
}

// ============== Templates ==============

export async function getTemplates(params?: {
  template_type?: string
  language?: string
}): Promise<{ items: EmailTemplate[]; total: number }> {
  const response = await api.get(`${CRM_BASE}/templates`, { params })
  return response.data
}

export async function createTemplate(data: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const response = await api.post(`${CRM_BASE}/templates`, data)
  return response.data
}

export async function updateTemplate(id: number, data: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const response = await api.patch(`${CRM_BASE}/templates/${id}`, data)
  return response.data
}

export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`${CRM_BASE}/templates/${id}`)
}

// ============== Mailboxes ==============

export async function getMailboxes(): Promise<{ items: Mailbox[]; total: number }> {
  const response = await api.get(`${CRM_BASE}/mailboxes`)
  return response.data
}

export async function createMailbox(data: Partial<Mailbox> & {
  imap_username?: string
  imap_password?: string
  smtp_username?: string
  smtp_password?: string
}): Promise<Mailbox> {
  const response = await api.post(`${CRM_BASE}/mailboxes`, data)
  return response.data
}

// ============== Dashboard ==============

export async function getDashboard(employeeId?: number): Promise<DashboardResponse> {
  const response = await api.get(`${CRM_BASE}/dashboard`, {
    params: { employee_id: employeeId }
  })
  return response.data
}

// ============== Search ==============

export async function searchCommunications(params: {
  q: string
  entry_types?: string
  erp_customer_id?: number
  erp_supplier_id?: number
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}): Promise<SearchResponse> {
  const response = await api.get(`${CRM_BASE}/search`, { params })
  return response.data
}

// ============== Customer/Supplier Search ==============

export async function searchCustomers(q: string, limit?: number): Promise<CustomerSearchResponse> {
  const response = await api.get(`${CRM_BASE}/customers/search`, {
    params: { q, limit }
  })
  return response.data
}

export async function searchSuppliers(q: string, limit?: number): Promise<SupplierSearchResponse> {
  const response = await api.get(`${CRM_BASE}/suppliers/search`, {
    params: { q, limit }
  })
  return response.data
}

// ============== Email Sending ==============

export async function sendEmail(data: EmailSendRequest): Promise<EmailSendResponse> {
  const response = await api.post(`${CRM_BASE}/send-email`, data)
  return response.data
}

export async function renderTemplate(data: TemplateRenderRequest): Promise<TemplateRenderResponse> {
  const response = await api.post(`${CRM_BASE}/templates/render`, data)
  return response.data
}

export async function previewTemplate(
  templateId: number,
  params?: {
    customer_name?: string
    customer_number?: string
    order_number?: string
    offer_number?: string
    contact_name?: string
  }
): Promise<TemplatePreviewResponse> {
  const response = await api.get(`${CRM_BASE}/templates/${templateId}/preview`, { params })
  return response.data
}
