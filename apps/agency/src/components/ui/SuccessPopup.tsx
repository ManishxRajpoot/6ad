'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Check, X, AlertTriangle, Info } from 'lucide-react'

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
  duration = 2000
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

  useEffect(() => {
    clearAllTimers()

    if (isOpen) {
      setIsVisible(true)
      // Use requestAnimationFrame for smoother animation start
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })

      const closeTimer = setTimeout(() => {
        setIsAnimating(false)
        const fadeTimer = setTimeout(() => {
          setIsVisible(false)
          onCloseRef.current()
        }, 200)
        timersRef.current.push(fadeTimer)
      }, duration)
      timersRef.current.push(closeTimer)

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
    success: {
      bg: '#10b981',
      border: '#10b981',
      text: '#10b981',
      icon: Check,
      defaultTitle: 'Success!'
    },
    error: {
      bg: '#ef4444',
      border: '#ef4444',
      text: '#ef4444',
      icon: X,
      defaultTitle: 'Error!'
    },
    warning: {
      bg: '#f59e0b',
      border: '#f59e0b',
      text: '#f59e0b',
      icon: AlertTriangle,
      defaultTitle: 'Warning!'
    },
    info: {
      bg: '#3b82f6',
      border: '#3b82f6',
      text: '#3b82f6',
      icon: Info,
      defaultTitle: 'Info'
    }
  }

  const { bg, border, text, icon: Icon, defaultTitle } = config[type]

  return (
    <>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none"
        style={{ perspective: '1000px' }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderColor: border,
            borderWidth: '2px',
            borderStyle: 'solid',
            borderRadius: '16px',
            padding: '24px 32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transform: isAnimating ? 'scale(1)' : 'scale(0.8)',
            opacity: isAnimating ? 1 : 0,
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease-out',
            willChange: 'transform, opacity',
          }}
        >
          {/* Icon Circle */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: isAnimating ? 'scale(1)' : 'scale(0.5)',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s',
              willChange: 'transform',
            }}
          >
            <Icon style={{ width: '32px', height: '32px', color: 'white' }} strokeWidth={3} />
          </div>

          {/* Title */}
          <span style={{
            fontSize: '18px',
            fontWeight: 600,
            color: text,
            opacity: isAnimating ? 1 : 0,
            transform: isAnimating ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.2s ease-out 0.1s, transform 0.2s ease-out 0.1s',
          }}>
            {title || defaultTitle}
          </span>

          {/* Message */}
          <span style={{
            fontSize: '14px',
            color: '#4b5563',
            textAlign: 'center',
            maxWidth: '280px',
            opacity: isAnimating ? 1 : 0,
            transition: 'opacity 0.2s ease-out 0.15s',
          }}>
            {message}
          </span>
        </div>
      </div>
    </>
  )
}
