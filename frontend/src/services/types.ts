/**
 * TypeScript Types
 */

export interface Project {
  id: number
  au_nr: string
  project_path?: string
  created_at: string
  updated_at?: string
}

export interface Article {
  id: number
  project_id: number
  pos_nr?: number
  hg_artikelnummer?: string
  benennung?: string
  konfiguration?: string
  teilenummer?: string
  menge: number
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
