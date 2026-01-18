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
  hugwawi_article_id: number
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
