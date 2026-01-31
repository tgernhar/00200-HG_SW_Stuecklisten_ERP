/**
 * Stücklisten Search Bar Component
 * Provides search filters with autocomplete for Warengruppe and Artikelnummer
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  getMaterialgroupsAutocomplete,
  getArticlesAutocomplete,
  MaterialgroupOption,
  ArticleOption
} from '../../services/stuecklistenApi'

interface StuecklistenSearchBarProps {
  onSearch: (filters: {
    materialgroup_id?: number
    articlenumber?: string
    is_sub?: boolean
  }) => void
  onClear: () => void
}

const styles = {
  container: {
    padding: '10px',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #cccccc'
  },
  row: {
    display: 'flex',
    gap: '15px',
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const,
    marginBottom: '10px'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const
  },
  label: {
    fontSize: '11px',
    color: '#666666',
    marginBottom: '3px'
  },
  input: {
    padding: '4px 8px',
    border: '1px solid #cccccc',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    width: '200px'
  },
  select: {
    padding: '4px 8px',
    border: '1px solid #cccccc',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    width: '200px',
    backgroundColor: '#ffffff'
  },
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #cccccc',
    borderTop: 'none',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    zIndex: 1000
  },
  dropdownItem: {
    padding: '6px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    borderBottom: '1px solid #eeeeee'
  },
  dropdownItemHover: {
    backgroundColor: '#e8f4fc'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px'
  },
  button: {
    padding: '5px 15px',
    border: '1px solid #cccccc',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif'
  },
  buttonHover: {
    backgroundColor: '#e0e0e0'
  }
}

export default function StuecklistenSearchBar({ onSearch, onClear }: StuecklistenSearchBarProps) {
  // Warengruppe state
  const [materialgroupSearch, setMaterialgroupSearch] = useState('')
  const [materialgroupOptions, setMaterialgroupOptions] = useState<MaterialgroupOption[]>([])
  const [selectedMaterialgroup, setSelectedMaterialgroup] = useState<MaterialgroupOption | null>(null)
  const [showMaterialgroupDropdown, setShowMaterialgroupDropdown] = useState(false)
  const [hoveredMaterialgroupIdx, setHoveredMaterialgroupIdx] = useState(-1)
  
  // Artikelnummer state
  const [articlenumberSearch, setArticlenumberSearch] = useState('')
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([])
  const [selectedArticle, setSelectedArticle] = useState<ArticleOption | null>(null)
  const [showArticleDropdown, setShowArticleDropdown] = useState(false)
  const [hoveredArticleIdx, setHoveredArticleIdx] = useState(-1)
  
  // Other filters
  const [isSub, setIsSub] = useState(false)
  
  // Refs for click outside
  const materialgroupRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  
  // Button hover state
  const [searchHover, setSearchHover] = useState(false)
  const [clearHover, setClearHover] = useState(false)
  
  // Debounce timers
  const materialgroupTimerRef = useRef<NodeJS.Timeout>()
  const articleTimerRef = useRef<NodeJS.Timeout>()
  
  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (materialgroupRef.current && !materialgroupRef.current.contains(e.target as Node)) {
        setShowMaterialgroupDropdown(false)
      }
      if (articleRef.current && !articleRef.current.contains(e.target as Node)) {
        setShowArticleDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Warengruppe search handler
  const handleMaterialgroupSearch = useCallback(async (value: string) => {
    setMaterialgroupSearch(value)
    setSelectedMaterialgroup(null)
    
    if (value.length >= 2) {
      if (materialgroupTimerRef.current) clearTimeout(materialgroupTimerRef.current)
      materialgroupTimerRef.current = setTimeout(async () => {
        try {
          const results = await getMaterialgroupsAutocomplete(value)
          setMaterialgroupOptions(results)
          setShowMaterialgroupDropdown(true)
          
          // Auto-select if exact match
          const exactMatch = results.find(r => r.name.toLowerCase() === value.toLowerCase())
          if (exactMatch && results.length === 1) {
            setSelectedMaterialgroup(exactMatch)
            setMaterialgroupSearch(exactMatch.name)
            setShowMaterialgroupDropdown(false)
          }
        } catch (error) {
          console.error('Error fetching materialgroups:', error)
        }
      }, 300)
    } else {
      setShowMaterialgroupDropdown(false)
    }
  }, [])
  
  // Artikelnummer search handler
  const handleArticleSearch = useCallback(async (value: string) => {
    setArticlenumberSearch(value)
    setSelectedArticle(null)
    
    if (value.length >= 2) {
      if (articleTimerRef.current) clearTimeout(articleTimerRef.current)
      articleTimerRef.current = setTimeout(async () => {
        try {
          const results = await getArticlesAutocomplete(value, selectedMaterialgroup?.id)
          setArticleOptions(results)
          setShowArticleDropdown(true)
          
          // Auto-select if exact match
          const exactMatch = results.find(r => r.articlenumber.toLowerCase() === value.toLowerCase())
          if (exactMatch && results.length === 1) {
            setSelectedArticle(exactMatch)
            setArticlenumberSearch(exactMatch.articlenumber)
            setShowArticleDropdown(false)
          }
        } catch (error) {
          console.error('Error fetching articles:', error)
        }
      }, 300)
    } else {
      setShowArticleDropdown(false)
    }
  }, [selectedMaterialgroup])
  
  // Select handlers
  const handleSelectMaterialgroup = (option: MaterialgroupOption) => {
    setSelectedMaterialgroup(option)
    setMaterialgroupSearch(option.name)
    setShowMaterialgroupDropdown(false)
  }
  
  const handleSelectArticle = (option: ArticleOption) => {
    setSelectedArticle(option)
    setArticlenumberSearch(option.articlenumber)
    setShowArticleDropdown(false)
  }
  
  // Search button handler
  const handleSearch = () => {
    onSearch({
      materialgroup_id: selectedMaterialgroup?.id,
      articlenumber: articlenumberSearch || undefined,
      is_sub: isSub || undefined
    })
  }
  
  // Clear button handler
  const handleClear = () => {
    setMaterialgroupSearch('')
    setSelectedMaterialgroup(null)
    setMaterialgroupOptions([])
    setArticlenumberSearch('')
    setSelectedArticle(null)
    setArticleOptions([])
    setIsSub(false)
    onClear()
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.row}>
        {/* Warengruppe */}
        <div style={styles.fieldGroup} ref={materialgroupRef}>
          <span style={styles.label}>Warengruppe</span>
          <input
            type="text"
            style={styles.input}
            value={materialgroupSearch}
            onChange={e => handleMaterialgroupSearch(e.target.value)}
            placeholder="Suchen..."
          />
          {showMaterialgroupDropdown && materialgroupOptions.length > 0 && (
            <div style={styles.dropdown}>
              {materialgroupOptions.map((option, idx) => (
                <div
                  key={option.id}
                  style={{
                    ...styles.dropdownItem,
                    ...(hoveredMaterialgroupIdx === idx ? styles.dropdownItemHover : {})
                  }}
                  onClick={() => handleSelectMaterialgroup(option)}
                  onMouseEnter={() => setHoveredMaterialgroupIdx(idx)}
                  onMouseLeave={() => setHoveredMaterialgroupIdx(-1)}
                >
                  {option.name}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Warengruppe Listbox */}
        <div style={styles.fieldGroup}>
          <span style={styles.label}>&nbsp;</span>
          <select
            style={styles.select}
            value={selectedMaterialgroup?.id || ''}
            onChange={e => {
              const opt = materialgroupOptions.find(o => o.id === Number(e.target.value))
              if (opt) handleSelectMaterialgroup(opt)
            }}
          >
            <option value=""></option>
            {materialgroupOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>
        
        {/* Artikel-Nr */}
        <div style={styles.fieldGroup} ref={articleRef}>
          <span style={styles.label}>Artikel-Nr</span>
          <input
            type="text"
            style={styles.input}
            value={articlenumberSearch}
            onChange={e => handleArticleSearch(e.target.value)}
            placeholder="Suchen..."
          />
          {showArticleDropdown && articleOptions.length > 0 && (
            <div style={styles.dropdown}>
              {articleOptions.map((option, idx) => (
                <div
                  key={option.id}
                  style={{
                    ...styles.dropdownItem,
                    ...(hoveredArticleIdx === idx ? styles.dropdownItemHover : {})
                  }}
                  onClick={() => handleSelectArticle(option)}
                  onMouseEnter={() => setHoveredArticleIdx(idx)}
                  onMouseLeave={() => setHoveredArticleIdx(-1)}
                >
                  {option.articlenumber}{option.index ? `-${option.index}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Artikel-Nr Listbox */}
        <div style={styles.fieldGroup}>
          <span style={styles.label}>&nbsp;</span>
          <select
            style={styles.select}
            value={selectedArticle?.id || ''}
            onChange={e => {
              const opt = articleOptions.find(o => o.id === Number(e.target.value))
              if (opt) handleSelectArticle(opt)
            }}
          >
            <option value=""></option>
            {articleOptions.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.articlenumber}{opt.index ? `-${opt.index}` : ''}
              </option>
            ))}
          </select>
        </div>
        
        {/* Unterartikel-Suche */}
        <div style={{ ...styles.fieldGroup, justifyContent: 'flex-end' }}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={isSub}
              onChange={e => setIsSub(e.target.checked)}
            />
            Unterartikel-Suche
          </label>
        </div>
        
        {/* INT-VER-Faktor */}
        <div style={styles.fieldGroup}>
          <span style={styles.label}>INT-VER-Faktor</span>
          <select style={styles.select}>
            <option value="">Bitte wählen</option>
          </select>
        </div>
      </div>
      
      <div style={styles.row}>
        <button
          style={{
            ...styles.button,
            ...(searchHover ? styles.buttonHover : {})
          }}
          onClick={handleSearch}
          onMouseEnter={() => setSearchHover(true)}
          onMouseLeave={() => setSearchHover(false)}
        >
          Suchen
        </button>
        <button
          style={{
            ...styles.button,
            ...(clearHover ? styles.buttonHover : {})
          }}
          onClick={handleClear}
          onMouseEnter={() => setClearHover(true)}
          onMouseLeave={() => setClearHover(false)}
        >
          Leeren
        </button>
      </div>
    </div>
  )
}
