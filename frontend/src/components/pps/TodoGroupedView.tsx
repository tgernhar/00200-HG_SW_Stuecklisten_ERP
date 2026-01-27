/**
 * TodoGroupedView - Grouped view of todos by order (Auftrag)
 * 
 * Features:
 * - Accordion-style collapsible groups per order
 * - Priority badges showing all priorities in each group
 * - Groups sorted by lowest priority (most urgent first)
 * - Click to expand/collapse, double-click to edit
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { PPSTodoWithERPDetails, PPSResource, TodoStatus } from '../../services/ppsTypes'
import { getEntityImage, EntityImageData } from '../../services/imageApi'

// Status display mapping
const statusLabels: Record<string, string> = {
  new: 'Neu',
  planned: 'Geplant',
  in_progress: 'In Arbeit',
  completed: 'Erledigt',
  blocked: 'Blockiert',
}

// Status color mapping
const statusColors: Record<string, string> = {
  new: '#888888',
  planned: '#4a90d9',
  in_progress: '#f5a623',
  completed: '#7ed321',
  blocked: '#d0021b',
}

// Priority colors (lower number = higher urgency)
const priorityColors: Record<number, string> = {
  1: '#d0021b', // Red - critical
  2: '#f5a623', // Orange - high
  3: '#f8e71c', // Yellow - medium
  4: '#7ed321', // Green - normal
  5: '#50e3c2', // Turquoise - low
}

const styles = {
  container: {
    flex: 1,
    overflow: 'auto',
    padding: '10px',
    backgroundColor: '#f8f9fa',
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    marginBottom: '8px',
    border: '1px solid #e0e0e0',
    overflow: 'visible',
    position: 'relative' as const,
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #e0e0e0',
    gap: '12px',
    userSelect: 'none' as const,
  },
  groupHeaderExpanded: {
    backgroundColor: '#e8f4fd',
    borderBottomColor: '#b3d4fc',
  },
  expandIcon: {
    fontSize: '12px',
    color: '#666666',
    width: '16px',
    transition: 'transform 0.2s',
  },
  orderName: {
    fontWeight: 'bold' as const,
    fontSize: '14px',
    color: '#333333',
    flex: 1,
  },
  todoCount: {
    fontSize: '12px',
    color: '#666666',
    padding: '2px 8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '10px',
  },
  priorityBadges: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  priorityBadge: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 'bold' as const,
  },
  deliveryDate: {
    fontSize: '12px',
    color: '#666666',
  },
  deliveryDateUrgent: {
    color: '#d0021b',
    fontWeight: 'bold' as const,
  },
  headerSeparator: {
    color: '#cccccc',
    fontSize: '14px',
    margin: '0 2px',
  },
  headerInfo: {
    fontSize: '12px',
    color: '#555555',
    whiteSpace: 'nowrap' as const,
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  progressBar: {
    width: '40px',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7ed321',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '11px',
    color: '#666666',
    minWidth: '30px',
  },
  thumbnailContainer: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  thumbnailWrapper: {
    position: 'relative' as const,
    display: 'inline-block',
  },
  thumbnail: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    objectFit: 'cover' as const,
    border: '1px solid #ddd',
    backgroundColor: '#f9f9f9',
    cursor: 'pointer',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  thumbnailHover: {
    borderColor: '#4a90d9',
    boxShadow: '0 0 4px rgba(74, 144, 217, 0.5)',
  },
  thumbnailPreview: {
    position: 'absolute' as const,
    top: '50%',
    left: '100%',
    transform: 'translateY(-30%)',
    marginLeft: '8px',
    zIndex: 9999,
    padding: '6px',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
    border: '1px solid #ddd',
  },
  thumbnailPreviewImage: {
    width: '300px',
    height: '300px',
    objectFit: 'contain' as const,
    borderRadius: '4px',
    display: 'block',
  },
  thumbnailPreviewLabel: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#333',
    textAlign: 'center' as const,
    marginBottom: '4px',
    padding: '2px 4px',
    backgroundColor: '#f5f5f5',
    borderRadius: '3px',
  },
  thumbnailMore: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    backgroundColor: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    color: '#666',
    fontWeight: 'bold' as const,
  },
  thumbnailPlaceholder: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    color: '#bbb',
  },
  groupContent: {
    maxHeight: '0',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease-out',
  },
  groupContentExpanded: {
    maxHeight: '2000px',
    overflow: 'visible',
  },
  todoTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  tableHeader: {
    backgroundColor: '#f9f9f9',
    textAlign: 'left' as const,
    padding: '8px 12px',
    borderBottom: '1px solid #e0e0e0',
    fontWeight: 'bold' as const,
    color: '#555555',
    fontSize: '12px',
  },
  tableRow: {
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  tableRowHover: {
    backgroundColor: '#f5f9ff',
  },
  tableCell: {
    padding: '10px 12px',
    borderBottom: '1px solid #f0f0f0',
    verticalAlign: 'middle' as const,
  },
  statusCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#888888',
    fontSize: '14px',
  },
}

// Priority Badge Component
function PriorityBadge({ priority }: { priority: number }) {
  const color = priorityColors[priority] || '#888888'
  const textColor = priority <= 2 ? '#ffffff' : '#333333'
  
  return (
    <span style={{
      ...styles.priorityBadge,
      backgroundColor: color,
      color: textColor,
    }}>
      {priority}
    </span>
  )
}

// Priority Badges for group header - shows all unique priorities
function PriorityBadges({ priorities }: { priorities: number[] }) {
  return (
    <div style={styles.priorityBadges}>
      {priorities.map(p => (
        <PriorityBadge key={p} priority={p} />
      ))}
    </div>
  )
}

// Group data structure
interface TodoGroup {
  orderName: string
  todos: PPSTodoWithERPDetails[]
  minPriority: number
  priorities: number[]
  totalCount: number
  deliveryDate?: string
  isUrgent: boolean
  // Extended info for compact header
  totalDurationMinutes: number
  nextStart?: string
  completedCount: number
  progressPercent: number
  // Unique article IDs for thumbnail display (max 4)
  articleIds: number[]
  // Map of article ID -> article number for display
  articleNumbers: Map<number, string>
}

// Single thumbnail with hover preview
function ThumbnailWithPreview({ base64, articleNumber }: { base64: string; articleNumber?: string }) {
  const [showPreview, setShowPreview] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div 
      style={styles.thumbnailWrapper}
      onMouseEnter={() => { setShowPreview(true); setIsHovered(true) }}
      onMouseLeave={() => { setShowPreview(false); setIsHovered(false) }}
    >
      <img
        src={`data:image/jpeg;base64,${base64}`}
        style={{
          ...styles.thumbnail,
          ...(isHovered ? styles.thumbnailHover : {}),
        }}
        alt="Artikel"
      />
      
      {showPreview && (
        <div style={styles.thumbnailPreview}>
          {articleNumber && (
            <div style={styles.thumbnailPreviewLabel}>
              {articleNumber}
            </div>
          )}
          <img
            src={`data:image/jpeg;base64,${base64}`}
            style={styles.thumbnailPreviewImage}
            alt="Artikel-Vorschau"
          />
        </div>
      )}
    </div>
  )
}

// Thumbnail images component for group header
function GroupThumbnails({ articleIds, articleNumbers }: { articleIds: number[]; articleNumbers: Map<number, string> }) {
  const [images, setImages] = useState<Map<number, string | null>>(new Map())
  const [loading, setLoading] = useState(true)
  
  const MAX_THUMBNAILS = 7
  const displayIds = articleIds.slice(0, MAX_THUMBNAILS)
  const moreCount = articleIds.length - MAX_THUMBNAILS
  
  useEffect(() => {
    const loadImages = async () => {
      if (displayIds.length === 0) {
        setLoading(false)
        return
      }
      
      const newImages = new Map<number, string | null>()
      
      await Promise.all(
        displayIds.map(async (id) => {
          try {
            const data = await getEntityImage('article', id)
            newImages.set(id, data?.thumbnail_base64 || null)
          } catch {
            newImages.set(id, null)
          }
        })
      )
      
      setImages(newImages)
      setLoading(false)
    }
    
    loadImages()
  }, [displayIds.join(',')])
  
  if (articleIds.length === 0) {
    return null
  }
  
  return (
    <div style={styles.thumbnailContainer}>
      {displayIds.map(id => {
        const base64 = images.get(id)
        const articleNumber = articleNumbers.get(id)
        
        if (loading) {
          return (
            <div key={id} style={styles.thumbnailPlaceholder}>
              ⏳
            </div>
          )
        }
        
        if (base64) {
          return (
            <ThumbnailWithPreview key={id} base64={base64} articleNumber={articleNumber} />
          )
        }
        
        return (
          <div key={id} style={styles.thumbnailPlaceholder} title={articleNumber ? `${articleNumber} (kein Bild)` : `Artikel-ID: ${id} (kein Bild)`}>
            📷
          </div>
        )
      })}
      
      {moreCount > 0 && (
        <div style={styles.thumbnailMore} title={`${moreCount} weitere Artikel`}>
          +{moreCount}
        </div>
      )}
    </div>
  )
}

// Single row thumbnail with lazy loading and hover preview
function TodoRowThumbnail({ articleId, articleNumber }: { articleId?: number; articleNumber?: string }) {
  const [imageData, setImageData] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasImage, setHasImage] = useState(false)
  
  useEffect(() => {
    if (!articleId) {
      setLoading(false)
      return
    }
    
    const loadImage = async () => {
      try {
        const data = await getEntityImage('article', articleId)
        if (data?.thumbnail_base64) {
          setImageData(data.thumbnail_base64)
          setHasImage(true)
        }
      } catch {
        // No image available
      }
      setLoading(false)
    }
    
    loadImage()
  }, [articleId])
  
  // Show article number text, with optional thumbnail
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {articleId && (
        <>
          {loading ? (
            <div style={styles.thumbnailPlaceholder}>⏳</div>
          ) : hasImage && imageData ? (
            <ThumbnailWithPreview base64={imageData} articleNumber={articleNumber} />
          ) : (
            <div style={styles.thumbnailPlaceholder} title={articleNumber || 'Kein Bild'}>📷</div>
          )}
        </>
      )}
      <span>{articleNumber || '-'}</span>
    </div>
  )
}

interface Props {
  todos: PPSTodoWithERPDetails[]
  resources: PPSResource[]
  onTodoDoubleClick: (todo: PPSTodoWithERPDetails) => void
}

export default function TodoGroupedView({ todos, resources, onTodoDoubleClick }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  // Get resource name by ID
  const getResourceName = useCallback((departmentId?: number, machineId?: number, employeeId?: number) => {
    const id = machineId || employeeId || departmentId
    if (!id) return '-'
    const resource = resources.find(r => r.id === id)
    return resource?.name || '-'
  }, [resources])

  // Group todos by order_name and sort by priority
  const groupedTodos = useMemo<TodoGroup[]>(() => {
    const groups = new Map<string, PPSTodoWithERPDetails[]>()
    
    // Group by order_name
    for (const todo of todos) {
      const key = todo.order_name || 'Ohne Auftrag'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(todo)
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const threeDaysFromNow = new Date(today)
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    
    // Build group objects with metadata
    return Array.from(groups.entries())
      .map(([name, groupTodos]) => {
        // Sort todos within group by priority
        const sortedTodos = [...groupTodos].sort((a, b) => a.priority - b.priority)
        const priorities = [...new Set(sortedTodos.map(t => t.priority))].sort((a, b) => a - b)
        
        // Find earliest delivery date
        const deliveryDates = sortedTodos
          .filter(t => t.delivery_date)
          .map(t => new Date(t.delivery_date!))
        const earliestDelivery = deliveryDates.length > 0 
          ? new Date(Math.min(...deliveryDates.map(d => d.getTime())))
          : undefined
        
        // Check if urgent (delivery within 3 days or has priority 1)
        const isUrgent = priorities.includes(1) || 
          (earliestDelivery !== undefined && earliestDelivery <= threeDaysFromNow)
        
        // Calculate total duration
        const totalDurationMinutes = sortedTodos.reduce(
          (sum, t) => sum + (t.total_duration_minutes || 0), 0
        )
        
        // Find next (earliest) start date
        const startDates = sortedTodos
          .filter(t => t.planned_start)
          .map(t => new Date(t.planned_start!))
        const nextStartDate = startDates.length > 0
          ? new Date(Math.min(...startDates.map(d => d.getTime())))
          : undefined
        
        // Calculate progress (completed todos)
        const completedCount = sortedTodos.filter(t => t.status === 'completed').length
        const progressPercent = sortedTodos.length > 0 
          ? Math.round((completedCount / sortedTodos.length) * 100)
          : 0
        
        // Collect unique article IDs and their numbers for thumbnails
        const articleNumbers = new Map<number, string>()
        const articleIds: number[] = []
        
        for (const t of sortedTodos) {
          const id = t.erp_order_article_id || t.erp_packingnote_details_id
          if (id !== undefined && id !== null && !articleNumbers.has(id)) {
            articleIds.push(id)
            // Use order_article_number or bom_article_number
            const artNr = t.order_article_number || t.bom_article_number
            if (artNr) {
              articleNumbers.set(id, artNr)
            }
          }
        }
        
        return {
          orderName: name,
          todos: sortedTodos,
          minPriority: Math.min(...sortedTodos.map(t => t.priority)),
          priorities,
          totalCount: sortedTodos.length,
          deliveryDate: earliestDelivery?.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
          isUrgent,
          totalDurationMinutes,
          nextStart: nextStartDate?.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
          completedCount,
          progressPercent,
          articleIds,
          articleNumbers,
        }
      })
      // Sort groups by lowest priority (most urgent first)
      .sort((a, b) => a.minPriority - b.minPriority)
  }, [todos])

  // Toggle group expansion
  const toggleGroup = useCallback((orderName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(orderName)) {
        next.delete(orderName)
      } else {
        next.add(orderName)
      }
      return next
    })
  }, [])

  // Expand all groups
  const expandAll = useCallback(() => {
    setExpandedGroups(new Set(groupedTodos.map(g => g.orderName)))
  }, [groupedTodos])

  // Collapse all groups
  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set())
  }, [])

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Format duration
  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-'
    const hours = minutes / 60
    return `${hours.toFixed(1).replace('.', ',')} h`
  }

  if (todos.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          Keine ToDos gefunden
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Quick actions */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '12px',
        justifyContent: 'flex-end' 
      }}>
        <button
          onClick={expandAll}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            backgroundColor: '#fff',
            cursor: 'pointer',
          }}
        >
          Alle aufklappen
        </button>
        <button
          onClick={collapseAll}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            backgroundColor: '#fff',
            cursor: 'pointer',
          }}
        >
          Alle zuklappen
        </button>
      </div>

      {/* Grouped cards */}
      {groupedTodos.map(group => {
        const isExpanded = expandedGroups.has(group.orderName)
        
        return (
          <div key={group.orderName} style={styles.groupCard}>
            {/* Group header - compact format with icons */}
            <div
              style={{
                ...styles.groupHeader,
                ...(isExpanded ? styles.groupHeaderExpanded : {}),
              }}
              onClick={() => toggleGroup(group.orderName)}
            >
              <span style={{
                ...styles.expandIcon,
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}>
                ▶
              </span>
              
              <span style={styles.orderName}>
                {group.orderName}
              </span>
              
              {/* Article thumbnails */}
              {group.articleIds.length > 0 && (
                <>
                  <span style={styles.headerSeparator}>│</span>
                  <GroupThumbnails articleIds={group.articleIds} articleNumbers={group.articleNumbers} />
                </>
              )}
              
              <span style={styles.headerSeparator}>│</span>
              
              <span style={styles.todoCount}>
                {group.totalCount} ToDo{group.totalCount !== 1 ? 's' : ''}
              </span>
              
              <span style={styles.headerSeparator}>│</span>
              
              <PriorityBadges priorities={group.priorities} />
              
              <span style={styles.headerSeparator}>│</span>
              
              {/* Total duration */}
              <span style={styles.headerInfo} title="Gesamtdauer">
                ⏱ {(group.totalDurationMinutes / 60).toFixed(1).replace('.', ',')}h
              </span>
              
              <span style={styles.headerSeparator}>│</span>
              
              {/* Next start date */}
              <span style={styles.headerInfo} title="Nächster Start">
                📅 {group.nextStart || '-'}
              </span>
              
              <span style={styles.headerSeparator}>│</span>
              
              {/* Progress bar */}
              <span style={styles.progressContainer} title={`${group.completedCount} von ${group.totalCount} erledigt`}>
                <span style={styles.progressBar}>
                  <span style={{
                    ...styles.progressFill,
                    width: `${group.progressPercent}%`,
                  }} />
                </span>
                <span style={styles.progressText}>{group.progressPercent}%</span>
              </span>
              
              {/* Delivery date */}
              {group.deliveryDate && (
                <>
                  <span style={styles.headerSeparator}>│</span>
                  <span style={{
                    ...styles.headerInfo,
                    ...(group.isUrgent ? styles.deliveryDateUrgent : {}),
                  }} title="Liefertermin">
                    🚚 {group.deliveryDate}
                  </span>
                </>
              )}
            </div>

            {/* Group content */}
            <div style={{
              ...styles.groupContent,
              ...(isExpanded ? styles.groupContentExpanded : {}),
            }}>
              <table style={styles.todoTable}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableHeader, width: '50px' }}>Prio</th>
                    <th style={{ ...styles.tableHeader, width: '30%' }}>Titel</th>
                    <th style={{ ...styles.tableHeader, width: '100px' }}>Status</th>
                    <th style={styles.tableHeader}>Artikel</th>
                    <th style={styles.tableHeader}>Arbeitsgang</th>
                    <th style={{ ...styles.tableHeader, width: '100px' }}>Start</th>
                    <th style={{ ...styles.tableHeader, width: '80px' }}>Dauer</th>
                    <th style={styles.tableHeader}>Ressource</th>
                  </tr>
                </thead>
                <tbody>
                  {group.todos.map(todo => (
                    <tr
                      key={todo.id}
                      style={{
                        ...styles.tableRow,
                        ...(hoveredRow === todo.id ? styles.tableRowHover : {}),
                      }}
                      onMouseEnter={() => setHoveredRow(todo.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onDoubleClick={() => onTodoDoubleClick(todo)}
                    >
                      <td style={styles.tableCell}>
                        <PriorityBadge priority={todo.priority} />
                      </td>
                      <td style={styles.tableCell}>{todo.title}</td>
                      <td style={styles.tableCell}>
                        <span style={styles.statusCell}>
                          <span style={{
                            ...styles.statusDot,
                            backgroundColor: statusColors[todo.status] || '#888',
                          }} />
                          {statusLabels[todo.status] || todo.status}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <TodoRowThumbnail 
                          articleId={todo.erp_order_article_id || todo.erp_packingnote_details_id}
                          articleNumber={todo.order_article_number || todo.bom_article_number}
                        />
                      </td>
                      <td style={styles.tableCell}>
                        {todo.workstep_name || '-'}
                      </td>
                      <td style={styles.tableCell}>
                        {formatDate(todo.planned_start)}
                      </td>
                      <td style={styles.tableCell}>
                        {formatDuration(todo.total_duration_minutes)}
                      </td>
                      <td style={styles.tableCell}>
                        {getResourceName(
                          todo.assigned_department_id,
                          todo.assigned_machine_id,
                          todo.assigned_employee_id
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
