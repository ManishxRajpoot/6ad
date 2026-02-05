'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Toast } from '@/components/ui/Toast'

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'network' | 'auth' | 'timeout' | 'server'

type ToastData = {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

type ToastContextType = {
  showToast: (type: ToastType, title: string, message?: string, duration?: number, action?: { label: string; onClick: () => void }) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  networkError: (message?: string) => void
  authError: (message?: string) => void
  serverError: (message?: string) => void
  timeoutError: (message?: string) => void
  handleApiError: (error: any, fallbackMessage?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

// Error message mappings for user-friendly messages
const ERROR_MESSAGES: Record<string, { title: string; message: string; type: ToastType }> = {
  // Network Errors
  'Failed to fetch': { title: 'Connection Error', message: 'Unable to connect to the server. Please check your internet connection.', type: 'network' },
  'Network Error': { title: 'Network Error', message: 'Unable to reach the server. Please try again.', type: 'network' },
  'Unable to connect': { title: 'Connection Failed', message: 'Cannot connect to the server. Please check your internet connection.', type: 'network' },

  // Auth Errors
  'Session expired': { title: 'Session Expired', message: 'Your session has expired. Please login again.', type: 'auth' },
  'Unauthorized': { title: 'Access Denied', message: 'You are not authorized to perform this action.', type: 'auth' },
  'Invalid token': { title: 'Session Invalid', message: 'Your session is invalid. Please login again.', type: 'auth' },

  // Server Errors
  'Internal Server Error': { title: 'Server Error', message: 'Something went wrong on our end. Please try again later.', type: 'server' },
  'Service Unavailable': { title: 'Service Unavailable', message: 'The service is temporarily unavailable. Please try again later.', type: 'server' },

  // Timeout Errors
  'timeout': { title: 'Request Timeout', message: 'The request took too long. Please try again.', type: 'timeout' },
  'ETIMEDOUT': { title: 'Connection Timeout', message: 'Connection timed out. Please try again.', type: 'timeout' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)

  const closeToast = useCallback(() => {
    setToast(null)
  }, [])

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000, action?: { label: string; onClick: () => void }) => {
      const id = Math.random().toString(36).substring(2, 9)
      setToast({ id, type, title, message: message || title, duration, action })
    },
    []
  )

  const success = useCallback((title: string, message?: string) => {
    showToast('success', title, message, 3000)
  }, [showToast])

  const error = useCallback((title: string, message?: string) => {
    showToast('error', title, message, 5000)
  }, [showToast])

  const warning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message, 4000)
  }, [showToast])

  const info = useCallback((title: string, message?: string) => {
    showToast('info', title, message, 3000)
  }, [showToast])

  const networkError = useCallback((message?: string) => {
    showToast('network', 'Connection Error', message || 'Unable to connect to the server. Please check your internet connection.', 6000, {
      label: 'Retry',
      onClick: () => window.location.reload()
    })
  }, [showToast])

  const authError = useCallback((message?: string) => {
    showToast('auth', 'Authentication Error', message || 'Please login again to continue.', 5000, {
      label: 'Login',
      onClick: () => window.location.href = '/login'
    })
  }, [showToast])

  const serverError = useCallback((message?: string) => {
    showToast('server', 'Server Error', message || 'Something went wrong on our end. Please try again later.', 6000)
  }, [showToast])

  const timeoutError = useCallback((message?: string) => {
    showToast('timeout', 'Request Timeout', message || 'The request took too long. Please try again.', 5000, {
      label: 'Retry',
      onClick: () => window.location.reload()
    })
  }, [showToast])

  // Smart error handler that detects error type and shows appropriate toast
  const handleApiError = useCallback((err: any, fallbackMessage?: string) => {
    const errorMessage = err?.message || err?.error || String(err) || ''

    // Check for known error patterns
    for (const [pattern, config] of Object.entries(ERROR_MESSAGES)) {
      if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
        showToast(config.type, config.title, config.message, 5000)
        return
      }
    }

    // Check HTTP status codes
    const status = err?.status || err?.response?.status
    if (status) {
      switch (status) {
        case 400:
          showToast('error', 'Bad Request', errorMessage || 'The request was invalid. Please check your input.', 5000)
          return
        case 401:
          authError('Your session has expired. Please login again.')
          return
        case 403:
          showToast('error', 'Access Denied', 'You do not have permission to perform this action.', 5000)
          return
        case 404:
          showToast('error', 'Not Found', 'The requested resource was not found.', 5000)
          return
        case 408:
          timeoutError()
          return
        case 429:
          showToast('warning', 'Too Many Requests', 'You are making too many requests. Please slow down.', 6000)
          return
        case 500:
        case 502:
        case 503:
          serverError()
          return
      }
    }

    // Default error
    showToast('error', 'Error', fallbackMessage || errorMessage || 'An unexpected error occurred. Please try again.', 5000)
  }, [showToast, authError, serverError, timeoutError])

  return (
    <ToastContext.Provider value={{
      showToast,
      success,
      error,
      warning,
      info,
      networkError,
      authError,
      serverError,
      timeoutError,
      handleApiError
    }}>
      {children}

      {toast && (
        <Toast
          key={toast.id}
          isOpen={true}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          duration={toast.duration}
          action={toast.action}
          onClose={closeToast}
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
