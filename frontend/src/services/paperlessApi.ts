/**
 * Paperless-ngx API Service
 */
import {
  PaperlessDocument,
  PaperlessDocumentListResponse,
  PaperlessUploadResponse,
  PaperlessCorrespondent,
  PaperlessDocumentType,
  PaperlessTag,
  PaperlessCustomField,
  PaperlessConnectionStatus,
  PaperlessUploadParams,
  PaperlessSearchParams,
} from './paperlessTypes';

const API_BASE = '/api/paperless';

// Token storage key (must match api.ts)
const TOKEN_KEY = 'auth_token';

/**
 * Get auth token from localStorage
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

/**
 * Helper function for API calls
 */
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const authHeaders = getAuthHeaders();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid - redirect to login
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_roles');
        localStorage.removeItem('auth_log_id');
        window.location.href = '/login';
      }
      throw new Error('Nicht authentifiziert');
    }
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// =============================================================================
// Connection
// =============================================================================

/**
 * Test connection to Paperless-ngx
 */
export async function getConnectionStatus(): Promise<PaperlessConnectionStatus> {
  return fetchApi<PaperlessConnectionStatus>(`${API_BASE}/status`);
}

// =============================================================================
// Document Operations
// =============================================================================

/**
 * Upload a document to Paperless
 */
export async function uploadDocument(params: PaperlessUploadParams): Promise<PaperlessUploadResponse> {
  const formData = new FormData();
  formData.append('file', params.file);

  if (params.title) formData.append('title', params.title);
  if (params.correspondent_id) formData.append('correspondent_id', String(params.correspondent_id));
  if (params.document_type_id) formData.append('document_type_id', String(params.document_type_id));
  if (params.tag_ids && params.tag_ids.length > 0) {
    formData.append('tag_ids', params.tag_ids.join(','));
  }
  if (params.erp_order_id) formData.append('erp_order_id', String(params.erp_order_id));
  if (params.erp_order_number) formData.append('erp_order_number', params.erp_order_number);
  if (params.erp_article_id) formData.append('erp_article_id', String(params.erp_article_id));
  if (params.erp_article_number) formData.append('erp_article_number', params.erp_article_number);
  if (params.erp_order_article_id) formData.append('erp_order_article_id', String(params.erp_order_article_id));
  if (params.erp_bom_item_id) formData.append('erp_bom_item_id', String(params.erp_bom_item_id));
  if (params.erp_operation_id) formData.append('erp_operation_id', String(params.erp_operation_id));

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${errorText}`);
  }

  return response.json();
}

/**
 * Get a document by ID
 */
export async function getDocument(documentId: number): Promise<PaperlessDocument> {
  return fetchApi<PaperlessDocument>(`${API_BASE}/documents/${documentId}`);
}

/**
 * Search documents
 */
export async function searchDocuments(params: PaperlessSearchParams): Promise<PaperlessDocumentListResponse> {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.append('q', params.q);
  if (params.correspondent_id) searchParams.append('correspondent_id', String(params.correspondent_id));
  if (params.document_type_id) searchParams.append('document_type_id', String(params.document_type_id));
  if (params.tag_ids && params.tag_ids.length > 0) {
    searchParams.append('tag_ids', params.tag_ids.join(','));
  }
  if (params.erp_order_id) searchParams.append('erp_order_id', String(params.erp_order_id));
  if (params.erp_article_id) searchParams.append('erp_article_id', String(params.erp_article_id));
  if (params.page) searchParams.append('page', String(params.page));
  if (params.page_size) searchParams.append('page_size', String(params.page_size));

  return fetchApi<PaperlessDocumentListResponse>(`${API_BASE}/documents?${searchParams.toString()}`);
}

// =============================================================================
// Documents by Entity
// =============================================================================

/**
 * Get documents for an order
 */
export async function getOrderDocuments(orderId: number): Promise<PaperlessDocumentListResponse> {
  return fetchApi<PaperlessDocumentListResponse>(`${API_BASE}/orders/${orderId}/documents`);
}

/**
 * Get documents for an article
 */
export async function getArticleDocuments(articleId: number): Promise<PaperlessDocumentListResponse> {
  return fetchApi<PaperlessDocumentListResponse>(`${API_BASE}/articles/${articleId}/documents`);
}

/**
 * Get documents for an order article
 */
export async function getOrderArticleDocuments(orderArticleId: number): Promise<PaperlessDocumentListResponse> {
  return fetchApi<PaperlessDocumentListResponse>(`${API_BASE}/order-articles/${orderArticleId}/documents`);
}

/**
 * Get documents for a BOM item
 */
export async function getBomItemDocuments(bomItemId: number): Promise<PaperlessDocumentListResponse> {
  return fetchApi<PaperlessDocumentListResponse>(`${API_BASE}/bom-items/${bomItemId}/documents`);
}

/**
 * Get documents for an operation
 */
export async function getOperationDocuments(operationId: number): Promise<PaperlessDocumentListResponse> {
  return fetchApi<PaperlessDocumentListResponse>(`${API_BASE}/operations/${operationId}/documents`);
}

// =============================================================================
// Metadata
// =============================================================================

/**
 * Get all correspondents
 */
export async function getCorrespondents(): Promise<PaperlessCorrespondent[]> {
  return fetchApi<PaperlessCorrespondent[]>(`${API_BASE}/correspondents`);
}

/**
 * Get all document types
 */
export async function getDocumentTypes(): Promise<PaperlessDocumentType[]> {
  return fetchApi<PaperlessDocumentType[]>(`${API_BASE}/document-types`);
}

/**
 * Get all tags
 */
export async function getTags(): Promise<PaperlessTag[]> {
  return fetchApi<PaperlessTag[]>(`${API_BASE}/tags`);
}

/**
 * Get all custom fields
 */
export async function getCustomFields(): Promise<PaperlessCustomField[]> {
  return fetchApi<PaperlessCustomField[]>(`${API_BASE}/custom-fields`);
}

/**
 * Setup ERP custom fields in Paperless
 */
export async function setupErpFields(): Promise<PaperlessCustomField[]> {
  return fetchApi<PaperlessCustomField[]>(`${API_BASE}/setup-erp-fields`, {
    method: 'POST',
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get file icon based on filename
 */
export function getFileIcon(filename: string | null): string {
  if (!filename) return '📄';

  const ext = filename.toLowerCase().split('.').pop() || '';

  const iconMap: Record<string, string> = {
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    xls: '📗',
    xlsx: '📗',
    ppt: '📙',
    pptx: '📙',
    txt: '📝',
    csv: '📊',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    zip: '📦',
    rar: '📦',
  };

  return iconMap[ext] || '📄';
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Open document in Paperless UI
 */
export function openInPaperless(documentId: number): void {
  // Paperless URL from config would be better, but for now use relative
  window.open(`/api/paperless/documents/${documentId}`, '_blank');
}
