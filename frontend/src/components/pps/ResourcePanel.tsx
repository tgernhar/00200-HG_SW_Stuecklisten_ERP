/**
 * Resource Panel - Sidebar for filtering by resources
 * 
 * Shows departments, machines, and employees with checkboxes
 * for filtering the Gantt chart
 */
import React, { useState, useMemo } from 'react'
import { PPSResource, ResourceType } from '../../services/ppsTypes'

interface ResourcePanelProps {
  resources: PPSResource[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  resourceLevelFilter: number
  onLevelChange: (level: number) => void
}

const styles = {
  container: {
    padding: '10px',
  },
  header: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    marginBottom: '10px',
    color: '#333333',
  },
  levelSelect: {
    width: '100%',
    padding: '6px 8px',
    marginBottom: '10px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '11px',
    boxSizing: 'border-box' as const,
    backgroundColor: '#ffffff',
    cursor: 'pointer',
  },
  searchInput: {
    width: '100%',
    padding: '6px 8px',
    marginBottom: '10px',
    border: '1px solid #cccccc',
    borderRadius: '3px',
    fontSize: '11px',
    boxSizing: 'border-box' as const,
  },
  selectAll: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '10px',
    paddingBottom: '10px',
    borderBottom: '1px solid #dddddd',
    fontSize: '12px',
    cursor: 'pointer',
  },
  section: {
    marginBottom: '15px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#555555',
    marginBottom: '6px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  sectionIcon: {
    fontSize: '10px',
    color: '#888888',
  },
  resourceList: {
    marginLeft: '16px',
  },
  resourceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#333333',
    padding: '3px 0',
    cursor: 'pointer',
  },
  resourceName: {
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    maxWidth: '150px',
  },
  checkbox: {
    cursor: 'pointer',
  },
  noResources: {
    fontSize: '11px',
    color: '#999999',
    fontStyle: 'italic' as const,
    marginLeft: '16px',
  },
}

export default function ResourcePanel({
  resources,
  selectedIds,
  onSelectionChange,
  resourceLevelFilter,
  onLevelChange,
}: ResourcePanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<ResourceType>>(
    new Set(['department', 'machine', 'employee'])
  )
  const [searchText, setSearchText] = useState('')

  // Filter resources by search text
  const filteredResources = useMemo(() => {
    if (!searchText.trim()) return resources
    const lower = searchText.toLowerCase()
    return resources.filter(r => r.name.toLowerCase().includes(lower))
  }, [resources, searchText])

  // Get selected department erp_ids for filtering machines/employees
  const selectedDeptErpIds = useMemo(() => {
    return new Set(
      filteredResources
        .filter(r => r.resource_type === 'department' && selectedIds.includes(r.id))
        .map(r => r.erp_id)
    )
  }, [filteredResources, selectedIds])

  // Group filtered resources by type - with department filter for machines/employees
  const groupedResources = useMemo(() => {
    const grouped: Record<ResourceType, PPSResource[]> = {
      department: [],
      machine: [],
      employee: [],
    }
    
    filteredResources.forEach(r => {
      if (r.resource_type === 'department') {
        // Departments are always shown
        grouped.department.push(r)
      } else if (r.resource_type === 'machine' || r.resource_type === 'employee') {
        // Machines/Employees: Only show if no department selected OR erp_department_id matches
        if (selectedDeptErpIds.size === 0 || 
            (r.erp_department_id && selectedDeptErpIds.has(r.erp_department_id))) {
          grouped[r.resource_type].push(r)
        }
      }
    })
    
    return grouped
  }, [filteredResources, selectedDeptErpIds])

  // Toggle section expand/collapse
  const toggleSection = (type: ResourceType) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  // Toggle single resource
  const toggleResource = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id]
    onSelectionChange(next)
  }

  // Toggle all in section
  const toggleSectionResources = (type: ResourceType) => {
    const sectionIds = groupedResources[type].map(r => r.id)
    const allSelected = sectionIds.every(id => selectedIds.includes(id))
    
    if (allSelected) {
      // Deselect all in section
      onSelectionChange(selectedIds.filter(id => !sectionIds.includes(id)))
    } else {
      // Select all in section
      const newIds = new Set([...selectedIds, ...sectionIds])
      onSelectionChange(Array.from(newIds))
    }
  }

  // Select/deselect all (filtered)
  const toggleAll = () => {
    const filteredIds = filteredResources.map(r => r.id)
    const allFilteredSelected = filteredIds.every(id => selectedIds.includes(id))
    
    if (allFilteredSelected) {
      // Deselect all filtered
      onSelectionChange(selectedIds.filter(id => !filteredIds.includes(id)))
    } else {
      // Select all filtered
      const newIds = new Set([...selectedIds, ...filteredIds])
      onSelectionChange(Array.from(newIds))
    }
  }

  const allSelected = filteredResources.length > 0 && 
    filteredResources.every(r => selectedIds.includes(r.id))

  const renderSection = (type: ResourceType, label: string) => {
    const items = groupedResources[type]
    const isExpanded = expandedSections.has(type)
    const sectionIds = items.map(r => r.id)
    const allSectionSelected = sectionIds.length > 0 && sectionIds.every(id => selectedIds.includes(id))
    const someSectionSelected = sectionIds.some(id => selectedIds.includes(id))
    
    return (
      <div style={styles.section} key={type}>
        <div 
          style={styles.sectionHeader}
          onClick={() => toggleSection(type)}
        >
          <span style={styles.sectionIcon}>{isExpanded ? '▼' : '►'}</span>
          <input
            type="checkbox"
            checked={allSectionSelected}
            ref={input => {
              if (input) {
                input.indeterminate = someSectionSelected && !allSectionSelected
              }
            }}
            onChange={(e) => {
              e.stopPropagation()
              toggleSectionResources(type)
            }}
            style={styles.checkbox}
          />
          <span>{label} ({items.length})</span>
        </div>
        
        {isExpanded && (
          <div style={styles.resourceList}>
            {items.length === 0 ? (
              <div style={styles.noResources}>Keine {label}</div>
            ) : (
              items.map(resource => (
                <label key={resource.id} style={styles.resourceItem}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(resource.id)}
                    onChange={() => toggleResource(resource.id)}
                    style={styles.checkbox}
                  />
                  <span style={styles.resourceName} title={resource.name}>
                    {resource.name}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Ressourcen Filter</div>
      
      {/* Level filter for machines */}
      <select
        value={resourceLevelFilter}
        onChange={e => onLevelChange(Number(e.target.value))}
        style={styles.levelSelect}
        title="Maschinen-Level Filter (filtert nach Wichtigkeit)"
      >
        <option value={1}>Level 1 (CNC-Hauptmaschinen)</option>
        <option value={2}>Level 2 (Konstruktion/Haupt)</option>
        <option value={3}>Level 3 (Standard)</option>
        <option value={4}>Level 4 (Selten)</option>
        <option value={5}>Level 5 (Alle Maschinen)</option>
      </select>
      
      {/* Search input */}
      <input
        type="text"
        placeholder="Suchen..."
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={styles.searchInput}
      />
      
      <label style={styles.selectAll}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={input => {
            if (input) {
              const someFilteredSelected = filteredResources.some(r => selectedIds.includes(r.id))
              input.indeterminate = someFilteredSelected && !allSelected
            }
          }}
          onChange={toggleAll}
          style={styles.checkbox}
        />
        <span>Alle ({filteredResources.length})</span>
      </label>
      
      {renderSection('department', 'Abteilungen')}
      {renderSection('machine', 'Maschinen')}
      {renderSection('employee', 'Mitarbeiter')}
    </div>
  )
}
