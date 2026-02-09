'use client'

import { useEffect, useRef } from 'react'

/**
 * Lightweight hook to listen for SSE events dispatched by SSEProvider
 * Usage: useSSEEvent('payment-methods-updated', () => { refetchData() })
 */
export function useSSEEvent(eventName: string, handler: (detail?: any) => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const listener = (e: Event) => {
      handlerRef.current((e as CustomEvent).detail)
    }

    window.addEventListener(`sse:${eventName}`, listener)
    return () => window.removeEventListener(`sse:${eventName}`, listener)
  }, [eventName])
}
