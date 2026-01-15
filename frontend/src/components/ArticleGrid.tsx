/**
 * Article Grid Component (AG Grid)
 */
import React, { useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, ColGroupDef, ICellRendererParams } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Article } from '../services/types'
import { DocumentStatusRenderer } from './DocumentStatus'
import api from '../services/api'

interface ArticleGridProps {
  articles: Article[]
  onCellValueChanged?: (params: any) => void
}

export const ArticleGrid: React.FC<ArticleGridProps> = ({ articles, onCellValueChanged }) => {
  const apiBaseUrl = (api as any)?.defaults?.baseURL || ''
  const makeDocRenderer = useCallback(
    (opts: {
      existsField?: keyof Article
      pathField?: keyof Article
      openMode?: 'openPdf' | 'openSwDir'
    }) =>
      (params: ICellRendererParams<Article>) => {
        const data = params.data as any
        return React.createElement(DocumentStatusRenderer, {
          value: params.value as any,
          exists: opts.existsField ? (data?.[opts.existsField] as boolean | undefined) : undefined,
          filePath: opts.pathField ? (data?.[opts.pathField] as string | undefined) : undefined,
          openMode: opts.openMode,
          solidworksPath: data?.sldasm_sldprt_pfad,
          apiBaseUrl
        })
      },
    [apiBaseUrl]
  )

  // Article Number Cell Renderer (für ERP-Abgleich-Farbe)
  const articleNumberCellRenderer = useCallback((params: ICellRendererParams) => {
    const style: React.CSSProperties = {
      padding: '5px',
      width: '100%',
      height: '100%'
    }
    
    if (params.data?.erp_exists === true) {
      style.backgroundColor = '#90EE90'
    } else if (params.data?.erp_exists === false) {
      style.backgroundColor = '#FFB6C1'
    }
    
    return React.createElement('div', { style }, params.value || '')
  }, [])

  // Column Definitions
  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => [
    // Block A: Bestellinformationen
    {
      headerName: 'Bestellinformationen',
      children: [
        { field: 'hg_bnr', headerName: 'HG-BNR', width: 120, editable: false },
        { field: 'bnr_status', headerName: 'BNR-Status', width: 100, editable: false },
        { field: 'bnr_menge', headerName: 'BNR-Menge', width: 90, editable: false },
        { field: 'bestellkommentar', headerName: 'Bestellkommentar', width: 200, editable: false },
        { field: 'hg_lt', headerName: 'HG-LT', width: 100, editable: false },
        { field: 'bestaetigter_lt', headerName: 'Bestätigter LT', width: 120, editable: false }
      ]
    },
    // Block B: Dokumentstatus
    {
      headerName: 'Dokumentstatus',
      headerClass: 'rotated-header-group',
      children: [
        { field: 'pdf_drucken', headerName: 'PDF Drucken', width: 80, editable: true, headerClass: 'rotated-header' },
        { field: 'pdf_format', headerName: 'PDF Format', width: 85, editable: false, headerClass: 'rotated-header' },
        { 
          field: 'pdf', 
          headerName: 'PDF', 
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: true, 
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'pdf_exists', pathField: 'pdf_path', openMode: 'openPdf' })
        },
        {
          field: 'pdf_bestell_pdf',
          headerName: 'Bestell_PDF',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'pdf_bestell_pdf_exists', pathField: 'pdf_bestell_pdf_path', openMode: 'openPdf' })
        },
        {
          field: 'dxf',
          headerName: 'DXF',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'dxf_exists', pathField: 'dxf_path', openMode: 'openSwDir' })
        },
        {
          field: 'bestell_dxf',
          headerName: 'Bestell_DXF',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'bestell_dxf_exists', pathField: 'bestell_dxf_path', openMode: 'openSwDir' })
        },
        {
          field: 'sw_part_asm',
          headerName: 'SW_Part_ASM',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: false,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'sw_part_asm_exists', pathField: 'sw_part_asm_path', openMode: 'openSwDir' })
        },
        {
          field: 'sw_drw',
          headerName: 'SW_DRW',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: false,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'sw_drw_exists', pathField: 'sw_drw_path', openMode: 'openSwDir' })
        },
        {
          field: 'step',
          headerName: 'STEP',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'step_exists', pathField: 'step_path', openMode: 'openSwDir' })
        },
        {
          field: 'x_t',
          headerName: 'X_T',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'x_t_exists', pathField: 'x_t_path', openMode: 'openSwDir' })
        },
        {
          field: 'stl',
          headerName: 'STL',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'stl_exists', pathField: 'stl_path', openMode: 'openSwDir' })
        },
        {
          field: 'esp',
          headerName: 'ESP',
          width: 65,
          minWidth: 55,
          maxWidth: 75,
          editable: false,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'esp_exists', pathField: 'esp_path', openMode: 'openSwDir' })
        },
        { field: 'bn_ab', headerName: 'BN-AB', width: 100, editable: true, headerClass: 'rotated-header' }
      ]
    },
    // Block C: Stücklisteninformationen
    {
      headerName: 'Stücklisteninformationen',
      children: [
        { field: 'pos_nr', headerName: 'Pos-Nr', width: 80, editable: false },
        { 
          field: 'hg_artikelnummer', 
          headerName: 'H+G Artikelnummer', 
          width: 150, 
          editable: false,
          cellRenderer: articleNumberCellRenderer
        },
        { field: 'benennung', headerName: 'BENENNUNG', width: 200, editable: false },
        { field: 'konfiguration', headerName: 'Konfiguration', width: 150, editable: false },
        { field: 'teilenummer', headerName: 'Teilenummer', width: 120, editable: false },
        { field: 'menge', headerName: 'Menge', width: 80, editable: false },
        { field: 'teiletyp_fertigungsplan', headerName: 'Teiletyp/Fertigungsplan', width: 180, editable: true, maxLength: 150 },
        { field: 'abteilung_lieferant', headerName: 'Abteilung / Lieferant', width: 150, editable: true, maxLength: 150 },
        { field: 'werkstoff', headerName: 'Werkstoff', width: 120, editable: true, maxLength: 150 },
        { field: 'werkstoff_nr', headerName: 'Werkstoff-Nr.', width: 120, editable: true, maxLength: 150 },
        { field: 'oberflaeche', headerName: 'Oberfläche', width: 120, editable: true, maxLength: 150 },
        { field: 'oberflaechenschutz', headerName: 'Oberflächenschutz', width: 150, editable: true, maxLength: 150 },
        { field: 'farbe', headerName: 'Farbe', width: 100, editable: true, maxLength: 150 },
        { field: 'lieferzeit', headerName: 'Lieferzeit', width: 100, editable: true, maxLength: 150 },
        { field: 'laenge', headerName: 'Länge', width: 100, editable: true },
        { field: 'breite', headerName: 'Breite', width: 100, editable: true },
        { field: 'hoehe', headerName: 'Höhe', width: 100, editable: true },
        { field: 'gewicht', headerName: 'Gewicht', width: 100, editable: true },
        { field: 'pfad', headerName: 'Pfad', width: 300, editable: false },
        { field: 'sldasm_sldprt_pfad', headerName: 'SLDASM/SLDPRT Pfad', width: 300, editable: false },
        { field: 'slddrw_pfad', headerName: 'SLDDRW Pfad', width: 300, editable: false },
        { field: 'in_stueckliste_anzeigen', headerName: 'In Stückliste anzeigen', width: 120, editable: true, cellRenderer: 'agCheckboxCellRenderer' }
      ]
    }
  ], [])

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    minWidth: 80
  }), [])

  const gridOptions = {
    domLayout: 'normal',
    suppressHorizontalScroll: false,
    alwaysShowHorizontalScroll: true,
    enableRangeSelection: true,
    enableClipboard: true,
    enableCellTextSelection: true,
    suppressRowClickSelection: false,
    rowHeight: 35,
    headerHeight: 120, // Erhöht für 90° gedrehte Überschriften in Block B
    onCellValueChanged: onCellValueChanged
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
        <AgGridReact
          rowData={articles}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
        />
      </div>
      <style>{`
        .rotated-header {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }
        .rotated-header-group {
          height: 120px;
        }
      `}</style>
    </div>
  )
}
