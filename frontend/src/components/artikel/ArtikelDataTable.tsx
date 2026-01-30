/**
 * ArtikelDataTable Component
 * Wiederverwendbare Tabellenkomponente für Artikel und Warengruppen Suche.
 */
import React, { useState, useCallback, useRef, useMemo } from 'react'
import {
  searchArticles,
  searchMaterialgroups,
  ArticleItem,
  MaterialgroupItem,
  ArticleFilters,
  MaterialgroupFilters
} from '../../services/artikelApi'

type TableMode = 'articles' | 'materialgroups'

interface ArtikelDataTableProps {
  mode: TableMode
  pageTitle: string
  onArticleSelect?: (articleId: number) => void
  selectedArticleId?: number | null
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: '16px 20px',
    backgroundColor: 'white',
    borderBottom: '1px solid #ddd',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#333',
  },
  filterSection: {
    padding: '12px 20px',
    backgroundColor: 'white',
    borderBottom: '1px solid #ddd',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '8px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  filterLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 500,
  },
  filterInput: {
    padding: '5px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    minWidth: '120px',
    height: '26px',
  },
  filterCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  filterButton: {
    padding: '8px 16px',
    backgroundColor: '#4a90d9',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  filterButtonSecondary: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  tableContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '0 20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
    fontSize: '13px',
  },
  th: {
    position: 'sticky',
    top: 0,
    backgroundColor: '#f8f8f8',
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '2px solid #ddd',
    fontWeight: 600,
    color: '#333',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #eee',
    verticalAlign: 'top',
  },
  tdText: {
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    backgroundColor: 'white',
    borderTop: '1px solid #ddd',
  },
  paginationInfo: {
    fontSize: '13px',
    color: '#666',
  },
  paginationButtons: {
    display: 'flex',
    gap: '8px',
  },
  paginationButton: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#666',
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
  },
  initialMessage: {
    textAlign: 'center',
    padding: '60px 40px',
    color: '#666',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    margin: '20px',
  },
  warningMessage: {
    textAlign: 'center',
    padding: '20px',
    color: '#856404',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeeba',
    borderRadius: '4px',
    margin: '10px 20px',
  },
  rowHover: {
    backgroundColor: '#f5f9ff',
  },
  rowSelected: {
    backgroundColor: '#e3f2fd',
  },
  rowClickable: {
    cursor: 'pointer',
  },
  checkboxColumn: {
    width: '40px',
    textAlign: 'center',
  },
  autofilterInput: {
    width: '100%',
    padding: '4px',
    fontSize: '11px',
    border: '1px solid #ccc',
    borderRadius: '3px',
  },
}

