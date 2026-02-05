'use client'

import { useEffect, useState } from 'react'
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
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation on mount
    requestAnimationFrame(() => {
      setIsVisible(true)
    })

    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onClose(id), 200)
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
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '#22c55e' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '#ef4444' },
    warning: { bg: '#fefce8', border: '#fef08a', text: '#854d0e', icon: '#eab308' },
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '#3b82f6' },
  }

  const style = colors[type]

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(id), 200)
  }

  return (
    <div
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '8px',
        padding: '16px',
        minWidth: '320px',
        maxWidth: '400px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
        willChange: 'transform, opacity',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ color: style.icon, flexShrink: 0 }}>{icons[type]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: style.text, margin: 0 }}>{title}</h4>
          {message && (
            <p style={{ fontSize: '12px', marginTop: '4px', color: style.text, opacity: 0.9, margin: '4px 0 0 0' }}>{message}</p>
          )}
        </div>
        <button
          onClick={handleClose}
          style={{
            color: style.icon,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            opacity: 0.7,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
