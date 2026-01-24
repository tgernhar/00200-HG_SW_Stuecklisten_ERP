/**
 * TypeScript Types
 */

export interface Project {
  id: number
  artikel_nr: string
  au_nr?: string
  project_path?: string
  created_at: string
  updated_at?: string
}

export interface Bom {
  id: number
  project_id: number
  hugwawi_order_id?: number
  hugwawi_order_name?: string
  hugwawi_order_article_id?: number
  hugwawi_article_id?: number
  hugwawi_articlenumber?: string
  created_at: string
  updated_at?: string
}

export interface HugwawiOrderArticleItem {
  hugwawi_order_id: number
  hugwawi_order_name: string
  hugwawi_order_reference?: string
  hugwawi_order_article_id: number
  hugwawi_article_id?: number
  hugwawi_articlenumber: string
  hugwawi_description?: string
}

export interface HugwawiBestellartikelTemplate {
  hugwawi_article_id: number
  hugwawi_articlenumber: string
  hugwawi_description?: string
  customtext1?: string
  customtext2?: string
  customtext3?: string
}

export interface Article {
  id: number
  project_id: number
  bom_id?: number
  pos_nr?: number
  pos_nr_display?: string
  pos_sub?: number
  hg_artikelnummer?: string
  benennung?: string
  konfiguration?: string
  teilenummer?: string
  menge: number
  p_menge?: number
  teiletyp_fertigungsplan?: string
  abteilung_lieferant?: string
  werkstoff?: string
  werkstoff_nr?: string
  oberflaeche?: string
  oberflaechenschutz?: string
  farbe?: string
  lieferzeit?: string
  laenge?: number
  breite?: number
  hoehe?: number
  gewicht?: number
  pfad?: string
  sldasm_sldprt_pfad?: string
  slddrw_pfad?: string
  sw_origin: boolean
  in_stueckliste_anzeigen: boolean
  erp_exists?: boolean

  // Block A: Bestellinformationen (aus Order)
  hg_bnr?: string
  bnr_status?: string
  bnr_menge?: number
  bestellkommentar?: string
  hg_lt?: string
  bestaetigter_lt?: string
  order_count?: number
  // Lieferstatus: "none" | "partial" | "complete"
  delivery_status?: string

  // Block B: Dokument-Flags (leer | "1" | "x")
  pdf_drucken?: string
  pdf?: string
  pdf_bestell_pdf?: string
  dxf?: string
  bestell_dxf?: string
  sw_part_asm?: string
  sw_drw?: string
  step?: string
  x_t?: string
  stl?: string
  esp?: string
  bn_ab?: string

  // Zusatzinfos für Renderer
  pdf_exists?: boolean
  pdf_path?: string
  pdf_format?: string

  pdf_bestell_pdf_exists?: boolean
  pdf_bestell_pdf_path?: string

  dxf_exists?: boolean
  dxf_path?: string

  bestell_dxf_exists?: boolean
  bestell_dxf_path?: string

  step_exists?: boolean
  step_path?: string

  x_t_exists?: boolean
  x_t_path?: string

  stl_exists?: boolean
  stl_path?: string

  sw_part_asm_exists?: boolean
  sw_part_asm_path?: string

  sw_drw_exists?: boolean
  sw_drw_path?: string

  esp_exists?: boolean
  esp_path?: string
}

export interface Document {
  id: number
  article_id: number
  document_type: string
  file_path?: string
  exists: boolean
  generated_at?: string
}

export interface Order {
  id: number
  article_id: number
  hg_bnr?: string
  bnr_status?: string
  bnr_menge?: number
  bestellkommentar?: string
  hg_lt?: string
  bestaetigter_lt?: string
}

export interface DeliveryNoteArticle {
  pos: number
  article_number: string
  article_description: string
  amount: number
  note?: string
}

export interface DeliveryNote {
  delivery_note_id: number
  number: string
  delivery_date?: string
  booked_at?: string
  booked_by?: string
  description?: string
  articles: DeliveryNoteArticle[]
}

export interface DeliveryNotesResponse {
  order_name: string
  delivery_notes: DeliveryNote[]
}

// Fertigungsplanung Types

export interface OrderOverviewItem {
  pos: number
  au_verantwortlich: string | null
  lt_hg_bestaetigt: string | null
  auftrag: string | null
  kunde: string | null
  au_text: string | null
  produktionsinfo: string | null
  lt_kundenwunsch: string | null
  technischer_kontakt: string | null
  order_id: number | null
  status_name: string | null
  reference: string | null
}

export interface OrderOverviewResponse {
  items: OrderOverviewItem[]
  total: number
}

export interface OrderArticleItem {
  pos: number | null
  articlenumber: string | null
  description: string | null
  sparepart: string | null
  batchsize: number | null
  status_name: string | null
  order_article_id: number | null
  packingnoteid: number | null
}

export interface OrderArticlesResponse {
  items: OrderArticleItem[]
  total: number
}

export interface BomItem {
  pos: string | null
  articlenumber: string | null
  description: string | null
  cascaded_quantity: number | null
  mass1: number | null
  mass2: number | null
  lft: number | null
  rgt: number | null
  detail_id: number | null
  packingnote_id: number | null
}

export interface BomResponse {
  items: BomItem[]
  total: number
}

export interface WorkplanItem {
  pos: string | null
  workstep_name: string | null
  machine_name: string | null
}

export interface WorkplanResponse {
  items: WorkplanItem[]
  total: number
}
