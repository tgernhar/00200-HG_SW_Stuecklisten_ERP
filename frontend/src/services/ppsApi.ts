/**
 * PPS API Service
 * 
 * Handles all API calls for production planning
 */
import api from './api'
import {
  PPSTodo,
  PPSTodoCreate,
  PPSTodoUpdate,
  PPSTodoWithDetails,
  PPSTodoWithERPDetails,
  PPSTodoSegment,
  TodoSplitRequest,
  PPSDependency,
  PPSDependencyCreate,
  PPSResource,
  PPSConflictWithTodos,
  ConflictListResponse,
  GanttData,
  GanttSyncRequest,
  GanttSyncResponse,
  TodoListResponse,
  TodoListWithERPResponse,
  ResourceSyncResponse,
  GenerateTodosRequest,
  GenerateTodosResponse,
  AvailableOrder,
  AuditLogEntry,
  ResourceType,
  OrderArticleOption,
  BomItemOption,
  WorkstepOption,
  AllWorkstepOption,
  MachineOption,
} from './ppsTypes'

const BASE_URL = '/pps'

// ============== Todos ==============

export async function getTodos(params?: {
  skip?: number
  limit?: number
  erp_order_id?: number
  status?: string
  todo_type?: string
  date_from?: string
  date_to?: string
  resource_id?: number
  assigned_employee_id?: number
  has_conflicts?: boolean
  parent_todo_id?: number
  search?: string
  // Cumulative filter flags (OR logic)
  filter_orders?: boolean
  filter_articles?: boolean
  filter_operations?: boolean
}): Promise<TodoListResponse> {
  const response = await api.get(`${BASE_URL}/todos`, { params })
  return response.data
}

export async function getTodosWithERPDetails(params?: {
  skip?: number
  limit?: number
  erp_order_id?: number
  status?: string
  todo_type?: string
  date_from?: string
  date_to?: string
  resource_id?: number
  assigned_employee_id?: number
  has_conflicts?: boolean
  parent_todo_id?: number
  search?: string
  // Cumulative filter flags (OR logic)
  filter_orders?: boolean
  filter_articles?: boolean
  filter_operations?: boolean
}): Promise<TodoListWithERPResponse> {
  const response = await api.get(`${BASE_URL}/todos-with-erp-details`, { params })
  return response.data
}

export async function getTodo(todoId: number): Promise<PPSTodoWithDetails> {
  const response = await api.get(`${BASE_URL}/todos/${todoId}`)
  return response.data
}

export async function getTodoWithERPDetails(todoId: number): Promise<PPSTodoWithERPDetails> {
  const response = await api.get(`${BASE_URL}/todos/${todoId}/with-erp-details`)
  return response.data
}

export async function createTodo(data: PPSTodoCreate): Promise<PPSTodo> {
  const response = await api.post(`${BASE_URL}/todos`, data)
  return response.data
}

export async function updateTodo(todoId: number, data: PPSTodoUpdate): Promise<PPSTodo> {
  const response = await api.patch(`${BASE_URL}/todos/${todoId}`, data)
  return response.data
}

export async function deleteTodo(todoId: number): Promise<{ success: boolean; deleted_id: number }> {
  const response = await api.delete(`${BASE_URL}/todos/${todoId}`)
  return response.data
}

export async function splitTodo(todoId: number, data: TodoSplitRequest): Promise<PPSTodoSegment[]> {
  const response = await api.post(`${BASE_URL}/todos/${todoId}/split`, data)
  return response.data
}

// ============== Gantt Data ==============

export async function getGanttData(params?: {
  date_from?: string
  date_to?: string
  erp_order_id?: number
  resource_ids?: string
}): Promise<GanttData> {
  const response = await api.get(`${BASE_URL}/gantt/data`, { params })
  return response.data
}

export async function syncGanttData(data: GanttSyncRequest): Promise<GanttSyncResponse> {
  const response = await api.post(`${BASE_URL}/gantt/sync`, data)
  return response.data
}

// ============== Resources ==============

export async function getResources(params?: {
  resource_type?: ResourceType
  is_active?: boolean
}): Promise<PPSResource[]> {
  const response = await api.get(`${BASE_URL}/resources`, { params })
  return response.data
}

export async function getResource(resourceId: number): Promise<PPSResource> {
  const response = await api.get(`${BASE_URL}/resources/${resourceId}`)
  return response.data
}

export async function syncResources(resource_types?: ResourceType[]): Promise<ResourceSyncResponse> {
  const response = await api.post(`${BASE_URL}/resources/sync`, { resource_types })
  return response.data
}

// ============== Dependencies ==============

export async function getDependencies(todoId?: number): Promise<PPSDependency[]> {
  const params = todoId ? { todo_id: todoId } : undefined
  const response = await api.get(`${BASE_URL}/dependencies`, { params })
  return response.data
}

export async function createDependency(data: PPSDependencyCreate): Promise<PPSDependency> {
  const response = await api.post(`${BASE_URL}/dependencies`, data)
  return response.data
}

export async function deleteDependency(dependencyId: number): Promise<{ success: boolean; deleted_id: number }> {
  const response = await api.delete(`${BASE_URL}/dependencies/${dependencyId}`)
  return response.data
}

// ============== Conflicts ==============

