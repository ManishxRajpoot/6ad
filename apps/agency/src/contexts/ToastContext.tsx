'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { SuccessPopup } from '@/components/ui/SuccessPopup'

type PopupType = 'success' | 'error' | 'warning' | 'info'

type PopupData = {
  id: string
  type: PopupType
  title?: string
  message: string
  duration?: number
}

type ToastContextType = {
  showToast: (type: PopupType, title: string, message?: string, duration?: number) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [popup, setPopup] = useState<PopupData | null>(null)

  const closePopup = useCallback(() => {
    setPopup(null)
  }, [])

  const showToast = useCallback(
    (type: PopupType, title: string, message?: string, duration = 1500) => {
      const id = Math.random().toString(36).substring(2, 9)
      setPopup({ id, type, title, message: message || title, duration })
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

      {/* Success/Error Popup - Centered */}
      {popup && (
        <SuccessPopup
          key={popup.id}
          isOpen={true}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          duration={popup.duration}
          onClose={closePopup}
        />
      )}
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
