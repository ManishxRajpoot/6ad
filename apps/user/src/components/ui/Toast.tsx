'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X, WifiOff, ShieldX, Clock, ServerCrash } from 'lucide-react'

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
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>('hidden')
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
    setAnimationState('exiting')
    const timer = setTimeout(() => {
      setIsVisible(false)
      setAnimationState('hidden')
      onCloseRef.current()
    }, 300)
    timersRef.current.push(timer)
  }, [clearAllTimers])

  useEffect(() => {
    clearAllTimers()

    if (isOpen) {
      setIsVisible(true)
      setAnimationState('entering')

      // Small delay to ensure CSS transition kicks in
      const enterTimer = setTimeout(() => {
        setAnimationState('visible')
      }, 50)
      timersRef.current.push(enterTimer)

      if (duration > 0) {
        const closeTimer = setTimeout(() => {
          handleClose()
        }, duration)
        timersRef.current.push(closeTimer)
      }

      return clearAllTimers
    } else {
      setAnimationState('exiting')
      const timer = setTimeout(() => {
        setIsVisible(false)
        setAnimationState('hidden')
      }, 300)
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
    network: { color: '#6b7280', bg: '#f9fafb', icon: WifiOff, defaultTitle: 'Connection Error' },
    auth: { color: '#f97316', bg: '#fff7ed', icon: ShieldX, defaultTitle: 'Authentication Error' },
    timeout: { color: '#8b5cf6', bg: '#f5f3ff', icon: Clock, defaultTitle: 'Request Timeout' },
    server: { color: '#e11d48', bg: '#fff1f2', icon: ServerCrash, defaultTitle: 'Server Error' },
  }

  const { color, bg, icon: Icon, defaultTitle } = config[type]

  const isAnimating = animationState === 'visible'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <style>{`
        @keyframes toastEnter {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          50% {
            transform: scale(1.02) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes toastExit {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          100% {
            opacity: 0;
            transform: scale(0.9) translateY(10px);
          }
        }
        .toast-entering {
          animation: toastEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .toast-exiting {
          animation: toastExit 0.25s ease-out forwards;
        }
      `}</style>
      <div
        className={animationState === 'entering' || animationState === 'visible' ? 'toast-entering' : animationState === 'exiting' ? 'toast-exiting' : ''}
        style={{
          pointerEvents: 'auto',
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
          {action && (
            <button
              onClick={action.onClick}
              style={{
                marginTop: '6px',
                fontSize: '11px',
                fontWeight: 500,
                color: color,
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
