'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, ArrowUpCircle } from 'lucide-react'

const CHECK_INTERVAL = 30000 // Check every 30 seconds
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.6ad.in'

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const checkForUpdates = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/version`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (!response.ok) return

      const data = await response.json()
      const serverVersion = data.version

      if (!currentVersion) {
        setCurrentVersion(serverVersion)
        localStorage.setItem('app_version', serverVersion)
      } else if (serverVersion !== currentVersion) {
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
  }, [currentVersion])

  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version')
    if (storedVersion) {
      setCurrentVersion(storedVersion)
    }

    checkForUpdates()
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [checkForUpdates])

  const handleRefresh = async () => {
    try {
      // Fetch the new version first
      const response = await fetch(`${API_URL}/version`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (response.ok) {
        const data = await response.json()
        // Save the new version to localStorage BEFORE reloading
        localStorage.setItem('app_version', data.version)
      }
    } catch (error) {
      console.debug('[UpdateChecker] Failed to fetch version before refresh')
    }

    // Clear caches
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map(name => caches.delete(name)))
    }

    // Force hard reload
    window.location.reload()
  }

  const handleDismiss = () => {
    setIsAnimating(false)
    setTimeout(() => {
      setDismissed(true)
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
          minWidth: '260px',
          maxWidth: '320px',
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
          background: '#f5f3ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ArrowUpCircle style={{ width: '20px', height: '20px', color: '#0D9488' }} strokeWidth={2} />
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#1f2937', fontSize: '13px', fontWeight: 600, margin: '0 0 2px 0' }}>Update Available</h2>
          <p style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 8px 0', lineHeight: 1.4 }}>
            Refresh to get the latest features.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRefresh}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#0D9488',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#0F766E'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0D9488'}
            >
              <RefreshCw style={{ width: '12px', height: '12px' }} />
              Refresh
            </button>
            <button
              onClick={handleDismiss}
              style={{
                color: '#9ca3af',
                fontSize: '11px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 8px',
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
