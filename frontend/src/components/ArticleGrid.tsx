/**
 * Article Grid Component (AG Grid)
 */
import React, { useMemo, useCallback, useRef } from 'react'
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
  const gridApiRef = useRef<any>(null)
  const gridColumnApiRef = useRef<any>(null)
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
  ], [articleNumberCellRenderer, makeDocRenderer, parseOptionalNumber])

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
    suppressRowClickSelection: false,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    enterNavigatesVertically: false,
    enterNavigatesVerticallyAfterEdit: false,
    rowHeight: 35,
    headerHeight: 120, // Erhöht für 90° gedrehte Überschriften in Block B
    onCellValueChanged: onCellValueChanged,

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

  return (
    <div style={{ width: '100%', height: '100%' }} onKeyDownCapture={handleKeyDownCapture}>
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
