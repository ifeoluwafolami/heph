type ApiSuccess<T> = {
  success: true
  data: T
  message?: string
}

type ApiError = {
  success: false
  error: {
    code: string
    message?: string
    details?: unknown
  }
}

type ApiResponse<T> = ApiSuccess<T> | ApiError

export type AuthUser = {
  id: string
  email: string
  nickname?: string | null
}

export type BudgetDto = {
  _id: string
  name: string
  monthlyBudget: number
  spentAmount?: number
}

export type ExpenseDto = {
  _id: string
  title: string
  amount: number
  categoryId?: string | null
  expenseDate: string
  note?: string | null
}

export type MementoDto = {
  _id: string
  title: string
  content: string
  createdAt: string
  editedAt?: string | null
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'

export function setAuthTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem('heph_access_token', accessToken)
  if (refreshToken) localStorage.setItem('heph_refresh_token', refreshToken)
}

export function getAccessToken() {
  return localStorage.getItem('heph_access_token')
}

export function clearAuthTokens() {
  localStorage.removeItem('heph_access_token')
  localStorage.removeItem('heph_refresh_token')
  localStorage.removeItem('heph_user')
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem('heph_user', JSON.stringify(user))
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('heph_user')
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  })

  const json = (await res.json()) as ApiResponse<T> & { meta?: unknown }
  if (!res.ok || !json.success) {
    throw new Error(!json.success ? json.error.message || json.error.code : `HTTP ${res.status}`)
  }

  // attach meta if present to returned data under _meta for callers that need pagination metadata
  const data = json.data as T & { _meta?: unknown }
  if (json.meta) (data as { _meta?: unknown })._meta = json.meta
  return data as T
}

export async function login(email: string, password: string) {
  return request<{ accessToken: string; refreshToken?: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function getMe() {
  return request<AuthUser>('/auth/me')
}

export async function getDashboardOverview() {
  return request<{
    totalSpent: number
    totalBudgeted: number
    mementosAdded: number
    weightProgressKg: number
    newRecipes: number
  }>('/dashboard/overview')
}

export async function getRecentDashboardExpenses(limit = 4) {
  return request<ExpenseDto[]>(`/dashboard/recent-expenses?limit=${limit}`)
}

export async function getRecentDashboardMementos(limit = 3) {
  return request<MementoDto[]>(`/dashboard/recent-mementos?limit=${limit}`)
}

export async function getMementos(limit = 20, page = 1) {
  return request<MementoDto[]>(`/mementos?limit=${limit}&page=${page}`)
}

export async function createMemento(payload: { title: string; content: string }) {
  return request<MementoDto>('/mementos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateMemento(id: string, payload: Partial<{ title: string; content: string }>) {
  return request<MementoDto>(`/mementos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteMemento(id: string) {
  return request<{ deleted: boolean }>(`/mementos/${id}`, {
    method: 'DELETE',
  })
}

export type RecipeDto = {
  _id: string
  title: string
  servings: number
  caloriesPerServing: number
  notes?: string
}

export async function getRecipes(limit = 50, page = 1) {
  return request<RecipeDto[]>(`/recipes?limit=${limit}&page=${page}`)
}

export type WeightDto = {
  _id: string
  weightKg: number
  changeKg?: number
  note?: string
  entryDate: string
}

export async function getWeights(limit = 20, page = 1) {
  return request<WeightDto[]>(`/weights?limit=${limit}&page=${page}`)
}

export async function getExpenseSummary() {
  return request<{ totalSpent: number; totalBudgeted: number; remaining: number; count: number }>('/expenses/summary')
}

export async function getBudgets(page = 1, limit = 50) {
  return request<BudgetDto[]>(`/budgets?limit=${limit}&page=${page}`)
}

export async function getExpenses(limit = 10, page = 1) {
  return request<ExpenseDto[]>(`/expenses?limit=${limit}&page=${page}`)
}

export async function createExpense(payload: {
  title: string
  amount: number
  categoryName?: string
  expenseDate: string
  note?: string
}) {
  return request<ExpenseDto>('/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateBudgetsBulk(items: Array<{ id: string; monthlyBudget: number }>) {
  return request<{ updated: number }>('/budgets/bulk', {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  })
}

export async function updateExpense(id: string, payload: Partial<{ title: string; amount: number; categoryName?: string; expenseDate: string; note?: string }>) {
  return request<ExpenseDto>(`/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteExpense(id: string) {
  return request<{ deleted: boolean }>(`/expenses/${id}`, {
    method: 'DELETE',
  })
}

export async function createRecipe(payload: { title: string; servings: number; caloriesPerServing: number; notes?: string }) {
  return request<RecipeDto>('/recipes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateRecipe(id: string, payload: Partial<{ title: string; servings: number; caloriesPerServing: number; notes?: string }>) {
  return request<RecipeDto>(`/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteRecipe(id: string) {
  return request<{ deleted: boolean }>(`/recipes/${id}`, {
    method: 'DELETE',
  })
}

export async function createWeight(payload: { weightKg: number; entryDate: string; note?: string }) {
  return request<WeightDto>('/weights', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateWeight(id: string, payload: Partial<{ weightKg: number; entryDate: string; note?: string }>) {
  return request<WeightDto>(`/weights/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteWeight(id: string) {
  return request<{ deleted: boolean }>(`/weights/${id}`, {
    method: 'DELETE',
  })
}

export async function deleteBudget(id: string) {
  return request<{ deleted: boolean }>(`/budgets/${id}`, {
    method: 'DELETE',
  })
}

export async function createBudget(payload: { name: string; monthlyBudget: number }) {
  return request<BudgetDto>('/budgets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateBudget(id: string, payload: Partial<{ name: string; monthlyBudget: number }>) {
  return request<BudgetDto>(`/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
