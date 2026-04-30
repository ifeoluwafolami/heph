import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Toast = { id: string; message: string; type?: 'info' | 'success' | 'error' }

type ToastContextValue = { push: (t: Omit<Toast, 'id'>) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 7)
    setToasts((s) => [...s, { id, ...t }])
  }, [])

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== t.id))
      }, 5000)
    )
    return () => timers.forEach((id) => clearTimeout(id))
  }, [toasts])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div key={t.id} className={`max-w-sm w-full rounded-lg border border-claret bg-claret/95 px-4 py-3 text-sm text-pink shadow-lg`}>
            <div className="font-semibold">{t.type === 'error' ? 'Error' : t.type === 'success' ? 'Success' : 'Info'}</div>
            <div className="mt-1">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
