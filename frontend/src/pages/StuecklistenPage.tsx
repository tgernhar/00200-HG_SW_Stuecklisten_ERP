/**
 * Stücklisten Page
 * Main page for the Stücklisten module with split-view layout
 */
import React, { useState, useCallback } from 'react'
import StuecklistenSearchBar from '../components/stuecklisten/StuecklistenSearchBar'
import StuecklistenTable from '../components/stuecklisten/StuecklistenTable'
import BomContentTable from '../components/stuecklisten/BomContentTable'
import {
  searchStuecklisten,
  getBomContent,
  StuecklisteItem,
  BomContentItem
} from '../services/stuecklistenApi'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '8px 15px',
    backgroundColor: '#f0f0f0',
    borderBottom: '1px solid #cccccc'
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const
  },
  tabs: {
    display: 'flex',
    gap: '5px'
  },
  tab: {
    padding: '5px 15px',
    border: '1px solid #cccccc',
    borderBottom: 'none',
    backgroundColor: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '12px'
  },
  tabActive: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #ffffff',
    marginBottom: '-1px'
  },
  searchSection: {
    borderBottom: '1px solid #cccccc'
  },
  searchToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer',
    fontSize: '11px'
  },
  splitContainer: {
    display: 'flex',
    flex: 1,
    minHeight: 0
  },
  leftPanel: {
    width: '50%',
    borderRight: '1px solid #999999',
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0
  },
  rightPanel: {
    width: '50%',
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0
  }
}

export default function StuecklistenPage() {
  // State for search
  const [searchExpanded, setSearchExpanded] = useState(true)
  
  // State for data
  const [stuecklistenItems, setStuecklistenItems] = useState<StuecklisteItem[]>([])
  const [bomItems, setBomItems] = useState<BomContentItem[]>([])
  const [selectedItem, setSelectedItem] = useState<StuecklisteItem | null>(null)
  
  // Loading states
  const [loadingStuecklisten, setLoadingStuecklisten] = useState(false)
  const [loadingBom, setLoadingBom] = useState(false)
  
  // Search handler
  const handleSearch = useCallback(async (filters: {
    materialgroup_id?: number
    articlenumber?: string
    is_sub?: boolean
  }) => {
    setLoadingStuecklisten(true)
    setSelectedItem(null)
    setBomItems([])
    
    try {
      const results = await searchStuecklisten(filters)
      setStuecklistenItems(results)
    } catch (error) {
      console.error('Error searching Stücklisten:', error)
      setStuecklistenItems([])
    } finally {
      setLoadingStuecklisten(false)
    }
  }, [])
  
  // Clear handler
  const handleClear = useCallback(() => {
    setStuecklistenItems([])
    setBomItems([])
    setSelectedItem(null)
  }, [])
  
  // Selection handler - load BOM content
  const handleSelectItem = useCallback(async (item: StuecklisteItem) => {
    setSelectedItem(item)
    setLoadingBom(true)
    
    try {
      const results = await getBomContent(item.packingnote_id)
      setBomItems(results)
    } catch (error) {
      console.error('Error loading BOM content:', error)
      setBomItems([])
    } finally {
      setLoadingBom(false)
    }
  }, [])
  
  return (
    <div style={styles.container}>
      {/* Header with tabs */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Stücklisten</span>
        <div style={styles.tabs}>
          <div style={{ ...styles.tab, ...styles.tabActive }}>
            Stücklisten
          </div>
        </div>
      </div>
      
      {/* Search section */}
      <div style={styles.searchSection}>
        <div
          style={styles.searchToggle}
          onClick={() => setSearchExpanded(!searchExpanded)}
        >
          <span>{searchExpanded ? '▼' : '►'}</span>
          <span>Suchen</span>
        </div>
        
        {searchExpanded && (
          <StuecklistenSearchBar
            onSearch={handleSearch}
            onClear={handleClear}
          />
        )}
      </div>
      
      {/* Split view */}
      <div style={styles.splitContainer}>
        {/* Left panel - Stücklisten list */}
        <div style={styles.leftPanel}>
          <StuecklistenTable
            items={stuecklistenItems}
            selectedItem={selectedItem}
            onSelect={handleSelectItem}
            loading={loadingStuecklisten}
          />
        </div>
        
        {/* Right panel - BOM content */}
        <div style={styles.rightPanel}>
          <BomContentTable
            items={bomItems}
            loading={loadingBom}
            parentArticleDisplay={selectedItem?.article_display}
          />
        </div>
      </div>
    </div>
  )
}
