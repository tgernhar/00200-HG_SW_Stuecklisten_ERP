/**
 * DMS (Document Management System) TypeScript Types
 */

export interface DMSDocument {
  id: number;
  description: string | null;
  filename: string | null;
  path: string | null;
  uploader_id: number | null;
  uploader_name: string | null;
  upload_time: string | null;
  tag: string | null;
  type_id: number | null;
  type_name: string | null;
  folder_id: number | null;
  folder_name: string | null;
  customer_id: number | null;
  lifecycle: number | null;
  version: number;
  file_exists: boolean;
  is_public: boolean;
  workflow_id: number | null;
  workflow_name: string | null;
  download_url: string | null;
  custom_text1: string | null;
  custom_text2: string | null;
  custom_text3: string | null;
  custom_text4: string | null;
  custom_text5: string | null;
}

export interface DMSDocumentListResponse {
  items: DMSDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface DMSDocumentType {
  id: number;
  name: string;
  path_extension: string | null;
  folder: string | null;
  hash_tag: string | null;
  for_order_attachments: boolean;
}

export interface DMSDocumentTypeListResponse {
  items: DMSDocumentType[];
  total: number;
}

export interface DMSFolder {
  id: number;
  name: string;
  parent_folder_id: number | null;
  search_name: string | null;
}

export interface DMSFolderTreeNode {
  id: number;
  name: string;
  children: DMSFolderTreeNode[];
}

export interface DMSFolderListResponse {
  items: DMSFolder[];
  total: number;
}

export interface DMSDocumentHistoryEntry {
  id: number;
  document_id: number;
  version_date: string | null;
  uploader_id: number | null;
  uploader_name: string | null;
  version: number;
  path: string | null;
}

export interface DMSDocumentHistoryResponse {
  document_id: number;
  entries: DMSDocumentHistoryEntry[];
}

export interface DMSDocumentNote {
  id: number;
  document_id: number;
  text: string | null;
  type: number | null;
  user_id: number | null;
  user_name: string | null;
  created: string | null;
}

export interface DMSDocumentNotesResponse {
  document_id: number;
  notes: DMSDocumentNote[];
}

export interface DMSSearchParams {
  q?: string;
  document_type_id?: number;
  folder_id?: number;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

/**
 * Entity types that can have DMS documents attached
 */
export type DMSEntityType = 
  | 'order'           // ordertable.id
  | 'article'         // article.id (ERP Stammartikel)
  | 'order_article'   // order_article.id
  | 'bom_item'        // packingnote_details.id
  | 'operation'       // workplan_details.id
  | 'customer';       // customer.id
