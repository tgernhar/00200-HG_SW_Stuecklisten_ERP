/**
 * PPS (Production Planning System) TypeScript Types
 */

// ============== Enums ==============

export type TodoType = 'container_order' | 'container_article' | 'bom_item' | 'operation' | 'eigene' | 'task' | 'project'
export type TodoStatus = 'new' | 'pending' | 'planned' | 'in_progress' | 'completed' | 'blocked'
export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish'
export type ConflictType = 'resource_overlap' | 'calendar' | 'dependency' | 'delivery_date' | 'qualification'
export type ConflictSeverity = 'warning' | 'error'
export type ResourceType = 'department' | 'machine' | 'employee'

// ============== Resource Types ==============

export interface PPSResource {
  id: number
  resource_type: ResourceType
  erp_id: number
  erp_department_id?: number  // qualificationitem.department (for machines)
  level?: number  // qualificationitem.level (1-5, for machines)
  name: string
  capacity: number
  is_active: boolean
  calendar_json?: Record<string, unknown>
  last_sync_at?: string
  created_at?: string
  updated_at?: string
}

// ============== Todo Types ==============

export interface PPSTodo {
  id: number
  erp_order_id?: number
  erp_order_article_id?: number
  erp_packingnote_details_id?: number  // BOM item from packingnote_details
  erp_workplan_detail_id?: number
  parent_todo_id?: number
  todo_type: TodoType
  title: string
  description?: string
  quantity: number
  setup_time_minutes?: number
  run_time_minutes?: number
  total_duration_minutes?: number
  is_duration_manual: boolean
  planned_start?: string
  planned_end?: string
  actual_start?: string
  actual_end?: string
  status: TodoStatus
  block_reason?: string
  priority: number
  delivery_date?: string
  assigned_department_id?: number
  assigned_machine_id?: number
  assigned_employee_id?: number
  creator_employee_id?: number  // For "eigene" todos
  progress: number  // 0.0 - 1.0
  version: number
  created_at?: string
  updated_at?: string
  has_conflicts: boolean
  conflict_count: number
}

// Todo with resolved ERP names for display
export interface PPSTodoWithERPDetails extends PPSTodo {
  order_name?: string  // ordertable.name
  order_article_number?: string  // article.articlenumber via order_article
  order_article_path?: string  // article.customtext7 via order_article (folder path)
  bom_article_number?: string  // article.articlenumber via packingnote_details
  bom_article_path?: string  // article.customtext7 via packingnote_details (folder path)
  article_description?: string  // article.description from HUGWAWI
  workstep_name?: string  // qualificationitem.name via workplan_details
  // Link status
  has_predecessor?: boolean  // Has incoming link (is successor)
  has_successor?: boolean  // Has outgoing link (is predecessor)
}

export interface PPSTodoCreate {
  todo_type: TodoType
  title: string
  description?: string
  quantity?: number
  setup_time_minutes?: number
  run_time_minutes?: number
  total_duration_minutes?: number
  is_duration_manual?: boolean
  planned_start?: string
  planned_end?: string
  status?: TodoStatus
  block_reason?: string
  priority?: number
  delivery_date?: string
  erp_order_id?: number
  erp_order_article_id?: number
  erp_packingnote_details_id?: number  // BOM item from packingnote_details
  erp_workplan_detail_id?: number
  parent_todo_id?: number
  assigned_department_id?: number
  assigned_machine_id?: number
  assigned_employee_id?: number
  creator_employee_id?: number  // For "eigene" todos
}

export interface PPSTodoUpdate {
  title?: string
  description?: string
  quantity?: number
  setup_time_minutes?: number
  run_time_minutes?: number
  total_duration_minutes?: number
  is_duration_manual?: boolean
  planned_start?: string
  planned_end?: string
  status?: TodoStatus
  block_reason?: string
  priority?: number
  delivery_date?: string
  parent_todo_id?: number
  assigned_department_id?: number
  assigned_machine_id?: number
  assigned_employee_id?: number
  gantt_display_type?: 'task' | 'project' | 'milestone'  // Gantt chart display type
  progress?: number  // 0.0 - 1.0
  version?: number
}

export interface PPSTodoWithDetails extends PPSTodo {
  assigned_department?: PPSResource
  assigned_machine?: PPSResource
  assigned_employee?: PPSResource
  children?: PPSTodoWithDetails[]
  segments?: PPSTodoSegment[]
  conflicts?: PPSConflict[]
}

// ============== Segment Types ==============

export interface PPSTodoSegment {
  id: number
  todo_id: number
  segment_index: number
  start_time: string
  end_time: string
  assigned_machine_id?: number
  assigned_employee_id?: number
  created_at?: string
  updated_at?: string
}

