/**
 * Article Grid Component (AG Grid)
 */
import React, { useMemo, useCallback, useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, ColGroupDef, ICellRendererParams } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Article } from '../services/types'
import { DocumentStatusRenderer } from './DocumentStatus'
import api from '../services/api'

interface ArticleGridProps {
  articles: Article[]
  projectId?: number | null
  selectedBomId?: number | null
  selectlists?: {
    departments: string[]
    werkstoff: string[]
    werkstoff_nr: string[]
    oberflaeche: string[]
    oberflaechenschutz: string[]
    farbe: string[]
    lieferzeit: string[]
  }
  onCellValueChanged?: (params: any) => void
  onOpenOrders?: (article: Article) => void
  onSelectionChanged?: (selected: Article[]) => void
  onAfterBulkUpdate?: () => void
}

export const ArticleGrid: React.FC<ArticleGridProps> = ({ articles, projectId, selectedBomId, selectlists, onCellValueChanged, onOpenOrders, onSelectionChanged, onAfterBulkUpdate }) => {
  const apiBaseUrl = (api as any)?.defaults?.baseURL || ''
  const gridApiRef = useRef<any>(null)
  const gridColumnApiRef = useRef<any>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [showBestellinfo, setShowBestellinfo] = useState(true)
  const [showDokumentstatus, setShowDokumentstatus] = useState(true)
  const [showMenge, setShowMenge] = useState(false)
  const [writebackOpen, setWritebackOpen] = useState(false)
  const [writebackStatus, setWritebackStatus] = useState<'progress' | 'error' | 'success'>('progress')
  const [writebackMessage, setWritebackMessage] = useState('')
  const [writebackOpenPaths, setWritebackOpenPaths] = useState<string[]>([])

  const rowData = useMemo(() => {
    const list = Array.isArray(articles) ? articles : []
    const out = showHidden ? list : list.filter(a => (a as any)?.in_stueckliste_anzeigen !== false)
    return out
  }, [articles, showHidden])

  const bnrStatusCellStyle = useCallback((params: ICellRendererParams<Article>) => {
    const raw = String(params.value ?? '').trim().toLowerCase()
    if (!raw) return undefined
    if (raw === 'bestellt') return { backgroundColor: '#add8e6' }
    if (raw === 'ab erhalten') return { backgroundColor: '#ffa500' }
    if (raw === 'email versendet') return { backgroundColor: '#ffd700' }
    if (raw === 'geliefert') return { backgroundColor: '#90ee90' }
    return undefined
  }, [])

  const a3BlockCColumns = [
    { field: 'pos_nr_display', label: 'Pos-Nr' },
    { field: 'hg_artikelnummer', label: 'H+G Artikelnummer' },
    { field: 'benennung', label: 'Bezeichnung' },
    { field: 'konfiguration', label: 'Konfiguration' },
    { field: 'teilenummer', label: 'Teilenummer' },
    { field: 'menge', label: 'Menge' },
    { field: 'p_menge', label: 'P-Menge' },
    { field: 'teiletyp_fertigungsplan', label: 'Teiletyp/Fertigungsplan' },
    { field: 'abteilung_lieferant', label: 'Abteilung / Lieferant' },
    { field: 'werkstoff', label: 'Werkstoff' },
    { field: 'werkstoff_nr', label: 'Werkstoff-Nr.' },
    { field: 'oberflaeche', label: 'Oberfläche' },
    { field: 'oberflaechenschutz', label: 'Oberflächenschutz' },
    { field: 'farbe', label: 'Farbe' },
    { field: 'lieferzeit', label: 'Lieferzeit' },
    { field: 'laenge', label: 'Länge' },
    { field: 'breite', label: 'Breite' },
    { field: 'hoehe', label: 'Höhe' },
    { field: 'gewicht', label: 'Gewicht' },
  ]

  const handleExportBlockCA3 = useCallback(() => {
    const rows = rowData || []
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A3 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; font-size: 9px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; vertical-align: top; }
            th { background: #f3f3f3; }
          </style>
        </head>
        <body>
          <h3>Stücklisteninformation (A3 Querformat)</h3>
          <table>
            <thead>
              <tr>
                ${a3BlockCColumns.map((c) => `<th>${c.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((r) => {
                  return `<tr>${a3BlockCColumns
                    .map((c) => {
                      let v = (r as any)?.[c.field]
                      if (typeof v === 'boolean') v = v ? 'x' : ''
                      if (v == null) v = ''
                      return `<td>${String(v)}</td>`
                    })
                    .join('')}</tr>`
                })
                .join('')}
            </tbody>
          </table>
        </body>
      </html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }, [rowData])
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

  const getDirFromPath = useCallback((p?: string): string | undefined => {
    if (!p) return undefined
    const normalized = String(p).replace(/\//g, '\\')
    const idx = normalized.lastIndexOf('\\')
    if (idx <= 0) return undefined
    return normalized.slice(0, idx)
  }, [])

  const toFileUrl = useCallback((path: string): string => {
    const normalized = String(path).replace(/\\/g, '/')
    return `file:///${encodeURI(normalized)}`
  }, [])

  const fallbackCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert(`Pfad kopiert:\n${text}`)
    } catch {
      alert(`Pfad:\n${text}`)
    }
  }, [])

  const handleMouseDownCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const modifier = !!(e.altKey || e.ctrlKey || (e as any).metaKey)
      if (!modifier) return

      const target = e.target as HTMLElement | null
      const cellEl = (target?.closest?.('.ag-cell') as HTMLElement | null) || null
      const rowEl = (target?.closest?.('.ag-row') as HTMLElement | null) || null

      const colId =
        (cellEl?.getAttribute?.('col-id') ||
          cellEl?.getAttribute?.('data-col-id') ||
          null) as string | null

      const rowIdxStr =
        (rowEl?.getAttribute?.('row-index') ||
          rowEl?.getAttribute?.('data-row-index') ||
          null) as string | null

      const rowIndex = rowIdxStr != null ? Number(rowIdxStr) : null

      if (colId !== 'pdf' && colId !== 'dxf') return
      if (rowIndex === null || !Number.isFinite(rowIndex)) return

      const gridApi = gridApiRef.current
      const rowNode = gridApi?.getDisplayedRowAtIndex?.(rowIndex)
      const data = rowNode?.data as any
      if (!data) return

      if (colId === 'pdf') {
        if (!data?.pdf_exists || !data?.pdf_path) return
        const openUrl = `${apiBaseUrl}/documents/open-pdf?path=${encodeURIComponent(String(data.pdf_path))}`
        e.preventDefault()
        e.stopPropagation()
        const win = window.open(openUrl, '_blank')
        if (!win) window.location.assign(openUrl)
        return
      }

      if (colId === 'dxf') {
        if (!data?.dxf_exists) return
        const dir = getDirFromPath(data?.sldasm_sldprt_pfad || data?.sw_part_asm_path || data?.sw_drw_path)
        if (!dir) return
        e.preventDefault()
        e.stopPropagation()
        const win = window.open(toFileUrl(dir), '_blank')
        if (!win) void fallbackCopy(dir)
      }
    },
    [apiBaseUrl, fallbackCopy, getDirFromPath, toFileUrl]
  )

  const FlagCellRenderer = useCallback((params: ICellRendererParams<Article>) => {
    const v = String((params as any)?.value ?? '')
    const isCreate = v === '1'
    const isDone = v === 'x'
    const style: React.CSSProperties = {
      padding: 0,
      fontSize: '12px',
      lineHeight: '13px',
      textAlign: 'center',
      userSelect: 'none',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
    if (isCreate) {
      style.backgroundColor = '#FFD700'
      style.color = '#000'
    } else if (isDone) {
      style.backgroundColor = '#90EE90'
      style.color = '#000'
    }
    return React.createElement('div', { style }, v || '')
  }, [])

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

  const parseOptionalNumber = useCallback((value: any) => {
    if (value === '' || value === null || value === undefined) return null
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }, [])

  const parseOptionalInt = useCallback((value: any) => {
    if (value === '' || value === null || value === undefined) return null
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
    if (!Number.isFinite(n)) return null
    return Math.trunc(n)
  }, [])

  const makeSelectEditorParams = useCallback((values: string[]) => {
    return (params: any) => {
      const current = params?.value ? String(params.value) : ''
      const list = Array.isArray(values) ? values.slice() : []
      if (current && !list.includes(current)) list.push(current)
      return {
        values: list,
        allowTyping: true,
        filterList: true,
        highlightMatch: true,
        cellHeight: 28,
        cellEditorPopup: true
      }
    }
  }, [])

  const SelectlistEditor = useMemo(() => {
    return forwardRef<any, { value?: string; values?: string[]; colDef?: any }>((props, ref) => {
      const [value, setValue] = useState<string>(props.value ?? '')
      const values = Array.isArray(props.values) ? props.values : []
      const listId = `selectlist-${props?.colDef?.field || 'value'}`

      useImperativeHandle(ref, () => ({
        getValue: () => value,
        isPopup: () => true
      }))

      return (
        <div style={{ padding: 6 }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            list={listId}
            autoFocus
            style={{ width: 220, padding: 6 }}
          />
          <datalist id={listId}>
            {values.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
      )
    })
  }, [])

  const deptValues = selectlists?.departments || []
  const werkstoffValues = selectlists?.werkstoff || []
  const werkstoffNrValues = selectlists?.werkstoff_nr || []
  const oberflaecheValues = selectlists?.oberflaeche || []
  const oberflaechenschutzValues = selectlists?.oberflaechenschutz || []
  const farbeValues = selectlists?.farbe || []
  const lieferzeitValues = selectlists?.lieferzeit || []

  const bestellinfoFields = [
    'hg_bnr',
    'bnr_status',
    'bnr_menge',
    'bestellkommentar',
    'hg_lt',
    'bestaetigter_lt',
    'orders_button'
  ]

  const dokumentstatusFields = [
    'pdf_drucken',
    'pdf_format',
    'pdf',
    'pdf_bestell_pdf',
    'dxf',
    'bestell_dxf',
    'sw_part_asm',
    'sw_drw',
    'step',
    'x_t',
    'stl',
    'esp',
    'bn_ab'
  ]

  useEffect(() => {
    const api = gridColumnApiRef.current
    if (!api) return
    api.setColumnsVisible(bestellinfoFields, showBestellinfo)
  }, [showBestellinfo])

  useEffect(() => {
    const api = gridColumnApiRef.current
    if (!api) return
    api.setColumnsVisible(dokumentstatusFields, showDokumentstatus)
  }, [showDokumentstatus])

  useEffect(() => {
    const api = gridColumnApiRef.current
    if (!api) return
    api.setColumnVisible('menge', showMenge)
  }, [showMenge])


  const getDisplayedColumns = useCallback((gridApi: any) => {
    try {
      return (gridApi?.getAllDisplayedColumns?.() || []) as any[]
    } catch {
      return [] as any[]
    }
  }, [])

  const isCellEditable = useCallback((gridApi: any, rowIndex: number, column: any) => {
    try {
      const rowNode = gridApi?.getDisplayedRowAtIndex?.(rowIndex)
      if (!rowNode || !column) return false
      if (typeof column?.isCellEditable === 'function') return !!column.isCellEditable(rowNode)
      // Fallback: some versions expose colDef editable, but that can be function-based; keep conservative.
      return !!column?.getColDef?.()?.editable
    } catch {
      return false
    }
  }, [])

  const findNextEditableCellRowMajor = useCallback(
    (gridApi: any, rowIndex: number, colIndex: number, backwards: boolean) => {
      const columns = getDisplayedColumns(gridApi)
      const rowCount = gridApi?.getDisplayedRowCount?.() ?? 0
      if (!columns.length || !rowCount) return null

      let r = rowIndex
      let c = colIndex

      const step = backwards ? -1 : 1
      while (true) {
        c += step
        if (c >= columns.length) {
          r += 1
          c = 0
        } else if (c < 0) {
          r -= 1
          c = columns.length - 1
        }

        if (r < 0 || r >= rowCount) return null

        const col = columns[c]
        if (isCellEditable(gridApi, r, col)) {
          const colId = col?.getColId?.() ?? col?.getId?.()
          if (!colId) return null
          return { rowIndex: r, colId }
        }
      }
    },
    [getDisplayedColumns, isCellEditable]
  )

  const handleKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const gridApi = gridApiRef.current
      if (!gridApi) return

      const key = e.key
      const isArrow = key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight'
      const isEnter = key === 'Enter'
      if (!isArrow && !isEnter) return

      const editingCells = gridApi.getEditingCells?.() ?? []
      const isEditing = Array.isArray(editingCells) && editingCells.length > 0
      if (!isEditing) {
        return
      }

      const focused = gridApi.getFocusedCell?.()
      const focusedRow = focused?.rowIndex
      const focusedColId = focused?.column?.getColId?.()

      try {
        gridApi.stopEditing?.()
      } catch {}

      // Enter: commit but keep focus on the same cell
      if (isEnter) {
        if (focusedRow != null && focusedColId) {
          try {
            gridApi.setFocusedCell?.(focusedRow, focusedColId)
          } catch {}
        }
        e.preventDefault()
        e.stopPropagation()
        return
      }

      // Arrow: commit + move focus (skip non-editable)
      if (focusedRow == null || !focusedColId) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      const columns = getDisplayedColumns(gridApi)
      const colIndex = columns.findIndex((c: any) => (c?.getColId?.() ?? c?.getId?.()) === focusedColId)
      const currentColIndex = colIndex >= 0 ? colIndex : 0

      if (key === 'ArrowUp' || key === 'ArrowDown') {
        const delta = key === 'ArrowUp' ? -1 : 1
        const rowCount = gridApi?.getDisplayedRowCount?.() ?? 0
        let r = focusedRow
        while (true) {
          r += delta
          if (r < 0 || r >= rowCount) break
          const col = columns[currentColIndex]
          if (isCellEditable(gridApi, r, col)) {
            const colId = col?.getColId?.() ?? col?.getId?.()
            if (colId) gridApi.setFocusedCell?.(r, colId)
            break
          }
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const delta = key === 'ArrowLeft' ? -1 : 1
        let c = currentColIndex
        while (true) {
          c += delta
          if (c < 0 || c >= columns.length) break
          const col = columns[c]
          if (isCellEditable(gridApi, focusedRow, col)) {
            const colId = col?.getColId?.() ?? col?.getId?.()
            if (colId) gridApi.setFocusedCell?.(focusedRow, colId)
            break
          }
        }
      }

      e.preventDefault()
      e.stopPropagation()
    },
    [getDisplayedColumns, isCellEditable]
  )

  // Column Definitions
  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => [
    // Selection (Multi)
    {
      headerName: '',
      field: '__select__',
      width: 42,
      minWidth: 42,
      maxWidth: 42,
      pinned: 'left',
      lockPinned: true,
      resizable: false,
      sortable: false,
      filter: false,
      editable: false,
      suppressSizeToFit: true,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true
    },
    // Block A: Bestellinformationen
    {
      headerName: 'Bestellinformationen',
      children: [
        { field: 'hg_bnr', headerName: 'HG-BNR', width: 120, editable: false },
        { field: 'bnr_status', headerName: 'BNR-Status', width: 100, editable: false, cellStyle: bnrStatusCellStyle },
        { field: 'bnr_menge', headerName: 'BNR-Menge', width: 90, editable: false },
        { field: 'bestellkommentar', headerName: 'Bestellkommentar', width: 200, editable: false },
        { field: 'hg_lt', headerName: 'HG-LT', width: 100, editable: false },
        { field: 'bestaetigter_lt', headerName: 'Bestätigter LT', width: 120, editable: false },
        {
          headerName: 'Bestellungen',
          colId: 'orders_button',
          width: 110,
          editable: false,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams<Article>) => {
            const a = params.data
            const hasOrders = !!(a && (a as any).order_count && (a as any).order_count > 0)
            if (!hasOrders || !onOpenOrders) return null
            return React.createElement(
              'button',
              {
                onClick: (e: any) => {
                  e?.preventDefault?.()
                  e?.stopPropagation?.()
                  if (a && onOpenOrders) onOpenOrders(a)
                },
                style: {
                  padding: '2px 6px',
                  fontSize: '11px',
                  lineHeight: '12px',
                  borderRadius: 6,
                  border: '1px solid #ddd',
                  background: '#fff',
                  cursor: 'pointer'
                }
              },
              'Anzeigen'
            )
          }
        }
      ]
    },
    // Block B: Dokumentstatus
    {
      headerName: 'Dokumentstatus',
      headerClass: 'rotated-header-group',
      children: [
        { field: 'pdf_drucken', headerName: 'PDF Drucken', width: 45, minWidth: 45, maxWidth: 45, editable: true, headerClass: 'rotated-header', cellRenderer: FlagCellRenderer },
        // +~20% width so A3/A4 fits (was 45px).
        { field: 'pdf_format', headerName: 'PDF Format', width: 55, minWidth: 55, maxWidth: 55, editable: false, headerClass: 'rotated-header' },
        { 
          field: 'pdf', 
          headerName: 'PDF', 
          headerTooltip: 'PDF',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: true, 
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'pdf_exists', pathField: 'pdf_path', openMode: 'openPdf' })
        },
        {
          field: 'pdf_bestell_pdf',
          headerName: 'B-PDF',
          headerTooltip: 'Bestell_PDF',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'pdf_bestell_pdf_exists', pathField: 'pdf_bestell_pdf_path', openMode: 'openPdf' })
        },
        {
          field: 'dxf',
          headerName: 'DXF',
          headerTooltip: 'DXF',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'dxf_exists', pathField: 'dxf_path', openMode: 'openSwDir' })
        },
        {
          field: 'bestell_dxf',
          headerName: 'B-DXF',
          headerTooltip: 'Bestell_DXF',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'bestell_dxf_exists', pathField: 'bestell_dxf_path', openMode: 'openSwDir' })
        },
        {
          field: 'sw_part_asm',
          headerName: 'ASM',
          headerTooltip: 'SW_Part_ASM',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: false,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'sw_part_asm_exists', pathField: 'sw_part_asm_path', openMode: 'openSwDir' })
        },
        {
          field: 'sw_drw',
          headerName: 'DRW',
          headerTooltip: 'SW_DRW',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: false,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'sw_drw_exists', pathField: 'sw_drw_path', openMode: 'openSwDir' })
        },
        {
          field: 'step',
          headerName: 'STEP',
          headerTooltip: 'STEP',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'step_exists', pathField: 'step_path', openMode: 'openSwDir' })
        },
        {
          field: 'x_t',
          headerName: 'X_T',
          headerTooltip: 'X_T',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'x_t_exists', pathField: 'x_t_path', openMode: 'openSwDir' })
        },
        {
          field: 'stl',
          headerName: 'STL',
          headerTooltip: 'STL',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: true,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'stl_exists', pathField: 'stl_path', openMode: 'openSwDir' })
        },
        {
          field: 'esp',
          headerName: 'ESP',
          headerTooltip: 'ESP',
          width: 45,
          minWidth: 45,
          maxWidth: 45,
          editable: false,
          headerClass: 'rotated-header',
          cellRenderer: makeDocRenderer({ existsField: 'esp_exists', pathField: 'esp_path', openMode: 'openSwDir' })
        },
        { field: 'bn_ab', headerName: 'BN-AB', width: 45, minWidth: 45, maxWidth: 45, editable: true, headerClass: 'rotated-header' }
      ]
    },
    // Block C: Stücklisteninformationen
    {
      headerName: 'Stücklisteninformationen',
      children: [
        { field: 'pos_nr_display', headerName: 'Pos-Nr', width: 80, editable: false, headerClass: 'rotated-header' },
        { field: 'sw_origin', headerName: 'SW Origin', width: 90, editable: false, cellRenderer: 'agCheckboxCellRenderer' },
        { 
          field: 'hg_artikelnummer', 
          headerName: 'H+G Artikelnummer', 
          width: 260,
          minWidth: 220,
          editable: true,
          cellEditor: 'agTextCellEditor',
          cellRenderer: articleNumberCellRenderer
        },
        { field: 'benennung', headerName: 'Bezeichnung', width: 280, editable: false },
        { field: 'konfiguration', headerName: 'Konfiguration', width: 60, editable: false },
        { field: 'teilenummer', headerName: 'Teilenummer', width: 140, editable: true, cellEditor: 'agTextCellEditor' },
        {
          field: 'menge',
          headerName: 'Menge',
          width: 90,
          editable: false,
          headerClass: 'rotated-header',
          valueGetter: (p) => {
            const v = p?.data?.p_menge
            return v != null ? v : p?.data?.menge
          }
        },
        { field: 'p_menge', headerName: 'P-Menge', width: 90, editable: true, headerClass: 'rotated-header', valueParser: (p) => parseOptionalInt(p.newValue) },
        { field: 'teiletyp_fertigungsplan', headerName: 'Teiletyp/Fertigungsplan', width: 180, editable: true, maxLength: 150 },
        { field: 'abteilung_lieferant', headerName: 'Abteilung / Lieferant', width: 150, editable: true, maxLength: 150, cellEditor: SelectlistEditor, cellEditorParams: makeSelectEditorParams(deptValues), cellRenderer: (params: ICellRendererParams<Article>) => React.createElement('div', null, params.value ?? '') },
        { field: 'werkstoff', headerName: 'Werkstoff-Nr.', width: 120, editable: true, maxLength: 150, cellEditor: SelectlistEditor, cellEditorParams: makeSelectEditorParams(werkstoffValues), cellRenderer: (params: ICellRendererParams<Article>) => React.createElement('div', null, params.value ?? '') },
        { field: 'werkstoff_nr', headerName: 'Werkstoff', width: 120, editable: true, maxLength: 150, cellEditor: SelectlistEditor, cellEditorParams: makeSelectEditorParams(werkstoffNrValues), cellRenderer: (params: ICellRendererParams<Article>) => React.createElement('div', null, params.value ?? '') },
        { field: 'oberflaeche', headerName: 'Oberfläche', width: 120, editable: true, maxLength: 150, cellEditor: SelectlistEditor, cellEditorParams: makeSelectEditorParams(oberflaecheValues), cellRenderer: (params: ICellRendererParams<Article>) => React.createElement('div', null, params.value ?? '') },
        { field: 'oberflaechenschutz', headerName: 'Oberflächenschutz', width: 150, editable: true, maxLength: 150, cellEditor: SelectlistEditor, cellEditorParams: makeSelectEditorParams(oberflaechenschutzValues), cellRenderer: (params: ICellRendererParams<Article>) => React.createElement('div', null, params.value ?? '') },
        { field: 'farbe', headerName: 'Farbe', width: 100, editable: true, maxLength: 150, cellEditor: SelectlistEditor, cellEditorParams: makeSelectEditorParams(farbeValues), cellRenderer: (params: ICellRendererParams<Article>) => React.createElement('div', null, params.value ?? '') },
        { field: 'lieferzeit', headerName: 'Lieferzeit', width: 100, editable: true, maxLength: 150, cellEditor: SelectlistEditor, cellEditorParams: makeSelectEditorParams(lieferzeitValues), cellRenderer: (params: ICellRendererParams<Article>) => React.createElement('div', null, params.value ?? '') },
        { field: 'laenge', headerName: 'Länge', width: 100, editable: true, valueParser: (p) => parseOptionalNumber(p.newValue) },
        { field: 'breite', headerName: 'Breite', width: 100, editable: true, valueParser: (p) => parseOptionalNumber(p.newValue) },
        { field: 'hoehe', headerName: 'Höhe', width: 100, editable: true, valueParser: (p) => parseOptionalNumber(p.newValue) },
        { 
          field: 'gewicht', 
          headerName: 'Gewicht', 
          width: 100, 
          editable: true, 
          valueParser: (p) => parseOptionalNumber(p.newValue),
          valueFormatter: (p) => {
            if (p.value == null || p.value === '') return ''
            const num = Number(p.value)
            if (!Number.isFinite(num)) return ''
            // Runde auf 3 Nachkommastellen, deutsches Komma
            return num.toFixed(3).replace('.', ',')
          }
        },
        { field: 'pfad', headerName: 'Pfad', width: 300, editable: false },
        { field: 'sldasm_sldprt_pfad', headerName: 'SLDASM/SLDPRT Pfad', width: 300, editable: false },
        { field: 'slddrw_pfad', headerName: 'SLDDRW Pfad', width: 300, editable: false },
        { field: 'in_stueckliste_anzeigen', headerName: 'In Stückliste anzeigen', width: 120, editable: true, cellRenderer: 'agCheckboxCellRenderer' }
      ]
    }
  ], [
    articleNumberCellRenderer,
    bnrStatusCellStyle,
    makeDocRenderer,
    makeSelectEditorParams,
    SelectlistEditor,
    parseOptionalInt,
    parseOptionalNumber,
    onOpenOrders,
    deptValues,
    werkstoffValues,
    werkstoffNrValues,
    oberflaecheValues,
    oberflaechenschutzValues,
    farbeValues,
    lieferzeitValues
  ])

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    minWidth: 80
  }), [])

  const gridOptions: any = {
    domLayout: 'normal',
    suppressHorizontalScroll: false,
    alwaysShowHorizontalScroll: true,
    enableRangeSelection: true,
    enableClipboard: true,
    suppressCopySingleCellRanges: false,
    suppressCopyRowsToClipboard: false,
    suppressClipboardPaste: false,
    enableCellTextSelection: true,
    rowSelection: 'multiple',
    suppressRowClickSelection: true,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    enterNavigatesVertically: false,
    enterNavigatesVerticallyAfterEdit: false,
    rowHeight: 26,
    groupHeaderHeight: 40,
    headerHeight: 120, // Spalten-Header hoch genug für rotierte Dokumentstatus-Header
    onCellValueChanged: onCellValueChanged,
    // Allow user to show/hide columns like "Menge (SW)"
    sideBar: 'columns',

    // Skip non-editable cells for Tab / Shift+Tab
    tabToNextCell: (params: any) => {
      const gridApi = params?.api
      const prev = params?.previousCellPosition
      if (!gridApi || !prev) return params?.nextCellPosition

      const columns = getDisplayedColumns(gridApi)
      const colIndex = columns.findIndex((c: any) => (c?.getColId?.() ?? c?.getId?.()) === prev.column?.getColId?.())
      const startColIndex = colIndex >= 0 ? colIndex : 0

      const next = findNextEditableCellRowMajor(gridApi, prev.rowIndex, startColIndex, !!params?.backwards)
      if (!next) return prev
      const nextColumn = gridApi?.getColumn?.(next.colId) ?? next.colId
      return { rowIndex: next.rowIndex, column: nextColumn, rowPinned: prev.rowPinned }
    },

    // Skip non-editable cells for Arrow navigation
    navigateToNextCell: (params: any) => {
      const gridApi = params?.api
      const prev = params?.previousCellPosition
      if (!gridApi || !prev) return params?.nextCellPosition

      const columns = getDisplayedColumns(gridApi)
      const currentColId = prev.column?.getColId?.()
      const colIndex = columns.findIndex((c: any) => (c?.getColId?.() ?? c?.getId?.()) === currentColId)
      const currentColIndex = colIndex >= 0 ? colIndex : 0

      const key = params?.key
      const up = key === 'ArrowUp'
      const down = key === 'ArrowDown'
      const left = key === 'ArrowLeft'
      const right = key === 'ArrowRight'

      // Default to AG Grid if it's not a navigation key
      if (!up && !down && !left && !right) return params?.nextCellPosition

      // Prefer keeping axis: vertical keeps column, horizontal keeps row.
      if (up || down) {
        const delta = up ? -1 : 1
        // Scan rows until an editable cell in same column is found
        const rowCount = gridApi?.getDisplayedRowCount?.() ?? 0
        let r = prev.rowIndex
        while (true) {
          r += delta
          if (r < 0 || r >= rowCount) return prev
          const col = columns[currentColIndex]
          if (isCellEditable(gridApi, r, col)) {
            const colId = col?.getColId?.() ?? col?.getId?.()
            const nextColumn = gridApi?.getColumn?.(colId) ?? colId
            return { rowIndex: r, column: nextColumn, rowPinned: prev.rowPinned }
          }
        }
      }

      if (left || right) {
        const delta = left ? -1 : 1
        let c = currentColIndex
        while (true) {
          c += delta
          if (c < 0 || c >= columns.length) return prev
          const col = columns[c]
          if (isCellEditable(gridApi, prev.rowIndex, col)) {
            const colId = col?.getColId?.() ?? col?.getId?.()
            const nextColumn = gridApi?.getColumn?.(colId) ?? colId
            return { rowIndex: prev.rowIndex, column: nextColumn, rowPinned: prev.rowPinned }
          }
        }
      }

      return params?.nextCellPosition
    },

    // Arrow keys should navigate between cells even while editing: commit, then move.
    suppressKeyboardEvent: (params: any) => {
      const event = params?.event as KeyboardEvent | undefined
      const isEditing = !!params?.editing
      if (!event || !isEditing) return false

      const isArrow =
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'

      if (!isArrow) return false

      // Commit current edit
      try {
        params.api?.stopEditing?.()
      } catch {}

      // Compute next focused cell via the same navigateToNextCell logic.
      const nextPos = (gridOptions as any).navigateToNextCell?.({
        api: params.api,
        key: event.key,
        previousCellPosition: params?.column && params?.node
          ? { rowIndex: params.node.rowIndex, column: params.column, rowPinned: params.node.rowPinned }
          : undefined,
        nextCellPosition: undefined
      })

      try {
        const rowIndex = nextPos?.rowIndex
        const colId = nextPos?.column?.getColId?.() ?? nextPos?.column
        if (rowIndex !== undefined && colId) {
          params.api?.setFocusedCell?.(rowIndex, colId)
        }
      } catch {}

      event.preventDefault()
      return true
    },

    onGridReady: (params: any) => {
      gridApiRef.current = params?.api
      gridColumnApiRef.current = params?.columnApi
      try {
        params?.columnApi?.setColumnsVisible?.(bestellinfoFields, showBestellinfo)
        params?.columnApi?.setColumnsVisible?.(dokumentstatusFields, showDokumentstatus)
      } catch {}
    }
  }

  const handleSelectionChanged = useCallback(() => {
    const gridApi = gridApiRef.current
    const selected = (gridApi?.getSelectedRows?.() || []) as Article[]
    if (onSelectionChanged) onSelectionChanged(selected)
  }, [onSelectionChanged])

  const handlePushSelectedToSolidworks = useCallback(async () => {
    const gridApi = gridApiRef.current
    const pid = projectId ?? null
    if (!pid) {
      alert('Projekt fehlt (projectId)')
      return
    }
    const selected = (gridApi?.getSelectedRows?.() || []) as Article[]
    if (!selected.length) {
      alert('Bitte zuerst Zeilen auswählen.')
      return
    }
    const articleIds = selected.map(a => a.id).filter(Boolean)
    try {
      setWritebackStatus('progress')
      setWritebackMessage('Rückschreiben läuft…')
      setWritebackOpenPaths([])
      setWritebackOpen(true)
      const resp = await api.post(`/projects/${pid}/push-solidworks`, { article_ids: articleIds })
      const d = resp?.data || {}
      const failed = Array.isArray(d.failed) ? d.failed : []
      const msg =
        `SOLIDWORKS Rückschreiben abgeschlossen:\n` +
        `Erfolgreich: ${d.updated_count ?? '-'}\n` +
        `Fehler: ${d.failed_count ?? '-'}\n` +
        (failed.length ? `\nErster Fehler: ${JSON.stringify(failed[0])}` : '')
      setWritebackStatus('success')
      setWritebackMessage('Rückschreiben abgeschlossen.')
      alert(msg)
      setWritebackOpen(false)
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      const openPaths = Array.isArray(detail?.open_paths) ? detail.open_paths : []
      const lockErrors = detail?.lock_errors || {}
      const lockProcesses = detail?.lock_processes || {}
      const openInSw = detail?.open_in_sw || {}
      if (openPaths.length) {
        setWritebackStatus('error')
        setWritebackMessage(
          'Datei bereits geöffnet oder gesperrt. Bitte schließen und erneut versuchen.'
        )
        const decorated = openPaths.map((p: string) => {
          const isOpenInSw = !!openInSw?.[p]
          const err = lockErrors?.[p]
          const procs = Array.isArray(lockProcesses?.[p]) ? lockProcesses[p] : []
          const procStr = procs
            .slice(0, 2)
            .map((pr: any) => `${pr?.name || 'unknown'} (PID ${pr?.pid || '?'})`)
            .join(', ')
          if (isOpenInSw) return `${p} (in SOLIDWORKS geöffnet)`
          if (procStr) return `${p} (Lock: ${procStr})`
          if (err) return `${p} (${err})`
          return p
        })
        setWritebackOpenPaths(decorated)
        setWritebackOpen(true)
        return
      }
      setWritebackStatus('error')
      setWritebackMessage('Fehler beim Rückschreiben.')
      setWritebackOpenPaths([])
      setWritebackOpen(true)
    }
  }, [projectId])

  const handleHideSelection = useCallback(async () => {
    const gridApi = gridApiRef.current
    const selected = (gridApi?.getSelectedRows?.() || []) as Article[]
    if (!selected.length) {
      alert('Bitte zuerst Zeilen auswählen.\nHinweis: Für bereits ausgeblendete Zeilen ggf. erst „Ausgeblendete anzeigen“ aktivieren.')
      return
    }

    const articleIds = selected.map(a => a.id).filter(Boolean) as number[]
    try {
      await api.post(`/articles/batch-update`, { article_ids: articleIds, updates: { in_stueckliste_anzeigen: false } })
      try {
        gridApi?.deselectAll?.()
      } catch {}
      if (onAfterBulkUpdate) onAfterBulkUpdate()
    } catch (e: any) {
      alert('Fehler beim Ausblenden: ' + (e.response?.data?.detail || e.message))
    }
  }, [onAfterBulkUpdate])

  const handleShowSelection = useCallback(async () => {
    const gridApi = gridApiRef.current
    const selected = (gridApi?.getSelectedRows?.() || []) as Article[]
    if (!selected.length) {
      alert('Bitte zuerst Zeilen auswählen.\nHinweis: Für ausgeblendete Zeilen zuerst „Ausgeblendete anzeigen“ aktivieren.')
      return
    }

    const articleIds = selected.map(a => a.id).filter(Boolean) as number[]
    try {
      await api.post(`/articles/batch-update`, { article_ids: articleIds, updates: { in_stueckliste_anzeigen: true } })
      try {
        gridApi?.deselectAll?.()
      } catch {}
      if (onAfterBulkUpdate) onAfterBulkUpdate()
    } catch (e: any) {
      alert('Fehler beim Einblenden: ' + (e.response?.data?.detail || e.message))
    }
  }, [onAfterBulkUpdate])

  return (
    <div style={{ width: '100%', height: '100%' }} onKeyDownCapture={handleKeyDownCapture} onMouseDownCapture={handleMouseDownCapture}>
      {writebackOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div style={{ background: '#fff', padding: 18, width: 520, maxWidth: '90vw', borderRadius: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              SOLIDWORKS Rückschreiben
            </div>
            <div style={{ marginBottom: 10, color: '#444' }}>
              {writebackMessage || 'Bitte warten…'}
            </div>
            {writebackStatus === 'progress' && (
              <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '70%', background: '#4caf50' }} />
              </div>
            )}
            {writebackStatus === 'error' && writebackOpenPaths.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Geöffnete Dateien:</div>
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
                  {writebackOpenPaths.slice(0, 10).map((p) => (
                    <div key={p} style={{ fontSize: 12, color: '#333' }}>
                      {p}
                    </div>
                  ))}
                  {writebackOpenPaths.length > 10 && (
                    <div style={{ fontSize: 12, color: '#666' }}>
                      … und {writebackOpenPaths.length - 10} weitere
                    </div>
                  )}
                </div>
              </div>
            )}
            {writebackStatus !== 'progress' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => setWritebackOpen(false)}>Schließen</button>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '6px 8px', fontSize: '12px' }}>
        <button
          onClick={handlePushSelectedToSolidworks}
          style={{
            padding: '6px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            background: '#f7f7f7',
            cursor: 'pointer'
          }}
        >
          In SOLIDWORKS zurückschreiben (Auswahl)
        </button>
        <button
          onClick={handleHideSelection}
          style={{
            padding: '6px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            background: '#f7f7f7',
            cursor: 'pointer'
          }}
        >
          Auswahl ausblenden
        </button>
        <button
          onClick={handleShowSelection}
          style={{
            padding: '6px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            background: '#f7f7f7',
            cursor: 'pointer'
          }}
        >
          Auswahl einblenden
        </button>
        <button
          onClick={handleExportBlockCA3}
          style={{
            padding: '6px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            background: '#f7f7f7',
            cursor: 'pointer'
          }}
        >
          Export PDF Stückliste
        </button>
        <button
          onClick={async () => {
            if (!projectId) return
            try {
              const resp = await api.post(`/boms/${selectedBomId}/articles/manual`, { pos_nr: null })
              if (resp?.data?.id) {
                onAfterBulkUpdate?.()
              }
            } catch (e: any) {
              alert('Fehler beim Einfügen: ' + (e.response?.data?.detail || e.message))
            }
          }}
          style={{
            padding: '6px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            background: '#f7f7f7',
            cursor: 'pointer'
          }}
        >
          Zeile manuell hinzufügen
        </button>
        <button
          onClick={async () => {
            const gridApi = gridApiRef.current
            const selected = (gridApi?.getSelectedRows?.() || []) as Article[]
            if (!selected.length) {
              alert('Bitte zuerst Zeile(n) auswählen.')
              return
            }
            const pw = prompt('Löschen bestätigen (Passwort: 1):') || ''
            if (pw !== '1') return
            try {
              await Promise.all(
                selected.map((a) =>
                  api.delete(`/articles/${a.id}`, { params: { overwrite_password: pw } })
                )
              )
              onAfterBulkUpdate?.()
            } catch (e: any) {
              alert('Fehler beim Löschen: ' + (e.response?.data?.detail || e.message))
            }
          }}
          style={{
            padding: '6px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            background: '#f7f7f7',
            cursor: 'pointer'
          }}
        >
          Zeilen löschen
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => {
              const v = !!e.target.checked
              setShowHidden(v)
            }}
          />
          Ausgeblendete anzeigen
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={showMenge}
            onChange={(e) => setShowMenge(!!e.target.checked)}
          />
          Menge anzeigen
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={showBestellinfo}
            onChange={(e) => setShowBestellinfo(!!e.target.checked)}
          />
          Bestellinformationen
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={showDokumentstatus}
            onChange={(e) => setShowDokumentstatus(!!e.target.checked)}
          />
          Dokumentstatus
        </label>
        <span style={{ fontWeight: 700 }}>Legende Dokumentenstatus:</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: '#FFD700', border: '1px solid #d1b400', padding: '1px 6px', borderRadius: 3 }}>1</span>
          <span>Dokument erstellen</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: '#FFB6C1', border: '1px solid #e59aa6', padding: '1px 6px', borderRadius: 3 }}>-</span>
          <span>Dokument fehlt</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: '#90EE90', border: '1px solid #6fd66f', padding: '1px 6px', borderRadius: 3 }}>x</span>
          <span>Dokument vorhanden</span>
        </span>
      </div>
      <div className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          onSelectionChanged={handleSelectionChanged}
          onFirstDataRendered={() => {
            try {
              gridColumnApiRef.current?.autoSizeColumn?.('hg_artikelnummer')
            } catch {}
          }}
          onRowDataUpdated={() => {
            try {
              gridColumnApiRef.current?.autoSizeColumn?.('hg_artikelnummer')
            } catch {}
          }}
        />
      </div>
      <style>{`
        .ag-theme-alpine {
          --ag-font-size: 12px;
        }
        .rotated-header {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }
        .rotated-header .ag-header-cell-label {
          justify-content: center;
        }
        .rotated-header .ag-header-cell-text {
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.2px;
        }
        .rotated-header-group {
          height: 40px;
        }
      `}</style>
    </div>
  )
}
