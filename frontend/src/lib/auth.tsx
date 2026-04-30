import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getAccessToken, getStoredUser, clearAuthTokens } from './api'

export function RequireAuth({ children }: { children: ReactNode }) {
  const token = getAccessToken()
  const user = getStoredUser()
  const location = useLocation()

  if (!token || !user) {
    clearAuthTokens()
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export function logout() {
  clearAuthTokens()
  window.location.href = '/login'
}
