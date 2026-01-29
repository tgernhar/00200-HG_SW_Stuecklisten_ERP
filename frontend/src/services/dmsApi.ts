/**
 * DMS (Document Management System) API Service
 * 
 * Provides access to HUGWAWI DMS documents.
 */
import {
  DMSDocument,
  DMSDocumentListResponse,
  DMSDocumentType,
  DMSDocumentTypeListResponse,
  DMSFolder,
  DMSFolderListResponse,
  DMSFolderTreeNode,
  DMSDocumentHistoryResponse,
  DMSDocumentNotesResponse,
  DMSSearchParams,
} from './dmsTypes';

const API_BASE = '/api/dms';

/**
 * Helper function for API calls
 */
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }
  
  return response.json();
}

// =============================================================================
// Document Operations
// =============================================================================

/**
 * Get a single document by ID
 */
export async function getDocument(documentId: number): Promise<DMSDocument> {
  return fetchApi<DMSDocument>(`${API_BASE}/documents/${documentId}`);
}

/**
 * Get document download URL
 */
export function getDocumentDownloadUrl(documentId: number): string {
  return `${API_BASE}/documents/${documentId}/download`;
}

/**
 * Download document (opens in new tab or triggers download)
 */
export function downloadDocument(documentId: number): void {
  window.open(getDocumentDownloadUrl(documentId), '_blank');
}

/**
 * Get document version history
 */
export async function getDocumentHistory(documentId: number): Promise<DMSDocumentHistoryResponse> {
  return fetchApi<DMSDocumentHistoryResponse>(`${API_BASE}/documents/${documentId}/history`);
}

/**
 * Get document notes
 */
export async function getDocumentNotes(documentId: number): Promise<DMSDocumentNotesResponse> {
  return fetchApi<DMSDocumentNotesResponse>(`${API_BASE}/documents/${documentId}/notes`);
}

// =============================================================================
// Search
// =============================================================================

/**
 * Search documents with filters
 */
export async function searchDocuments(params: DMSSearchParams): Promise<DMSDocumentListResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.q) searchParams.append('q', params.q);
  if (params.document_type_id) searchParams.append('document_type_id', String(params.document_type_id));
  if (params.folder_id) searchParams.append('folder_id', String(params.folder_id));
  if (params.customer_id) searchParams.append('customer_id', String(params.customer_id));
  if (params.date_from) searchParams.append('date_from', params.date_from);
  if (params.date_to) searchParams.append('date_to', params.date_to);
  if (params.limit) searchParams.append('limit', String(params.limit));
  if (params.offset) searchParams.append('offset', String(params.offset));
  
  return fetchApi<DMSDocumentListResponse>(`${API_BASE}/search?${searchParams.toString()}`);
}

// =============================================================================
// Documents by Entity
// =============================================================================

/**
 * Get documents for an order
 */
export async function getOrderDocuments(orderId: number): Promise<DMSDocumentListResponse> {
  return fetchApi<DMSDocumentListResponse>(`${API_BASE}/orders/${orderId}/documents`);
}

/**
 * Get documents for an article (ERP Stammartikel)
 */
export async function getArticleDocuments(articleId: number): Promise<DMSDocumentListResponse> {
  return fetchApi<DMSDocumentListResponse>(`${API_BASE}/articles/${articleId}/documents`);
}

/**
 * Get documents for an order article
 */
export async function getOrderArticleDocuments(orderArticleId: number): Promise<DMSDocumentListResponse> {
  return fetchApi<DMSDocumentListResponse>(`${API_BASE}/order-articles/${orderArticleId}/documents`);
}

/**
 * Get documents for a BOM item
 */
export async function getBomItemDocuments(packingnoteDetailsId: number): Promise<DMSDocumentListResponse> {
  return fetchApi<DMSDocumentListResponse>(`${API_BASE}/bom-items/${packingnoteDetailsId}/documents`);
}

/**
 * Get documents for an operation
 */
export async function getOperationDocuments(workplanDetailsId: number): Promise<DMSDocumentListResponse> {
  return fetchApi<DMSDocumentListResponse>(`${API_BASE}/operations/${workplanDetailsId}/documents`);
}

/**
 * Get documents for a customer
 */
export async function getCustomerDocuments(customerId: number): Promise<DMSDocumentListResponse> {
  return fetchApi<DMSDocumentListResponse>(`${API_BASE}/customers/${customerId}/documents`);
}

// =============================================================================
// Document Types & Folders
// =============================================================================

/**
 * Get all document types
 */
export async function getDocumentTypes(): Promise<DMSDocumentTypeListResponse> {
  return fetchApi<DMSDocumentTypeListResponse>(`${API_BASE}/types`);
}

/**
 * Get folders (optionally filtered by parent)
 */
export async function getFolders(parentId?: number): Promise<DMSFolderListResponse> {
  const url = parentId 
    ? `${API_BASE}/folders?parent_id=${parentId}`
    : `${API_BASE}/folders`;
  return fetchApi<DMSFolderListResponse>(url);
}

/**
 * Get folder tree structure
 */
export async function getFolderTree(): Promise<DMSFolderTreeNode[]> {
  return fetchApi<DMSFolderTreeNode[]>(`${API_BASE}/folders/tree`);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get file icon based on filename extension
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
    bmp: '🖼️',
    tif: '🖼️',
    tiff: '🖼️',
    zip: '📦',
    rar: '📦',
    '7z': '📦',
    dwg: '📐',
    dxf: '📐',
    stp: '🔧',
    step: '🔧',
    igs: '🔧',
    iges: '🔧',
    sldprt: '🔩',
    sldasm: '🔩',
    slddrw: '📋',
  };
  
  return iconMap[ext] || '📄';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
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
    hour: '2-digit',
    minute: '2-digit',
  });
}
