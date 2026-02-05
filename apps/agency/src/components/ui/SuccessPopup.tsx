'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type PopupType = 'success' | 'error' | 'warning' | 'info'

interface SuccessPopupProps {
  isOpen: boolean
  type: PopupType
  title?: string
  message: string
  onClose: () => void
  duration?: number
}

export function SuccessPopup({
  isOpen,
  type,
  title,
  message,
  onClose,
  duration = 3000
}: SuccessPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const timersRef = useRef<NodeJS.Timeout[]>([])
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer))
    timersRef.current = []
  }, [])

  const handleClose = useCallback(() => {
    clearAllTimers()
    setIsAnimating(false)
    const timer = setTimeout(() => {
      setIsVisible(false)
      onCloseRef.current()
    }, 200)
    timersRef.current.push(timer)
  }, [clearAllTimers])

  useEffect(() => {
    clearAllTimers()

    if (isOpen) {
      setIsVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })

      if (duration > 0) {
        const closeTimer = setTimeout(() => {
          handleClose()
        }, duration)
        timersRef.current.push(closeTimer)
      }

      return clearAllTimers
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 200)
      timersRef.current.push(timer)
      return clearAllTimers
    }
  }, [isOpen, duration, clearAllTimers, handleClose])

  if (!isVisible) return null

  const config = {
    success: { color: '#10b981', bg: '#ecfdf5', icon: CheckCircle, defaultTitle: 'Success!' },
    error: { color: '#ef4444', bg: '#fef2f2', icon: XCircle, defaultTitle: 'Error!' },
    warning: { color: '#f59e0b', bg: '#fffbeb', icon: AlertCircle, defaultTitle: 'Warning!' },
    info: { color: '#7C3AED', bg: '#f5f3ff', icon: Info, defaultTitle: 'Info' },
  }

  const { color, bg, icon: Icon, defaultTitle } = config[type]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          pointerEvents: 'auto',
          background: 'white',
          borderRadius: '14px',
          padding: '14px 18px',
          minWidth: '240px',
          maxWidth: '340px',
          boxShadow: '0 16px 40px rgba(124, 58, 237, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '1px solid rgba(124, 58, 237, 0.12)',
          transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(8px)',
          opacity: isAnimating ? 1 : 0,
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
          <h2 style={{ color: '#1f2937', fontSize: '13px', fontWeight: 600, margin: '0 0 2px 0' }}>{title || defaultTitle}</h2>
          <p style={{ color: '#6b7280', fontSize: '11px', margin: 0, lineHeight: 1.4 }}>{message}</p>
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
    </div>
  )
}
