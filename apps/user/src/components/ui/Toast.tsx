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
  const [progress, setProgress] = useState(100)

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
      setProgress(100)

      const animTimer = setTimeout(() => {
        setIsAnimating(true)
        // Start progress bar
        setTimeout(() => setProgress(0), 50)
      }, 10)
      timersRef.current.push(animTimer)

      if (duration > 0) {
        const closeTimer = setTimeout(() => {
          setIsAnimating(false)
          const fadeTimer = setTimeout(() => {
            setIsVisible(false)
            onCloseRef.current()
          }, 300)
          timersRef.current.push(fadeTimer)
        }, duration)
        timersRef.current.push(closeTimer)
      }

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
      bgLight: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: Check,
      defaultTitle: 'Success!'
    },
    error: {
      bg: 'bg-red-500',
      bgLight: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: X,
      defaultTitle: 'Error'
    },
    warning: {
      bg: 'bg-amber-500',
      bgLight: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: AlertTriangle,
      defaultTitle: 'Warning'
    },
    info: {
      bg: 'bg-blue-500',
      bgLight: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: Info,
      defaultTitle: 'Info'
    },
    network: {
      bg: 'bg-gray-500',
      bgLight: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-800',
      icon: WifiOff,
      defaultTitle: 'Connection Error'
    },
    auth: {
      bg: 'bg-orange-500',
      bgLight: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      icon: ShieldX,
      defaultTitle: 'Authentication Error'
    },
    timeout: {
      bg: 'bg-purple-500',
      bgLight: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800',
      icon: Clock,
      defaultTitle: 'Request Timeout'
    },
    server: {
      bg: 'bg-rose-500',
      bgLight: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-800',
      icon: ServerCrash,
      defaultTitle: 'Server Error'
    }
  }

  const { bg, bgLight, border, text, icon: Icon, defaultTitle } = config[type]

  return (
    <div className="fixed top-4 right-4 z-[99999] pointer-events-auto">
      <div
        className={`
          ${bgLight} ${border} border rounded-xl shadow-2xl min-w-[340px] max-w-md overflow-hidden
          transform transition-all duration-300 ease-out
          ${isAnimating ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-full scale-95'}
        `}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`${bg} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className={`text-sm font-semibold ${text}`}>
                {title || defaultTitle}
              </h4>
              <p className={`text-xs mt-1 ${text} opacity-80 leading-relaxed`}>
                {message}
              </p>

              {/* Action Button */}
              {action && (
                <button
                  onClick={action.onClick}
                  className={`mt-2 text-xs font-medium ${text} underline hover:no-underline`}
                >
                  {action.label}
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                setIsAnimating(false)
                setTimeout(() => {
                  setIsVisible(false)
                  onClose()
                }, 300)
              }}
              className={`${text} opacity-60 hover:opacity-100 transition-opacity flex-shrink-0`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-gray-100">
          <div
            className={`h-full ${bg}`}
            style={{
              width: `${progress}%`,
              transition: `width ${duration}ms linear`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
