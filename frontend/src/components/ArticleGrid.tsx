/**
 * Article Grid Component (AG Grid)
 */
import React, { useMemo, useCallback, useRef, useState } from 'react'
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
  onCellValueChanged?: (params: any) => void
  onOpenOrders?: (article: Article) => void
  onSelectionChanged?: (selected: Article[]) => void
  onAfterBulkUpdate?: () => void
}

export const ArticleGrid: React.FC<ArticleGridProps> = ({ articles, projectId, onCellValueChanged, onOpenOrders, onSelectionChanged, onAfterBulkUpdate }) => {
  const apiBaseUrl = (api as any)?.defaults?.baseURL || ''
  const gridApiRef = useRef<any>(null)
  const gridColumnApiRef = useRef<any>(null)
  const [showHidden, setShowHidden] = useState(false)
  // #region agent log
  const _agentLog = useCallback((location: string, message: string, data: any) => {
    try {
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run3',
          hypothesisId: 'UI_FILTER',
          location,
          message,
          data,
          timestamp: Date.now()
        })
      }).catch(() => {})
    } catch {}
  }, [])
  // #endregion agent log
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
        { field: 'bnr_status', headerName: 'BNR-Status', width: 100, editable: false },
        { field: 'bnr_menge', headerName: 'BNR-Menge', width: 90, editable: false },
        { field: 'bestellkommentar', headerName: 'Bestellkommentar', width: 200, editable: false },
        { field: 'hg_lt', headerName: 'HG-LT', width: 100, editable: false },
        { field: 'bestaetigter_lt', headerName: 'Bestätigter LT', width: 120, editable: false },
        {
          headerName: 'Bestellungen',
          width: 110,
          editable: false,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams<Article>) => {
            const a = params.data
            const disabled = !a || !onOpenOrders
            return React.createElement(
              'button',
              {
                disabled,
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
                  background: disabled ? '#f3f3f3' : '#fff',
                  cursor: disabled ? 'not-allowed' : 'pointer'
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
        { field: 'pdf_drucken', headerName: 'PDF Drucken', width: 45, editable: true, headerClass: 'rotated-header' },
        { field: 'pdf_format', headerName: 'PDF Format', width: 45, editable: false, headerClass: 'rotated-header' },
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
        { field: 'bn_ab', headerName: 'BN-AB', width: 50, editable: true, headerClass: 'rotated-header' }
      ]
    },
    // Block C: Stücklisteninformationen
    {
      headerName: 'Stücklisteninformationen',
      children: [
        { field: 'pos_nr_display', headerName: 'Pos-Nr', width: 80, editable: false },
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
        { field: 'menge', headerName: 'Menge (SW)', width: 90, editable: false, hide: true },
        { field: 'p_menge', headerName: 'P-Menge', width: 90, editable: true, valueParser: (p) => parseOptionalInt(p.newValue) },
        { field: 'teiletyp_fertigungsplan', headerName: 'Teiletyp/Fertigungsplan', width: 180, editable: true, maxLength: 150 },
        { field: 'abteilung_lieferant', headerName: 'Abteilung / Lieferant', width: 150, editable: true, maxLength: 150 },
        { field: 'werkstoff', headerName: 'Werkstoff', width: 120, editable: true, maxLength: 150 },
        { field: 'werkstoff_nr', headerName: 'Werkstoff-Nr.', width: 120, editable: true, maxLength: 150 },
        { field: 'oberflaeche', headerName: 'Oberfläche', width: 120, editable: true, maxLength: 150 },
        { field: 'oberflaechenschutz', headerName: 'Oberflächenschutz', width: 150, editable: true, maxLength: 150 },
        { field: 'farbe', headerName: 'Farbe', width: 100, editable: true, maxLength: 150 },
        { field: 'lieferzeit', headerName: 'Lieferzeit', width: 100, editable: true, maxLength: 150 },
        { field: 'laenge', headerName: 'Länge', width: 100, editable: true, valueParser: (p) => parseOptionalNumber(p.newValue) },
        { field: 'breite', headerName: 'Breite', width: 100, editable: true, valueParser: (p) => parseOptionalNumber(p.newValue) },
        { field: 'hoehe', headerName: 'Höhe', width: 100, editable: true, valueParser: (p) => parseOptionalNumber(p.newValue) },
        { field: 'gewicht', headerName: 'Gewicht', width: 100, editable: true, valueParser: (p) => parseOptionalNumber(p.newValue) },
        { field: 'pfad', headerName: 'Pfad', width: 300, editable: false },
        { field: 'sldasm_sldprt_pfad', headerName: 'SLDASM/SLDPRT Pfad', width: 300, editable: false },
        { field: 'slddrw_pfad', headerName: 'SLDDRW Pfad', width: 300, editable: false },
        { field: 'in_stueckliste_anzeigen', headerName: 'In Stückliste anzeigen', width: 120, editable: true, cellRenderer: 'agCheckboxCellRenderer' }
      ]
    }
  ], [articleNumberCellRenderer, makeDocRenderer, parseOptionalInt, parseOptionalNumber, onOpenOrders])

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
      const resp = await api.post(`/projects/${pid}/push-solidworks`, { article_ids: articleIds })
      const d = resp?.data || {}
      const failed = Array.isArray(d.failed) ? d.failed : []
      const msg =
        `SOLIDWORKS Rückschreiben abgeschlossen:\n` +
        `Erfolgreich: ${d.updated_count ?? '-'}\n` +
        `Fehler: ${d.failed_count ?? '-'}\n` +
        (failed.length ? `\nErster Fehler: ${JSON.stringify(failed[0])}` : '')
      alert(msg)
    } catch (e: any) {
      alert('Fehler beim Rückschreiben: ' + (e.response?.data?.detail || e.message))
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

  // #region agent log
  const rowData = useMemo(() => {
    const list = Array.isArray(articles) ? articles : []
    const hiddenCount = list.filter((a: any) => a?.in_stueckliste_anzeigen === false).length
    const out = showHidden ? list : list.filter(a => (a as any)?.in_stueckliste_anzeigen !== false)
    _agentLog('ArticleGrid.tsx:rowData', 'computed', {
      projectId,
      showHidden,
      total: list.length,
      hiddenCount,
      shown: out.length
    })
    return out
  }, [articles, showHidden, projectId, _agentLog])
  // #endregion agent log

  return (
    <div style={{ width: '100%', height: '100%' }} onKeyDownCapture={handleKeyDownCapture}>
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
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => {
              const v = !!e.target.checked
              setShowHidden(v)
              // #region agent log
              _agentLog('ArticleGrid.tsx:showHidden', 'toggle', { projectId, value: v })
              // #endregion agent log
            }}
          />
          Ausgeblendete anzeigen
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
