/**
 * PPS (Production Planning System) TypeScript Types
 */

// ============== Enums ==============

export type TodoType = 'container_order' | 'container_article' | 'operation' | 'eigene'
export type TodoStatus = 'new' | 'planned' | 'in_progress' | 'completed' | 'blocked'
export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish'
export type ConflictType = 'resource_overlap' | 'calendar' | 'dependency' | 'delivery_date' | 'qualification'
export type ConflictSeverity = 'warning' | 'error'
export type ResourceType = 'department' | 'machine' | 'employee'

// ============== Resource Types ==============

export interface PPSResource {
  id: number
  resource_type: ResourceType
  erp_id: number
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
  version: number
  created_at?: string
  updated_at?: string
  has_conflicts: boolean
  conflict_count: number
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
  include_workplan?: boolean
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
