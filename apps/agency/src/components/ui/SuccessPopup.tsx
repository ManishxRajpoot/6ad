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
  duration = 1500
}: SuccessPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Use refs to track timers and prevent memory leaks
  const timersRef = useRef<NodeJS.Timeout[]>([])
  const onCloseRef = useRef(onClose)

  // Keep onClose ref updated without triggering effect re-runs
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Cleanup function to clear all timers
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer))
    timersRef.current = []
  }, [])

  useEffect(() => {
    // Clear any existing timers first
    clearAllTimers()

    if (isOpen) {
      setIsVisible(true)
      // Trigger animation after mount
      const animTimer = setTimeout(() => {
        setIsAnimating(true)
      }, 10)
      timersRef.current.push(animTimer)

      // Auto close after duration
      const closeTimer = setTimeout(() => {
        setIsAnimating(false)
        const fadeTimer = setTimeout(() => {
          setIsVisible(false)
          onCloseRef.current()
        }, 300)
        timersRef.current.push(fadeTimer)
      }, duration)
      timersRef.current.push(closeTimer)

      return clearAllTimers
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 300)
      timersRef.current.push(timer)
      return clearAllTimers
    }
  }, [isOpen, duration, clearAllTimers])

  if (!isVisible) return null

  const config = {
    success: {
      bg: 'bg-emerald-500',
      border: 'border-emerald-500',
      text: 'text-emerald-500',
      icon: Check,
      defaultTitle: 'Success!'
    },
    error: {
      bg: 'bg-red-500',
      border: 'border-red-500',
      text: 'text-red-500',
      icon: X,
      defaultTitle: 'Error!'
    },
    warning: {
      bg: 'bg-amber-500',
      border: 'border-amber-500',
      text: 'text-amber-500',
      icon: AlertTriangle,
      defaultTitle: 'Warning!'
    },
    info: {
      bg: 'bg-blue-500',
      border: 'border-blue-500',
      text: 'text-blue-500',
      icon: Info,
      defaultTitle: 'Info'
    }
  }

  const { bg, border, text, icon: Icon, defaultTitle } = config[type]

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none">
      <div
        className={`
          flex flex-col items-center gap-3 px-8 py-6 rounded-2xl shadow-2xl bg-white border-2 ${border}
          transform transition-all duration-300 ease-out
          ${isAnimating ? 'opacity-100 scale-100 animate-popIn' : 'opacity-0 scale-75'}
        `}
      >
        {/* Icon Circle */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${bg} ${isAnimating ? 'animate-bounceIn' : ''}`}
        >
          <Icon className="w-8 h-8 text-white" strokeWidth={3} />
        </div>

        {/* Title */}
        <span className={`text-lg font-semibold ${text}`}>
          {title || defaultTitle}
        </span>

        {/* Message */}
        <span className="text-gray-600 text-sm text-center max-w-xs">
          {message}
        </span>
      </div>
    </div>
  )
}
