'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

export type SSEEventType =
  | 'payment-methods-updated'
  | 'settings-updated'
  | 'platforms-updated'
  | 'announcements-updated'
  | 'notification'
  | 'site-settings-updated'
  | 'modules-updated'

export interface SSEEventHandlers {
  onPaymentMethodsUpdated?: (data: any) => void
  onSettingsUpdated?: (data: any) => void
  onPlatformsUpdated?: (data: any) => void
  onAnnouncementsUpdated?: (data: any) => void
  onNotification?: (data: any) => void
  onSiteSettingsUpdated?: (data: any) => void
  onModulesUpdated?: (data: any) => void
  onConnected?: (data: any) => void
}

const EVENT_MAP: Record<string, keyof SSEEventHandlers> = {
  'payment-methods-updated': 'onPaymentMethodsUpdated',
  'settings-updated': 'onSettingsUpdated',
  'platforms-updated': 'onPlatformsUpdated',
  'announcements-updated': 'onAnnouncementsUpdated',
  'notification': 'onNotification',
  'site-settings-updated': 'onSiteSettingsUpdated',
  'modules-updated': 'onModulesUpdated',
  'connected': 'onConnected',
}

export function useSSE(handlers: SSEEventHandlers) {
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const handlersRef = useRef(handlers)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const authFailedRef = useRef(false)

  // Keep handlers ref up to date without recreating EventSource
  handlersRef.current = handlers

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return

    const token = localStorage.getItem('token')
    if (!token) return

    // Don't retry if we already know the token is invalid
    if (authFailedRef.current) return

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `${API_URL}/events/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      setIsConnected(true)
      authFailedRef.current = false
    }

    es.onerror = () => {
      setIsConnected(false)

      // EventSource auto-reconnects on network errors
      // But if we get a 401/403, the connection closes permanently
      if (es.readyState === EventSource.CLOSED) {
        // Mark auth as failed — stop retrying until a fresh login
        authFailedRef.current = true
        es.close()
        eventSourceRef.current = null
        // Don't log or retry — will reconnect when user logs in via sse:reconnect event
      }
    }

    // Register listeners for all event types
    for (const [eventType, handlerKey] of Object.entries(EVENT_MAP)) {
      es.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = event.data ? JSON.parse(event.data) : {}
          const handler = handlersRef.current[handlerKey]
          if (handler) {
            handler(data)
          }
        } catch (err) {
          // Ignore parse errors for heartbeat/empty events
        }
      })
    }
  }, [])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  // Listen for login/logout — reconnect with fresh token after login
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (e.newValue) {
          // New token set (user just logged in) — reset auth failure and connect
          authFailedRef.current = false
          connect()
        } else {
          // Token removed (user logged out) — disconnect
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
          }
          setIsConnected(false)
        }
      }
    }

    // Custom event dispatched after login in same tab (storage event only fires cross-tab)
    const handleReconnect = () => {
      authFailedRef.current = false
      connect()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('sse:reconnect', handleReconnect)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('sse:reconnect', handleReconnect)
    }
  }, [connect])

  // Reconnect when tab becomes visible (handles long-backgrounded tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !authFailedRef.current) {
        const es = eventSourceRef.current
        if (!es || es.readyState === EventSource.CLOSED) {
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [connect])

  return { isConnected }
}