export async function getConflicts(params?: {
  resolved?: boolean
  conflict_type?: string
  todo_id?: number
}): Promise<ConflictListResponse> {
  const response = await api.get(`${BASE_URL}/conflicts`, { params })
  return response.data
}

export async function checkConflicts(): Promise<{
  success: boolean
  conflicts_found: number
  resource_overlaps: number
  dependency_conflicts: number
  delivery_conflicts: number
}> {
  const response = await api.post(`${BASE_URL}/conflicts/check`)
  return response.data
}

export async function resolveConflict(conflictId: number): Promise<{ success: boolean; conflict_id: number }> {
  const response = await api.patch(`${BASE_URL}/conflicts/${conflictId}/resolve`)
  return response.data
}

// ============== Todo Generation ==============

export async function getAvailableOrders(params?: {
  search?: string
  has_todos?: boolean
}): Promise<AvailableOrder[]> {
  const response = await api.get(`${BASE_URL}/orders/available`, { params })
  return response.data
}

export async function generateTodos(data: GenerateTodosRequest): Promise<GenerateTodosResponse> {
  const response = await api.post(`${BASE_URL}/generate-todos`, data)
  return response.data
}

// ============== Audit Log ==============

export async function getAuditLog(params?: {
  todo_id?: number
  action?: string
  limit?: number
}): Promise<AuditLogEntry[]> {
  const response = await api.get(`${BASE_URL}/audit-log`, { params })
  return response.data
}

// ============== Working Hours Configuration ==============

export interface WorkingHours {
  id: number
  day_of_week: number  // 0=Monday, 6=Sunday
  day_name: string
  start_time: string | null  // "HH:MM" format
  end_time: string | null
  is_working_day: boolean
}

export interface WorkingHoursUpdate {
  day_of_week: number
  start_time: string | null
  end_time: string | null
  is_working_day: boolean
}

export async function getWorkingHours(): Promise<WorkingHours[]> {
  const response = await api.get(`${BASE_URL}/config/working-hours`)
  return response.data.items
}

export async function updateWorkingHours(data: WorkingHoursUpdate[]): Promise<WorkingHours[]> {
  const response = await api.put(`${BASE_URL}/config/working-hours`, data)
  return response.data.items
}

// ============== Picker APIs (for Todo creation from ERP hierarchy) ==============

export async function getOrderArticles(orderId: number): Promise<OrderArticleOption[]> {
  const response = await api.get(`${BASE_URL}/orders/${orderId}/articles`)
  return response.data
}

export async function getArticleBomItems(articleId: number): Promise<BomItemOption[]> {
  const response = await api.get(`${BASE_URL}/articles/${articleId}/bom-items`)
  return response.data
}

export async function getBomWorksteps(bomId: number): Promise<WorkstepOption[]> {
  const response = await api.get(`${BASE_URL}/bom-items/${bomId}/worksteps`)
  return response.data
}

// ============== All Worksteps (from workstep table) ==============

export async function getAllWorksteps(): Promise<AllWorkstepOption[]> {
  const response = await api.get(`${BASE_URL}/all-worksteps`)
  return response.data
}

export async function getWorkstepMachines(workstepId: number): Promise<MachineOption[]> {
  const response = await api.get(`${BASE_URL}/worksteps/${workstepId}/machines`)
  return response.data
}

// ============== Batch Operations ==============

export interface BatchUpdateItem {
  id: number
  start_date?: string  // "YYYY-MM-DD HH:MM"
  duration?: number    // in 15-minute units (as from Gantt)
  progress?: number    // 0.0 - 1.0
}

export interface BatchUpdateResponse {
  updated: number[]
}

export interface ShiftTodosRequest {
  shift_minutes: number  // Positive = forward, negative = backward
  date_from?: string     // "YYYY-MM-DD"
  department_id?: number
}

export interface ShiftTodosResponse {
  shifted_count: number
}

export interface TodoDependenciesResponse {
  predecessors: PPSTodo[]
  successors: PPSTodo[]
}

export async function batchUpdateTodos(updates: BatchUpdateItem[]): Promise<BatchUpdateResponse> {
  const response = await api.post(`${BASE_URL}/todos/batch-update`, { updates })
  return response.data
}

export async function shiftAllTodos(request: ShiftTodosRequest): Promise<ShiftTodosResponse> {
  const response = await api.post(`${BASE_URL}/todos/shift-all`, request)
  return response.data
}

export async function getTodoDependencies(todoId: number): Promise<TodoDependenciesResponse> {
  const response = await api.get(`${BASE_URL}/todos/${todoId}/dependencies`)
  return response.data
}

// Export all functions as a single object for convenience
export const ppsApi = {
  getTodos,
  getTodosWithERPDetails,
  getTodo,
  createTodo,
  updateTodo,
  deleteTodo,
  splitTodo,
  getGanttData,
  syncGanttData,
  getResources,
  getResource,
  syncResources,
  getDependencies,
  createDependency,
  deleteDependency,
  getConflicts,
  checkConflicts,
  resolveConflict,
  getAvailableOrders,
  generateTodos,
  getAuditLog,
  getWorkingHours,
  updateWorkingHours,
  getOrderArticles,
  getArticleBomItems,
  getBomWorksteps,
  getAllWorksteps,
  getWorkstepMachines,
  // Batch operations
  batchUpdateTodos,
  shiftAllTodos,
  getTodoDependencies,
}

export default ppsApi
