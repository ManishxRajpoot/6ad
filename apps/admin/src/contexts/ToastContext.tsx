'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Toast } from '@/components/ui/Toast'

type ToastType = 'success' | 'error' | 'warning' | 'info'

type ToastData = {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

type ToastContextType = {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 5000) => {
      const id = Math.random().toString(36).substring(2, 9)
      setToasts((prev) => [...prev, { id, type, title, message, duration }])
    },
    []
  )

  const success = useCallback((title: string, message?: string) => {
    showToast('success', title, message)
  }, [showToast])

  const error = useCallback((title: string, message?: string) => {
    showToast('error', title, message)
  }, [showToast])

  const warning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message)
  }, [showToast])

  const info = useCallback((title: string, message?: string) => {
    showToast('info', title, message)
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              type={toast.type}
              title={toast.title}
              message={toast.message}
              duration={toast.duration}
              onClose={removeToast}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
