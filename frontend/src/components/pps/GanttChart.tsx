/**
 * DHTMLX Gantt Chart Wrapper Component
 * 
 * Wraps DHTMLX Gantt for React integration with:
 * - 15-minute time grid
 * - Resource view
 * - Conflict highlighting
 * - Drag & drop support
 */
import React, { useEffect, useRef, useCallback } from 'react'
// @ts-ignore - DHTMLX Gantt doesn't have official TS types
import { gantt } from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { GanttTask, GanttLink, GanttData } from '../../services/ppsTypes'

interface GanttChartProps {
  data: GanttData
  onTaskUpdate?: (taskId: number, task: Partial<GanttTask>) => void
  onTaskCreate?: (task: Partial<GanttTask>) => void
  onTaskDelete?: (taskId: number) => void
  onLinkCreate?: (link: Partial<GanttLink>) => void
  onLinkDelete?: (linkId: number) => void
  onSelectionChange?: (selectedIds: number[]) => void
  readOnly?: boolean
  height?: string
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
  },
  // Custom CSS for conflict highlighting
  conflictTask: {
    backgroundColor: '#ffcccc',
    borderColor: '#ff6666',
  },
}

export default function GanttChart({
  data,
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  onLinkCreate,
  onLinkDelete,
  onSelectionChange,
  readOnly = false,
  height = '100%',
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  // Configure Gantt
  const configureGantt = useCallback(() => {
    // Basic settings
    gantt.config.date_format = '%Y-%m-%d %H:%i'
    gantt.config.fit_tasks = true
    gantt.config.auto_scheduling = false
    gantt.config.auto_scheduling_strict = false
    
    // 15-minute time step
    gantt.config.time_step = 15
    gantt.config.min_duration = 15 * 60 * 1000 // 15 minutes in ms
    gantt.config.duration_unit = 'minute'
    
    // Scale configuration
    gantt.config.scale_unit = 'day'
    gantt.config.date_scale = '%d.%m.%Y'
    gantt.config.subscales = [
      { unit: 'hour', step: 1, date: '%H:%i' }
    ]
    gantt.config.min_column_width = 40
    
    // Readonly mode
    gantt.config.readonly = readOnly
    gantt.config.drag_move = !readOnly
    gantt.config.drag_resize = !readOnly
    gantt.config.drag_progress = false
    gantt.config.drag_links = !readOnly
    
    // Task appearance
    gantt.config.row_height = 35
    gantt.config.task_height = 24
    
    // Grid columns
    gantt.config.columns = [
      { name: 'text', label: 'Aufgabe', tree: true, width: 200, resize: true },
      { name: 'start_date', label: 'Start', align: 'center', width: 90 },
      { name: 'duration', label: 'Dauer (Min)', align: 'center', width: 70 },
      { name: 'resource_name', label: 'Ressource', width: 100, resize: true },
    ]
    
    // Task class for conflict highlighting
    gantt.templates.task_class = (start: Date, end: Date, task: GanttTask) => {
      let classes = ''
      if (task.has_conflict) {
        classes += ' conflict-task'
      }
      if (task.type === 'project') {
        classes += ' project-task'
      }
      return classes.trim()
    }
    
    // Custom task text
    gantt.templates.task_text = (start: Date, end: Date, task: GanttTask) => {
      return task.text
    }
    
    // Progress bar (disabled for now)
    gantt.templates.progress_text = () => ''
    
    // Tooltip
    gantt.templates.tooltip_text = (start: Date, end: Date, task: GanttTask) => {
      return `<b>${task.text}</b><br/>
              Start: ${gantt.templates.tooltip_date_format(start)}<br/>
              Ende: ${gantt.templates.tooltip_date_format(end)}<br/>
              ${task.resource_name ? `Ressource: ${task.resource_name}<br/>` : ''}
              ${task.has_conflict ? '<span style="color:red">⚠ Konflikt</span>' : ''}`
    }
    
    // Link types (German labels)
    gantt.locale.labels.link_start = 'Start'
    gantt.locale.labels.link_end = 'Ende'
    gantt.locale.labels.link_from = 'Von'
    gantt.locale.labels.link_to = 'Nach'
    
    // German locale for common labels
    gantt.locale.labels.section_description = 'Beschreibung'
    gantt.locale.labels.section_time = 'Zeit'
    gantt.locale.labels.section_priority = 'Priorität'
    gantt.locale.labels.confirm_deleting = 'Der Vorgang wird gelöscht. Fortfahren?'
    gantt.locale.labels.confirm_link_deleting = 'Die Verknüpfung wird gelöscht. Fortfahren?'
    
    // Lightbox configuration with delete button
    gantt.config.buttons_left = ['gantt_save_btn', 'gantt_cancel_btn']
    gantt.config.buttons_right = ['gantt_delete_btn']
    
    // German labels for lightbox buttons
    gantt.locale.labels.gantt_save_btn = 'Speichern'
    gantt.locale.labels.gantt_cancel_btn = 'Abbrechen'
    gantt.locale.labels.gantt_delete_btn = 'Löschen'
    
    // Lightbox sections
    gantt.config.lightbox.sections = [
      { name: 'description', height: 40, map_to: 'text', type: 'textarea', focus: true },
      { name: 'time', type: 'duration', map_to: 'auto' }
    ]
    
  }, [readOnly])

  // Initialize Gantt
  useEffect(() => {
    if (!containerRef.current || initialized.current) return

    configureGantt()
    
    // Add custom CSS for conflicts
    const style = document.createElement('style')
    style.textContent = `
      .conflict-task .gantt_task_content {
        background-color: #ffcccc !important;
      }
      .conflict-task .gantt_task_progress {
        background-color: #ff9999 !important;
      }
      .conflict-task {
        border: 2px solid #ff6666 !important;
      }
      .project-task .gantt_task_content {
        background-color: #e0e0e0;
      }
      .gantt_task_line.gantt_selected {
        box-shadow: 0 0 5px #4a90d9;
      }
    `
    document.head.appendChild(style)
    
    gantt.init(containerRef.current)
    initialized.current = true
    
    return () => {
      gantt.clearAll()
      style.remove()
    }
  }, [configureGantt])

  // Event handlers
  useEffect(() => {
    if (!initialized.current) return
    
    // Task updated (drag/resize)
    const onAfterTaskUpdate = gantt.attachEvent('onAfterTaskUpdate', (id: number, task: GanttTask) => {
      if (onTaskUpdate && !readOnly) {
        onTaskUpdate(id, {
          start_date: gantt.templates.format_date(task.start_date),
          duration: task.duration,
          parent: task.parent,
        })
      }
    })
    
    // Task created
    const onAfterTaskAdd = gantt.attachEvent('onAfterTaskAdd', (id: number, task: GanttTask) => {
      if (onTaskCreate && !readOnly) {
        onTaskCreate({
          id,
          text: task.text,
          start_date: gantt.templates.format_date(task.start_date),
          duration: task.duration,
          parent: task.parent,
        })
      }
    })
    
    // Task deleted
    const onAfterTaskDelete = gantt.attachEvent('onAfterTaskDelete', (id: number) => {
      if (onTaskDelete && !readOnly) {
        onTaskDelete(id)
      }
    })
    
    // Link created
    const onAfterLinkAdd = gantt.attachEvent('onAfterLinkAdd', (id: number, link: GanttLink) => {
      if (onLinkCreate && !readOnly) {
        onLinkCreate({
          id,
          source: link.source,
          target: link.target,
          type: link.type,
        })
      }
    })
    
    // Link deleted
    const onAfterLinkDelete = gantt.attachEvent('onAfterLinkDelete', (id: number) => {
      if (onLinkDelete && !readOnly) {
        onLinkDelete(id)
      }
    })
    
    // Selection change
    const onTaskSelected = gantt.attachEvent('onTaskSelected', (id: number) => {
      if (onSelectionChange) {
        const selectedIds = gantt.getSelectedTasks ? gantt.getSelectedTasks() : [id]
        onSelectionChange(selectedIds)
      }
    })
    
    return () => {
      gantt.detachEvent(onAfterTaskUpdate)
      gantt.detachEvent(onAfterTaskAdd)
      gantt.detachEvent(onAfterTaskDelete)
      gantt.detachEvent(onAfterLinkAdd)
      gantt.detachEvent(onAfterLinkDelete)
      gantt.detachEvent(onTaskSelected)
    }
  }, [onTaskUpdate, onTaskCreate, onTaskDelete, onLinkCreate, onLinkDelete, onSelectionChange, readOnly])

  // Load data
  useEffect(() => {
    if (!initialized.current || !data) return
    
    // Clear and reload
    gantt.clearAll()
    
    // Parse data
    gantt.parse({
      data: data.data.map(task => ({
        ...task,
        // Convert string dates to Date objects
        start_date: task.start_date ? new Date(task.start_date.replace(' ', 'T')) : null,
      })),
      links: data.links,
    })
    
    // Fit to screen
    setTimeout(() => {
      gantt.render()
    }, 100)
    
  }, [data])

  return (
    <div 
      ref={containerRef} 
      style={{ ...styles.container, height }}
    />
  )
}

// Export helper functions
export function scrollToTask(taskId: number) {
  if (gantt.isTaskExists(taskId)) {
    gantt.showTask(taskId)
    gantt.selectTask(taskId)
  }
}

export function scrollToDate(date: Date) {
  gantt.showDate(date)
}

export function expandAll() {
  gantt.eachTask((task: GanttTask) => {
    task.open = true
  })
  gantt.render()
}

export function collapseAll() {
  gantt.eachTask((task: GanttTask) => {
    task.open = false
  })
  gantt.render()
}

export function zoomIn() {
  const currentStep = gantt.config.scale_unit === 'day' ? 'hour' : 'day'
  gantt.config.scale_unit = currentStep
  gantt.render()
}

export function zoomOut() {
  const currentStep = gantt.config.scale_unit === 'hour' ? 'day' : 'week'
  gantt.config.scale_unit = currentStep
  gantt.render()
}