export default function ArtikelDataTable({ mode, pageTitle, onArticleSelect, selectedArticleId }: ArtikelDataTableProps) {
  // State for articles mode
  const [articleItems, setArticleItems] = useState<ArticleItem[]>([])
  const [articleFilters, setArticleFilters] = useState<ArticleFilters>({
    page: 1,
    page_size: 10000, // Load all results at once for client-side autofilter
    sort_field: 'articlenumber',
    sort_dir: 'asc',
  })
  const [articleTempFilters, setArticleTempFilters] = useState({
    articlenumber: '',
    index_filter: '',
    barcode: '',
    description: '',
    customer: '',
    din_en_iso: '',
    din_checked: true,
    en_checked: true,
    iso_checked: true,
    eniso_checked: true,
    distributor_articlenumber: '',
    materialgroup_search: '',
    show_inactive: false,
    extended_limit: false,
  })
  const [selectedArticles, setSelectedArticles] = useState<Set<number>>(new Set())

  // State for materialgroups mode
  const [materialgroupItems, setMaterialgroupItems] = useState<MaterialgroupItem[]>([])
  const [materialgroupFilters, setMaterialgroupFilters] = useState<MaterialgroupFilters>({
    page: 1,
    page_size: 10000, // Load all results at once for client-side autofilter
    sort_field: 'name',
    sort_dir: 'asc',
  })
  const [materialgroupTempFilters, setMaterialgroupTempFilters] = useState({
    name: '',
    description: '',
    old_materialgroup: '',
    new_materialgroup: '',
    show_inactive: false,
    show_master_only: false,
  })

  // Column autofilters
  const [articleColumnFilters, setArticleColumnFilters] = useState<Record<string, string>>({
    articlenumber: '',
    index: '',
    materialgroup_name: '',
    description: '',
    customer_name: '',
    sparepart: '',
  })
  const [materialgroupColumnFilters, setMaterialgroupColumnFilters] = useState<Record<string, string>>({
    name: '',
    description: '',
    articlenumberPrefix: '',
    oldmaterialgroupid: '',
  })

  // Common state
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [limitApplied, setLimitApplied] = useState(500)
  const [searchExecuted, setSearchExecuted] = useState(false)
  const [showEmptyFilterWarning, setShowEmptyFilterWarning] = useState(false)

  const loadRequestRef = useRef(0)

  // Check if any search filter is filled (for articles)
  const hasArticleSearchFilters = () => {
    return !!(
      articleTempFilters.articlenumber ||
      articleTempFilters.index_filter ||
      articleTempFilters.barcode ||
      articleTempFilters.description ||
      articleTempFilters.customer ||
      articleTempFilters.din_en_iso ||
      articleTempFilters.distributor_articlenumber ||
      articleTempFilters.materialgroup_search
    )
  }

  // Check if any search filter is filled (for materialgroups)
  const hasMaterialgroupSearchFilters = () => {
    return !!(
      materialgroupTempFilters.name ||
      materialgroupTempFilters.description ||
      materialgroupTempFilters.old_materialgroup ||
      materialgroupTempFilters.new_materialgroup
    )
  }

  // Load data based on mode
  const loadData = useCallback(async (filters: ArticleFilters | MaterialgroupFilters) => {
    const currentRequest = ++loadRequestRef.current
    setLoading(true)

    try {
      if (mode === 'articles') {
        const response = await searchArticles(filters as ArticleFilters)
        if (currentRequest !== loadRequestRef.current) return
        setArticleItems(response.items)
        setTotal(response.total)
        setTotalPages(response.total_pages)
        setLimitApplied(response.limit_applied)
      } else {
        const response = await searchMaterialgroups(filters as MaterialgroupFilters)
        if (currentRequest !== loadRequestRef.current) return
        setMaterialgroupItems(response.items)
        setTotal(response.total)
        setTotalPages(response.total_pages)
      }
    } catch (error) {
      if (currentRequest !== loadRequestRef.current) return
      console.error('Error loading data:', error)
      if (mode === 'articles') {
        setArticleItems([])
      } else {
        setMaterialgroupItems([])
      }
      setTotal(0)
    } finally {
      if (currentRequest === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }, [mode])

  // Search handler for articles
  const handleArticleSearch = () => {
    if (!hasArticleSearchFilters()) {
      setShowEmptyFilterWarning(true)
      return
    }
    setShowEmptyFilterWarning(false)
    setSearchExecuted(true)
    const newFilters: ArticleFilters = {
      ...articleFilters,
      articlenumber: articleTempFilters.articlenumber || undefined,
      index_filter: articleTempFilters.index_filter || undefined,
      barcode: articleTempFilters.barcode || undefined,
      description: articleTempFilters.description || undefined,
      customer: articleTempFilters.customer || undefined,
      din_en_iso: articleTempFilters.din_en_iso || undefined,
      din_checked: articleTempFilters.din_checked,
      en_checked: articleTempFilters.en_checked,
      iso_checked: articleTempFilters.iso_checked,
      eniso_checked: articleTempFilters.eniso_checked,
      distributor_articlenumber: articleTempFilters.distributor_articlenumber || undefined,
      materialgroup_search: articleTempFilters.materialgroup_search || undefined,
      show_inactive: articleTempFilters.show_inactive,
      extended_limit: articleTempFilters.extended_limit,
      page: 1,
    }
    setArticleFilters(newFilters)
    loadData(newFilters)
  }

  // Search handler for materialgroups
  const handleMaterialgroupSearch = () => {
    if (!hasMaterialgroupSearchFilters()) {
      setShowEmptyFilterWarning(true)
      return
    }
    setShowEmptyFilterWarning(false)
    setSearchExecuted(true)
    const newFilters: MaterialgroupFilters = {
      ...materialgroupFilters,
      name: materialgroupTempFilters.name || undefined,
      description: materialgroupTempFilters.description || undefined,
      old_materialgroup: materialgroupTempFilters.old_materialgroup || undefined,
      new_materialgroup: materialgroupTempFilters.new_materialgroup || undefined,
      show_inactive: materialgroupTempFilters.show_inactive,
      show_master_only: materialgroupTempFilters.show_master_only,
      page: 1,
    }
    setMaterialgroupFilters(newFilters)
    loadData(newFilters)
  }

  const handleSearch = () => {
    if (mode === 'articles') {
      handleArticleSearch()
    } else {
      handleMaterialgroupSearch()
    }
  }

  // Reset handler
  const handleReset = () => {
    setShowEmptyFilterWarning(false)
    setSearchExecuted(false)
    if (mode === 'articles') {
      setArticleTempFilters({
        articlenumber: '',
        index_filter: '',
        barcode: '',
        description: '',
        customer: '',
        din_en_iso: '',
        din_checked: true,
        en_checked: true,
        iso_checked: true,
        eniso_checked: true,
        distributor_articlenumber: '',
        materialgroup_search: '',
        show_inactive: false,
        extended_limit: false,
      })
      setArticleFilters({
        page: 1,
        page_size: 10000,
        sort_field: 'articlenumber',
        sort_dir: 'asc',
      })
      setArticleItems([])
      setSelectedArticles(new Set())
      setArticleColumnFilters({
        articlenumber: '',
        index: '',
        materialgroup_name: '',
        description: '',
        customer_name: '',
        sparepart: '',
      })
    } else {
      setMaterialgroupTempFilters({
        name: '',
        description: '',
        old_materialgroup: '',
        new_materialgroup: '',
        show_inactive: false,
        show_master_only: false,
      })
      setMaterialgroupFilters({
        page: 1,
        page_size: 10000,
        sort_field: 'name',
        sort_dir: 'asc',
      })
      setMaterialgroupItems([])
      setMaterialgroupColumnFilters({
        name: '',
        description: '',
        articlenumberPrefix: '',
        oldmaterialgroupid: '',
      })
    }
    setTotal(0)
    setTotalPages(1)
  }

  // Sort handler
  const handleSort = (field: string) => {
    if (!searchExecuted) return
    if (mode === 'articles') {
      const newFilters = {
        ...articleFilters,
        sort_field: field,
        sort_dir: articleFilters.sort_field === field && articleFilters.sort_dir === 'asc' ? 'desc' : 'asc',
        page: 1,
      }
      setArticleFilters(newFilters)
      loadData(newFilters)
    } else {
      const newFilters = {
        ...materialgroupFilters,
        sort_field: field,
        sort_dir: materialgroupFilters.sort_field === field && materialgroupFilters.sort_dir === 'asc' ? 'desc' : 'asc',
        page: 1,
      }
      setMaterialgroupFilters(newFilters)
      loadData(newFilters)
    }
  }

  // Page handler
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || !searchExecuted) return
    if (mode === 'articles') {
      const newFilters = { ...articleFilters, page: newPage }
      setArticleFilters(newFilters)
      loadData(newFilters)
    } else {
      const newFilters = { ...materialgroupFilters, page: newPage }
      setMaterialgroupFilters(newFilters)
      loadData(newFilters)
    }
  }

  // Checkbox handlers for articles
  const handleSelectAll = () => {
    if (selectedArticles.size === filteredArticleItems.length) {
      setSelectedArticles(new Set())
    } else {
      setSelectedArticles(new Set(filteredArticleItems.map(item => item.id)))
    }
  }

  const handleSelectArticle = (id: number) => {
    setSelectedArticles(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Key handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Column filter handlers
  const handleArticleColumnFilterChange = (field: string, value: string) => {
    setArticleColumnFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleMaterialgroupColumnFilterChange = (field: string, value: string) => {
    setMaterialgroupColumnFilters(prev => ({ ...prev, [field]: value }))
  }

  // Filtered items based on column autofilters
  const filteredArticleItems = useMemo(() => {
    return articleItems.filter(item => {
      for (const [key, filterValue] of Object.entries(articleColumnFilters)) {
        if (!filterValue) continue
        const searchTerm = filterValue.toLowerCase()
        let itemValue = ''
        
        switch (key) {
          case 'articlenumber':
            itemValue = item.articlenumber || ''
            break
          case 'index':
            itemValue = item.index || ''
            break
          case 'materialgroup_name':
            itemValue = item.materialgroup_name || ''
            break
          case 'description':
            itemValue = item.description || ''
            break
          case 'customer_name':
            itemValue = item.customer_name || ''
            break
          case 'sparepart':
            itemValue = item.sparepart || ''
            break
        }
        
        if (!itemValue.toLowerCase().includes(searchTerm)) {
          return false
        }
      }
      return true
    })
  }, [articleItems, articleColumnFilters])

  const filteredMaterialgroupItems = useMemo(() => {
    return materialgroupItems.filter(item => {
      for (const [key, filterValue] of Object.entries(materialgroupColumnFilters)) {
        if (!filterValue) continue
        const searchTerm = filterValue.toLowerCase()
        let itemValue = ''
        
        switch (key) {
          case 'name':
            itemValue = item.name || ''
            break
          case 'description':
            itemValue = item.description || ''
            break
          case 'articlenumberPrefix':
            itemValue = item.articlenumberPrefix || ''
            break
          case 'oldmaterialgroupid':
            itemValue = item.oldmaterialgroupid || ''
            break
        }
        
        if (!itemValue.toLowerCase().includes(searchTerm)) {
          return false
        }
      }
      return true
    })
  }, [materialgroupItems, materialgroupColumnFilters])

  // Get sort icon
  const getSortIcon = (field: string) => {
    if (!searchExecuted) return ''
    const currentFilters = mode === 'articles' ? articleFilters : materialgroupFilters
    if (currentFilters.sort_field !== field) return ' ⇅'
    return currentFilters.sort_dir === 'asc' ? ' ▲' : ' ▼'
  }

  const currentPage = mode === 'articles' ? (articleFilters.page || 1) : (materialgroupFilters.page || 1)

  // Render article filters
  const renderArticleFilters = () => (
    <>
      {/* Zeile 1: Artikel-Nr, Index, Beschreibung/Teilenummer, Barcode */}
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Artikel-Nr</label>
          <input
            type="text"
            style={{ ...styles.filterInput, width: '210px' }}
            value={articleTempFilters.articlenumber}
            onChange={e => setArticleTempFilters(prev => ({ ...prev, articlenumber: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Index</label>
          <input
            type="text"
            style={{ ...styles.filterInput, width: '40px', minWidth: '40px' }}
            value={articleTempFilters.index_filter}
            onChange={e => setArticleTempFilters(prev => ({ ...prev, index_filter: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Beschreibung/Teilenummer</label>
          <input
            type="text"
            style={{ ...styles.filterInput, width: '220px' }}
            value={articleTempFilters.description}
            onChange={e => setArticleTempFilters(prev => ({ ...prev, description: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Barcode</label>
          <input
            type="text"
            style={{ ...styles.filterInput, width: '60px', minWidth: '60px' }}
            value={articleTempFilters.barcode}
            onChange={e => setArticleTempFilters(prev => ({ ...prev, barcode: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
      {/* Zeile 2: Warengruppensuche, Kundensuche, Lieferanten Artikel-Nr, DIN/EN/ISO/EN-ISO + Checkboxen */}
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Warengruppensuche</label>
          <input
            type="text"
            style={styles.filterInput}
            value={articleTempFilters.materialgroup_search}
            onChange={e => setArticleTempFilters(prev => ({ ...prev, materialgroup_search: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Kundensuche</label>
          <input
            type="text"
            style={styles.filterInput}
            value={articleTempFilters.customer}
            onChange={e => setArticleTempFilters(prev => ({ ...prev, customer: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Lieferanten Artikel-Nr</label>
          <input
            type="text"
            style={styles.filterInput}
            value={articleTempFilters.distributor_articlenumber}
            onChange={e => setArticleTempFilters(prev => ({ ...prev, distributor_articlenumber: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>DIN/EN/ISO/EN-ISO</label>
          <input
            type="text"
            style={styles.filterInput}
            value={articleTempFilters.din_en_iso}
            onChange={e => setArticleTempFilters(prev => ({ ...prev, din_en_iso: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={{ ...styles.filterGroup, flexDirection: 'row', gap: '10px', alignItems: 'flex-end' }}>
          <label style={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={articleTempFilters.din_checked}
              onChange={e => setArticleTempFilters(prev => ({ ...prev, din_checked: e.target.checked }))}
            />
            DIN
          </label>
          <label style={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={articleTempFilters.en_checked}
              onChange={e => setArticleTempFilters(prev => ({ ...prev, en_checked: e.target.checked }))}
            />
            EN
          </label>
          <label style={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={articleTempFilters.iso_checked}
              onChange={e => setArticleTempFilters(prev => ({ ...prev, iso_checked: e.target.checked }))}
            />
            ISO
          </label>
          <label style={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={articleTempFilters.eniso_checked}
              onChange={e => setArticleTempFilters(prev => ({ ...prev, eniso_checked: e.target.checked }))}
            />
            EN-ISO
          </label>
          <label style={{ ...styles.filterCheckbox, marginLeft: '8px' }}>
            <input
              type="checkbox"
              checked={articleTempFilters.show_inactive}
              onChange={e => setArticleTempFilters(prev => ({ ...prev, show_inactive: e.target.checked }))}
            />
            Zeige Inaktive
          </label>
          <label style={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={articleTempFilters.extended_limit}
              onChange={e => setArticleTempFilters(prev => ({ ...prev, extended_limit: e.target.checked }))}
            />
            Mehr als 500
          </label>
        </div>
      </div>
      {/* Zeile 3: Buttons links */}
      <div style={styles.filterRow}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={styles.filterButton} onClick={handleSearch}>
            Suchen
          </button>
          <button style={styles.filterButtonSecondary} onClick={handleReset}>
            Leeren
          </button>
        </div>
      </div>
    </>
  )

  // Render materialgroup filters
  const renderMaterialgroupFilters = () => (
    <>
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Bezeichnung</label>
          <input
            type="text"
            style={styles.filterInput}
            value={materialgroupTempFilters.name}
            onChange={e => setMaterialgroupTempFilters(prev => ({ ...prev, name: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Beschreibung</label>
          <input
            type="text"
            style={{ ...styles.filterInput, width: '200px' }}
            value={materialgroupTempFilters.description}
            onChange={e => setMaterialgroupTempFilters(prev => ({ ...prev, description: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Alte Warengruppe</label>
          <input
            type="text"
            style={styles.filterInput}
            value={materialgroupTempFilters.old_materialgroup}
            onChange={e => setMaterialgroupTempFilters(prev => ({ ...prev, old_materialgroup: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Neue Warengruppe</label>
          <input
            type="text"
            style={styles.filterInput}
            value={materialgroupTempFilters.new_materialgroup}
            onChange={e => setMaterialgroupTempFilters(prev => ({ ...prev, new_materialgroup: e.target.value }))}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
      <div style={styles.filterRow}>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={materialgroupTempFilters.show_inactive}
            onChange={e => setMaterialgroupTempFilters(prev => ({ ...prev, show_inactive: e.target.checked }))}
          />
          Zeige Inaktive
        </label>
        <label style={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={materialgroupTempFilters.show_master_only}
            onChange={e => setMaterialgroupTempFilters(prev => ({ ...prev, show_master_only: e.target.checked }))}
          />
          Zeige Master
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button style={styles.filterButton} onClick={handleSearch}>
            Suchen
          </button>
          <button style={styles.filterButtonSecondary} onClick={handleReset}>
            Leeren
          </button>
        </div>
      </div>
    </>
  )

  // Render article table
  const renderArticleTable = () => (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={{ ...styles.th, ...styles.checkboxColumn }}>
            <input
              type="checkbox"
              checked={filteredArticleItems.length > 0 && selectedArticles.size === filteredArticleItems.length}
              onChange={handleSelectAll}
            />
          </th>
          <th style={styles.th} onClick={() => handleSort('articlenumber')}>
            Artikel-Nr{getSortIcon('articlenumber')}
          </th>
          <th style={styles.th} onClick={() => handleSort('index')}>
            Index{getSortIcon('index')}
          </th>
          <th style={styles.th} onClick={() => handleSort('materialgroup')}>
            Warengruppe{getSortIcon('materialgroup')}
          </th>
          <th style={styles.th} onClick={() => handleSort('description')}>
            Beschreibung{getSortIcon('description')}
          </th>
          <th style={styles.th} onClick={() => handleSort('customer')}>
            Kunde{getSortIcon('customer')}
          </th>
          <th style={styles.th} onClick={() => handleSort('sparepart')}>
            Teilenummer{getSortIcon('sparepart')}
          </th>
        </tr>
        {/* Autofilter row */}
        <tr style={{ backgroundColor: '#f0f0f0' }}>
          <th style={{ padding: '4px 6px' }}></th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={articleColumnFilters.articlenumber}
              onChange={e => handleArticleColumnFilterChange('articlenumber', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={articleColumnFilters.index}
              onChange={e => handleArticleColumnFilterChange('index', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={articleColumnFilters.materialgroup_name}
              onChange={e => handleArticleColumnFilterChange('materialgroup_name', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={articleColumnFilters.description}
              onChange={e => handleArticleColumnFilterChange('description', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={articleColumnFilters.customer_name}
              onChange={e => handleArticleColumnFilterChange('customer_name', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={articleColumnFilters.sparepart}
              onChange={e => handleArticleColumnFilterChange('sparepart', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
        </tr>
      </thead>
      <tbody>
        {filteredArticleItems.length === 0 ? (
          <tr>
            <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#999', padding: '40px' }}>
              {articleItems.length === 0 ? 'Keine Einträge gefunden' : 'Keine Einträge entsprechen dem Spaltenfilter'}
            </td>
          </tr>
        ) : (
          filteredArticleItems.map(item => {
            const isSelected = selectedArticleId === item.id
            const isHovered = hoveredRow === item.id
            return (
              <tr
                key={item.id}
                onMouseEnter={() => setHoveredRow(item.id)}
                onMouseLeave={() => setHoveredRow(null)}
                onClick={() => onArticleSelect?.(item.id)}
                style={{
                  ...(isSelected ? styles.rowSelected : isHovered ? styles.rowHover : undefined),
                  ...(onArticleSelect ? styles.rowClickable : undefined),
                }}
              >
                <td style={{ ...styles.td, ...styles.checkboxColumn }}>
                  <input
                    type="checkbox"
                    checked={selectedArticles.has(item.id)}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleSelectArticle(item.id)
                    }}
                  />
                </td>
                <td style={styles.td}>{item.articlenumber || '-'}</td>
                <td style={styles.td}>{item.index || '-'}</td>
                <td style={styles.td}>{item.materialgroup_name || '-'}</td>
                <td style={{ ...styles.td, ...styles.tdText }} title={item.description || ''}>
                  {item.description || '-'}
                </td>
                <td style={styles.td}>{item.customer_name || '-'}</td>
                <td style={styles.td}>{item.sparepart || '-'}</td>
              </tr>
            )
          })
        )}
      </tbody>
    </table>
  )

  // Render materialgroup table
  const renderMaterialgroupTable = () => (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th} onClick={() => handleSort('name')}>
            Bezeichnung{getSortIcon('name')}
          </th>
          <th style={styles.th} onClick={() => handleSort('description')}>
            Beschreibung{getSortIcon('description')}
          </th>
          <th style={styles.th} onClick={() => handleSort('new_materialgroup')}>
            Neue Warengruppe{getSortIcon('new_materialgroup')}
          </th>
          <th style={styles.th} onClick={() => handleSort('old_materialgroup')}>
            Alte Warengruppe{getSortIcon('old_materialgroup')}
          </th>
          <th style={styles.th}>
            Generierte Artikel-Nr
          </th>
          <th style={styles.th} onClick={() => handleSort('showarticleindex')}>
            Zeige Artikel-Index{getSortIcon('showarticleindex')}
          </th>
        </tr>
        {/* Autofilter row */}
        <tr style={{ backgroundColor: '#f0f0f0' }}>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={materialgroupColumnFilters.name}
              onChange={e => handleMaterialgroupColumnFilterChange('name', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={materialgroupColumnFilters.description}
              onChange={e => handleMaterialgroupColumnFilterChange('description', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={materialgroupColumnFilters.articlenumberPrefix}
              onChange={e => handleMaterialgroupColumnFilterChange('articlenumberPrefix', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}>
            <input
              type="text"
              placeholder="Filter..."
              value={materialgroupColumnFilters.oldmaterialgroupid}
              onChange={e => handleMaterialgroupColumnFilterChange('oldmaterialgroupid', e.target.value)}
              style={styles.autofilterInput}
              onClick={e => e.stopPropagation()}
            />
          </th>
          <th style={{ padding: '4px 6px' }}></th>
          <th style={{ padding: '4px 6px' }}></th>
        </tr>
      </thead>
      <tbody>
        {filteredMaterialgroupItems.length === 0 ? (
          <tr>
            <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#999', padding: '40px' }}>
              {materialgroupItems.length === 0 ? 'Keine Einträge gefunden' : 'Keine Einträge entsprechen dem Spaltenfilter'}
            </td>
          </tr>
        ) : (
          filteredMaterialgroupItems.map(item => (
            <tr
              key={item.id}
              onMouseEnter={() => setHoveredRow(item.id)}
              onMouseLeave={() => setHoveredRow(null)}
              style={hoveredRow === item.id ? styles.rowHover : undefined}
            >
              <td style={styles.td}>{item.name || '-'}</td>
              <td style={{ ...styles.td, ...styles.tdText }} title={item.description || ''}>
                {item.description || '-'}
              </td>
              <td style={styles.td}>{item.articlenumberPrefix || '-'}</td>
              <td style={styles.td}>{item.oldmaterialgroupid || '-'}</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>
                <input type="checkbox" checked={item.hasgeneratedarticlenumber === 1} disabled />
              </td>
              <td style={{ ...styles.td, textAlign: 'center' }}>
                <input type="checkbox" checked={item.showarticleindex === 1} disabled />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  const items = mode === 'articles' ? filteredArticleItems : filteredMaterialgroupItems
  const rawItems = mode === 'articles' ? articleItems : materialgroupItems

  // Render initial message when no search has been executed
  const renderInitialMessage = () => (
    <div style={styles.initialMessage}>
      <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>
        {mode === 'articles' ? 'Artikel-Suche' : 'Warengruppen-Suche'}
      </h3>
      <p style={{ margin: 0 }}>
        Bitte geben Sie mindestens ein Suchkriterium ein und klicken Sie auf "Suchen".
      </p>
    </div>
  )

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{pageTitle}</h1>
      </div>

      {/* Filter Section */}
      <div style={styles.filterSection}>
        {mode === 'articles' ? renderArticleFilters() : renderMaterialgroupFilters()}
      </div>

      {/* Warning message for empty filters */}
      {showEmptyFilterWarning && (
        <div style={styles.warningMessage}>
          Bitte geben Sie mindestens ein Suchkriterium ein, bevor Sie die Suche starten.
        </div>
      )}

      {/* Table */}
      <div style={{
        ...styles.tableContainer,
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.2s ease',
      }}>
        {loading ? (
          <div style={styles.loading}>Lade Daten...</div>
        ) : !searchExecuted ? (
          renderInitialMessage()
        ) : (
          mode === 'articles' ? renderArticleTable() : renderMaterialgroupTable()
        )}
      </div>

      {/* Status Bar */}
      <div style={styles.pagination}>
        <div style={styles.paginationInfo}>
          {searchExecuted ? (
            <>
              {items.length !== rawItems.length 
                ? `${items.length} von ${rawItems.length} Einträgen angezeigt (Spaltenfilter aktiv)`
                : `${rawItems.length} Einträge gefunden`}
              {mode === 'articles' && ` | Limit: ${limitApplied}`}
              {mode === 'articles' && selectedArticles.size > 0 && ` | ${selectedArticles.size} ausgewählt`}
            </>
          ) : (
            'Bitte Suchkriterien eingeben und "Suchen" klicken'
          )}
          {loading && <span style={{ marginLeft: '10px', color: '#4a90d9' }}>Lade...</span>}
        </div>
        <div style={styles.paginationButtons}>
          {/* Buttons für spätere Funktionen (Export, etc.) */}
        </div>
      </div>
    </div>
  )
}
