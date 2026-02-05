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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    })

    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onClose(id), 200)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  const config = {
    success: { color: '#10b981', bg: '#ecfdf5', icon: CheckCircle },
    error: { color: '#ef4444', bg: '#fef2f2', icon: XCircle },
    warning: { color: '#f59e0b', bg: '#fffbeb', icon: AlertCircle },
    info: { color: '#7C3AED', bg: '#f5f3ff', icon: Info },
  }

  const { color, bg, icon: Icon } = config[type]

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(id), 200)
  }

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '14px',
        padding: '14px 18px',
        minWidth: '240px',
        maxWidth: '380px',
        boxShadow: '0 16px 40px rgba(124, 58, 237, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid rgba(124, 58, 237, 0.12)',
        transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(8px)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease-out',
        willChange: 'transform, opacity',
      }}
    >
      <div style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon style={{ width: '20px', height: '20px', color: color }} strokeWidth={2} />
      </div>

      <div style={{ flex: 1 }}>
        <h2 style={{ color: '#1f2937', fontSize: '13px', fontWeight: 600, margin: '0 0 2px 0' }}>{title}</h2>
        {message && (
          <p style={{ color: '#6b7280', fontSize: '11px', margin: 0, lineHeight: 1.4 }}>{message}</p>
        )}
      </div>

      <button
        onClick={handleClose}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          background: '#f3f4f6',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
      >
        <X style={{ width: '14px', height: '14px', color: '#6b7280' }} />
      </button>
    </div>
  )
}
