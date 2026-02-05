'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Check, X, AlertTriangle, Info, WifiOff, ShieldX, Clock, ServerCrash } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'network' | 'auth' | 'timeout' | 'server'

interface ToastProps {
  isOpen: boolean
  type: ToastType
  title?: string
  message: string
  onClose: () => void
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export function Toast({
  isOpen,
  type,
  title,
  message,
  onClose,
  duration = 4000,
  action
}: ToastProps) {
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
          setIsAnimating(false)
          const fadeTimer = setTimeout(() => {
            setIsVisible(false)
            onCloseRef.current()
          }, 200)
          timersRef.current.push(fadeTimer)
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
  }, [isOpen, duration, clearAllTimers])

  if (!isVisible) return null

  const config = {
    success: { bg: '#10b981', bgLight: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: Check, defaultTitle: 'Success!' },
    error: { bg: '#ef4444', bgLight: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: X, defaultTitle: 'Error' },
    warning: { bg: '#f59e0b', bgLight: '#fffbeb', border: '#fde68a', text: '#92400e', icon: AlertTriangle, defaultTitle: 'Warning' },
    info: { bg: '#3b82f6', bgLight: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: Info, defaultTitle: 'Info' },
    network: { bg: '#6b7280', bgLight: '#f9fafb', border: '#d1d5db', text: '#374151', icon: WifiOff, defaultTitle: 'Connection Error' },
    auth: { bg: '#f97316', bgLight: '#fff7ed', border: '#fed7aa', text: '#9a3412', icon: ShieldX, defaultTitle: 'Authentication Error' },
    timeout: { bg: '#8b5cf6', bgLight: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6', icon: Clock, defaultTitle: 'Request Timeout' },
    server: { bg: '#e11d48', bgLight: '#fff1f2', border: '#fecdd3', text: '#9f1239', icon: ServerCrash, defaultTitle: 'Server Error' }
  }

  const { bg, bgLight, border, text, icon: Icon, defaultTitle } = config[type]

  const handleClose = () => {
    setIsAnimating(false)
    setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 200)
  }

  return (
    <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 99999 }}>
      <div
        style={{
          backgroundColor: bgLight,
          borderColor: border,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderRadius: '12px',
          minWidth: '340px',
          maxWidth: '400px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          transform: isAnimating ? 'translateX(0)' : 'translateX(100%)',
          opacity: isAnimating ? 1 : 0,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
          willChange: 'transform, opacity',
        }}
      >
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            {/* Icon */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon style={{ width: '20px', height: '20px', color: 'white' }} strokeWidth={2.5} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: text, margin: 0 }}>
                {title || defaultTitle}
              </h4>
              <p style={{ fontSize: '12px', marginTop: '4px', color: text, opacity: 0.8, lineHeight: 1.5, margin: '4px 0 0 0' }}>
                {message}
              </p>

              {action && (
                <button
                  onClick={action.onClick}
                  style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: text,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {action.label}
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              style={{
                color: text,
                opacity: 0.6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ height: '3px', backgroundColor: border }}>
          <div
            style={{
              height: '100%',
              backgroundColor: bg,
              width: isAnimating ? '0%' : '100%',
              transition: isAnimating ? `width ${duration}ms linear` : 'none',
            }}
          />
        </div>
      </div>
    </div>
  )
}
