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

const ACCESS_TOKEN_KEY = 'heph_access_token'
const REFRESH_TOKEN_KEY = 'heph_refresh_token'
const AUTH_USER_KEY = 'heph_user'
const ACCESS_TOKEN_ISSUED_AT_KEY = 'heph_access_token_issued_at'
const ACCESS_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000

function getCurrentClientPath() {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash || ''
  if (hash.startsWith('#')) {
    const p = hash.slice(1)
    return p.startsWith('/') ? p : `/${p}`
  }
  return window.location.pathname
}

function redirectToLogin() {
  if (typeof window === 'undefined') return
  window.location.hash = '#/login'
}

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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://heph-backend.onrender.com/api/v1'
// 'http://localhost:4000/api/v1'
// 'https://heph-backend.onrender.com/api/v1' 


export function setAuthTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(ACCESS_TOKEN_ISSUED_AT_KEY, String(Date.now()))
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function getAccessToken() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (!token) return null

  const issuedAtRaw = localStorage.getItem(ACCESS_TOKEN_ISSUED_AT_KEY)
  const issuedAt = issuedAtRaw ? Number(issuedAtRaw) : NaN

  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > ACCESS_TOKEN_MAX_AGE_MS) {
    clearAuthTokens()
    return null
  }

  return token
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
  localStorage.removeItem(ACCESS_TOKEN_ISSUED_AT_KEY)
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken()
  const currentPath = getCurrentClientPath()

  if (!token && path !== '/auth/login') {
    if (currentPath !== '/login') {
      window.alert('Your session has expired. Please log in again.')
      redirectToLogin()
    }
    throw new Error('Session expired. Please log in again.')
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  })

  if (res.status === 401 && path !== '/auth/login') {
    clearAuthTokens()
    if (currentPath !== '/login') {
      window.alert('Your session has expired. Please log in again.')
      redirectToLogin()
    }
    throw new Error('Session expired. Please log in again.')
  }

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
    totalRecipes?: number
    totalSidequests?: number
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

export async function getBudgetHistory(month: string) {
  return request<{
    month: string
    totalSpent: number
    totalBudgeted: number
    categories: Array<BudgetDto & { spentAmount: number }>
  }>(`/budgets/history?month=${encodeURIComponent(month)}`)
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
export type SidequestDto = {
  _id: string
  title: string
  description: string
  cost: number
  completed: boolean
  milestones?: Array<{ id: string; title: string; done: boolean; cost?: number }>
  createdAt: string
}

export async function getSidequests(limit = 20, page = 1) {
  return request<SidequestDto[]>(`/sidequests?limit=${limit}&page=${page}`)
}

export async function createSidequest(payload: { title: string; description: string; cost: number; milestones?: Array<{ id: string; title: string; done: boolean; cost?: number }> }) {
  return request<SidequestDto>('/sidequests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateSidequest(id: string, payload: Partial<{ title: string; description: string; cost: number; completed: boolean; milestones: Array<{ id: string; title: string; done: boolean; cost?: number }> }>) {
  return request<SidequestDto>(`/sidequests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteSidequest(id: string) {
  return request<{ deleted: boolean }>(`/sidequests/${id}`, {
    method: 'DELETE',
  })
}
