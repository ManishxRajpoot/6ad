'use client'

import { useEffect } from 'react'
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

type ToastProps = {
  id: string
  type: ToastType
  title: string
  message?: string
  onClose: (id: string) => void
  duration?: number
}

export function Toast({ id, type, title, message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  const icons = {
    success: <CheckCircle className="h-5 w-5" />,
    error: <XCircle className="h-5 w-5" />,
    warning: <AlertCircle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
  }

  const colors = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: 'text-green-500',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-500',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: 'text-yellow-500',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-500',
    },
  }

  const style = colors[type]

  return (
    <div
      className={`${style.bg} ${style.border} border rounded-lg shadow-lg p-4 min-w-[320px] max-w-md animate-in slide-in-from-right-full fade-in duration-300`}
    >
      <div className="flex items-start gap-3">
        <div className={style.icon}>{icons[type]}</div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${style.text}`}>{title}</h4>
          {message && (
            <p className={`text-xs mt-1 ${style.text} opacity-90`}>{message}</p>
          )}
        </div>
        <button
          onClick={() => onClose(id)}
          className={`${style.icon} hover:opacity-70 transition-opacity flex-shrink-0`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
