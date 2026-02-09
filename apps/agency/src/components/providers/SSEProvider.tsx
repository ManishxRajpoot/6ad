'use client'

import { useSSE } from '@/hooks/useSSE'

/**
 * SSE Provider — connects to the server's SSE endpoint and dispatches
 * CustomEvents on window so any component can listen via useSSEEvent hook.
 * Place this in the app layout to maintain one SSE connection per tab.
 */
export function SSEProvider({ children }: { children: React.ReactNode }) {
  useSSE({
    onPaymentMethodsUpdated: (data) => {
      window.dispatchEvent(new CustomEvent('sse:payment-methods-updated', { detail: data }))
    },
    onSettingsUpdated: (data) => {
      window.dispatchEvent(new CustomEvent('sse:settings-updated', { detail: data }))
    },
    onPlatformsUpdated: (data) => {
      window.dispatchEvent(new CustomEvent('sse:platforms-updated', { detail: data }))
    },
    onAnnouncementsUpdated: (data) => {
      window.dispatchEvent(new CustomEvent('sse:announcements-updated', { detail: data }))
    },
    onNotification: (data) => {
      window.dispatchEvent(new CustomEvent('sse:notification', { detail: data }))
    },
    onSiteSettingsUpdated: (data) => {
      window.dispatchEvent(new CustomEvent('sse:site-settings-updated', { detail: data }))
    },
    onModulesUpdated: (data) => {
      window.dispatchEvent(new CustomEvent('sse:modules-updated', { detail: data }))
    },
    onConnected: (_data) => {
      // connected
    },
  })

  return <>{children}</>
}