export interface TodoSplitRequest {
  segments: {
    segment_index: number
    start_time: string
    end_time: string
    assigned_machine_id?: number
    assigned_employee_id?: number
  }[]
}

// ============== Dependency Types ==============

export interface PPSDependency {
  id: number
  predecessor_id: number
  successor_id: number
  dependency_type: DependencyType
  lag_minutes: number
  is_active: boolean
  created_at?: string
}

export interface PPSDependencyCreate {
  predecessor_id: number
  successor_id: number
  dependency_type?: DependencyType
  lag_minutes?: number
  is_active?: boolean
}

// ============== Conflict Types ==============

export interface PPSConflict {
  id: number
  conflict_type: ConflictType
  todo_id: number
  related_todo_id?: number
  description: string
  severity: ConflictSeverity
  resolved: boolean
  created_at?: string
}

export interface PPSConflictWithTodos extends PPSConflict {
  todo_title?: string
  related_todo_title?: string
}

export interface ConflictListResponse {
  items: PPSConflictWithTodos[]
  total: number
  unresolved_count: number
}

// ============== Gantt Types (DHTMLX format) ==============

export interface GanttTask {
  id: number
  text: string
  start_date?: string  // "YYYY-MM-DD HH:MM"
  duration?: number    // in minutes
  end_date?: string
  parent: number       // 0 = root level
  type: 'task' | 'project' | 'milestone'
  progress: number     // 0-1
  open: boolean
  status?: string
  resource_id?: number
  resource_name?: string
  has_conflict: boolean
  priority: number
  delivery_date?: string
  todo_type?: string  // 'container_order', 'container_article', 'bom_item', 'operation'
}

export interface GanttLink {
  id: number
  source: number
  target: number
  type: number  // 0=F2S, 1=S2S, 2=F2F, 3=S2F
  lag: number
}

export interface GanttData {
  data: GanttTask[]
  links: GanttLink[]
}

export interface GanttSyncRequest {
  updated_tasks: Record<string, unknown>[]
  created_tasks: Record<string, unknown>[]
  deleted_task_ids: number[]
  updated_links: Record<string, unknown>[]
  created_links: Record<string, unknown>[]
  deleted_link_ids: number[]
}

export interface GanttSyncResponse {
  success: boolean
  updated_count: number
  created_count: number
  deleted_count: number
  errors: string[]
  created_task_ids: Record<string, number>
  created_link_ids: Record<string, number>
}

// ============== Response Types ==============

export interface TodoListResponse {
  items: PPSTodo[]
  total: number
  skip: number
  limit: number
}

export interface TodoListWithERPResponse {
  items: PPSTodoWithERPDetails[]
  total: number
  skip: number
  limit: number
}

export interface ResourceSyncResponse {
  success: boolean
  synced_count: number
  added_count: number
  updated_count: number
  deactivated_count: number
  errors: string[]
}

// ============== Generation Types ==============

export interface GenerateTodosRequest {
  erp_order_id: number
  erp_order_article_ids?: number[]
  include_workplan?: boolean  // Generate operation todos (default: false)
  include_bom_items?: boolean  // Generate BOM item todos (default: false)
  workplan_level?: number  // Maximum level for workplan import (1-5, default: 1)
}

export interface GenerateTodosResponse {
  success: boolean
  created_todos: number
  created_dependencies: number
  order_name?: string
  errors: string[]
}

export interface AvailableOrder {
  order_id: number
  order_name: string
  customer?: string
  delivery_date?: string
  article_count: number
  has_todos: boolean
  todo_count: number
}

// ============== Audit Log Types ==============

export interface AuditLogEntry {
  id: number
  todo_id?: number
  user_name?: string
  action: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  created_at?: string
}

// ============== Picker Types (for Todo creation from ERP hierarchy) ==============

export interface OrderArticleOption {
  id: number  // order_article.id
  position?: string
  articlenumber: string
  description?: string
  quantity?: number
  has_todo: boolean
}

export interface BomItemOption {
  id: number  // packingnote_details.id
  position?: string
  articlenumber: string
  description?: string
  quantity?: number
  has_todo: boolean
}

export interface WorkstepOption {
  id: number  // workplan_details.id
  position?: string
  name: string
  machine_name?: string
  setuptime?: number
  unittime?: number
  has_todo: boolean
}

// All worksteps from workstep table (for manual selection)
export interface AllWorkstepOption {
  id: number  // workstep.id
  name: string
}

// Machine option linked to a workstep
export interface MachineOption {
  id: number  // qualificationitem.id
  name: string
  description?: string
}
