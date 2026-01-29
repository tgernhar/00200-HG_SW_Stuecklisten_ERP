/**
 * Paperless-ngx TypeScript Types
 */

export interface PaperlessDocument {
  id: number;
  title: string;
  content: string | null;
  created: string | null;
  modified: string | null;
  added: string | null;
  archive_serial_number: number | null;
  original_file_name: string | null;
  correspondent_id: number | null;
  correspondent_name: string | null;
  document_type_id: number | null;
  document_type_name: string | null;
  tags: number[];
  tag_names: string[];
  custom_fields: Record<string, unknown>;
  download_url: string | null;
  original_download_url: string | null;
  thumbnail_url: string | null;
}

export interface PaperlessDocumentListResponse {
  items: PaperlessDocument[];
  total: number;
}

export interface PaperlessUploadResponse {
  success: boolean;
  task_id: string | null;
  message: string | null;
}

export interface PaperlessCorrespondent {
  id: number;
  name: string;
  document_count: number;
}

export interface PaperlessDocumentType {
  id: number;
  name: string;
  document_count: number;
}

export interface PaperlessTag {
  id: number;
  name: string;
  color: string | null;
  document_count: number;
}

export interface PaperlessCustomField {
  id: number;
  name: string;
  data_type: string;
}

export interface PaperlessConnectionStatus {
  connected: boolean;
  url: string;
  message: string | null;
}

export interface PaperlessUploadParams {
  file: File;
  title?: string;
  correspondent_id?: number;
  document_type_id?: number;
  tag_ids?: number[];
  erp_order_id?: number;
  erp_order_number?: string;
  erp_article_id?: number;
  erp_article_number?: string;
  erp_order_article_id?: number;
  erp_bom_item_id?: number;
  erp_operation_id?: number;
}

export interface PaperlessSearchParams {
  q?: string;
  correspondent_id?: number;
  document_type_id?: number;
  tag_ids?: number[];
  erp_order_id?: number;
  erp_article_id?: number;
  page?: number;
  page_size?: number;
}

/**
 * Entity types that can have Paperless documents attached
 */
export type PaperlessEntityType =
  | 'order'
  | 'article'
  | 'order_article'
  | 'bom_item'
  | 'operation';
