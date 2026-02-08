'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, ArrowUpCircle } from 'lucide-react'

const CHECK_INTERVAL = 10000 // Check every 10 seconds

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [initialVersion, setInitialVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch version.json from the same origin with cache busting
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })

      if (!response.ok) return

      const data = await response.json()
      const serverVersion = data.version

      if (!initialVersion) {
        // First load - store the initial version
        setInitialVersion(serverVersion)
      } else if (serverVersion !== initialVersion) {
        // Version changed - new deployment detected!
        console.log('[UpdateChecker] New version detected:', serverVersion, 'Current:', initialVersion)
        setUpdateAvailable(true)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsAnimating(true)
          })
        })
      }
    } catch (error) {
      console.debug('[UpdateChecker] Failed to check for updates')
    }
  }, [initialVersion])

  useEffect(() => {
    // Initial check
    checkForUpdates()

    // Set up interval for continuous checking
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [checkForUpdates])

  const handleRefresh = async () => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map(name => caches.delete(name)))
      }

      // Clear service worker caches
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(r => r.unregister()))
      }
    } catch (error) {
      console.debug('[UpdateChecker] Failed to clear caches')
    }

    // Force hard reload - bypass cache completely
    window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now()
  }

  const handleDismiss = () => {
    setIsAnimating(false)
    setTimeout(() => {
      setDismissed(true)
      // Re-show after 5 minutes if still not refreshed
      setTimeout(() => setDismissed(false), 300000)
    }, 200)
  }

  if (!updateAvailable || dismissed) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          pointerEvents: 'auto',
          background: 'white',
          borderRadius: '14px',
          padding: '14px 18px',
          minWidth: '280px',
          maxWidth: '340px',
          boxShadow: '0 16px 40px rgba(13, 148, 136, 0.2), 0 0 0 1px rgba(13, 148, 136, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '1px solid rgba(13, 148, 136, 0.15)',
          transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(8px)',
          opacity: isAnimating ? 1 : 0,
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease-out',
          willChange: 'transform, opacity',
        }}
      >
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ArrowUpCircle style={{ width: '22px', height: '22px', color: '#0D9488' }} strokeWidth={2} />
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#1f2937', fontSize: '14px', fontWeight: 600, margin: '0 0 3px 0' }}>New Update Available!</h2>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 10px 0', lineHeight: 1.4 }}>
            A new version has been deployed. Refresh to get the latest changes.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRefresh}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
                color: 'white',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 2px 4px rgba(13, 148, 136, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(13, 148, 136, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(13, 148, 136, 0.3)'
              }}
            >
              <RefreshCw style={{ width: '13px', height: '13px' }} />
              Refresh Now
            </button>
            <button
              onClick={handleDismiss}
              style={{
                color: '#9ca3af',
                fontSize: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 10px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#6b7280'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
            >
              Later
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            background: '#f3f4f6',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s',
            alignSelf: 'flex-start',
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
