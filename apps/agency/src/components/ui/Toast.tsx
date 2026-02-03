'use client'

import { useEffect, useState, useCallback } from 'react'
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

export function Toast({ id, type, title, message, onClose, duration = 4000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [progress, setProgress] = useState(100)

  const handleClose = useCallback(() => {
    setIsLeaving(true)
    setTimeout(() => {
      onClose(id)
    }, 500)
  }, [id, onClose])

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => {
      setIsVisible(true)
    }, 10)

    // Start progress bar animation
    const progressTimer = setTimeout(() => {
      setProgress(0)
    }, 50)

    // Auto close timer
    let closeTimer: NodeJS.Timeout
    if (duration > 0) {
      closeTimer = setTimeout(() => {
        handleClose()
      }, duration)
    }

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(progressTimer)
      if (closeTimer) clearTimeout(closeTimer)
    }
  }, [id, duration, handleClose])

  const icons = {
    success: <CheckCircle className="h-5 w-5" />,
    error: <XCircle className="h-5 w-5" />,
    warning: <AlertCircle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
  }

  const colors = {
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: 'text-emerald-500',
      progress: 'bg-emerald-500',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-500',
      progress: 'bg-red-500',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: 'text-amber-500',
      progress: 'bg-amber-500',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-500',
      progress: 'bg-blue-500',
    },
  }

  const style = colors[type]

  return (
    <div
      className={`
        ${style.bg} ${style.border} border rounded-xl shadow-lg min-w-[320px] max-w-md overflow-hidden
        transform transition-all duration-500 ease-out
        ${isVisible && !isLeaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[120%]'}
      `}
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`${style.icon} flex-shrink-0`}>{icons[type]}</div>
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-semibold ${style.text}`}>{title}</h4>
            {message && (
              <p className={`text-xs mt-1 ${style.text} opacity-80`}>{message}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className={`${style.icon} hover:opacity-70 transition-opacity duration-300 flex-shrink-0`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-100">
        <div
          className={`h-full ${style.progress}`}
          style={{
            width: `${progress}%`,
            transition: `width ${duration}ms linear`,
          }}
        />
      </div>
    </div>
  )
}
