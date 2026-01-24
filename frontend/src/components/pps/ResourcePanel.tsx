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
}: ResourcePanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<ResourceType>>(
    new Set(['department', 'machine', 'employee'])
  )

  // Group resources by type
  const groupedResources = useMemo(() => {
    const grouped: Record<ResourceType, PPSResource[]> = {
      department: [],
      machine: [],
      employee: [],
    }
    
    resources.forEach(r => {
      if (grouped[r.resource_type]) {
        grouped[r.resource_type].push(r)
      }
    })
    
    return grouped
  }, [resources])

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

  // Select/deselect all
  const toggleAll = () => {
    if (selectedIds.length === resources.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(resources.map(r => r.id))
    }
  }

  const allSelected = selectedIds.length === resources.length && resources.length > 0

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
      
      <label style={styles.selectAll}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={input => {
            if (input) {
              input.indeterminate = selectedIds.length > 0 && !allSelected
            }
          }}
          onChange={toggleAll}
          style={styles.checkbox}
        />
        <span>Alle ({resources.length})</span>
      </label>
      
      {renderSection('department', 'Abteilungen')}
      {renderSection('machine', 'Maschinen')}
      {renderSection('employee', 'Mitarbeiter')}
    </div>
  )
}
