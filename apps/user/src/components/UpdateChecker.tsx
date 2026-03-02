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
    <>
      {/* Mobile: Bottom toast above nav bar */}
      <div
        className="fixed left-3 right-3 z-[99999] md:hidden"
        style={{
          bottom: '72px',
          transform: isAnimating ? 'translateY(0)' : 'translateY(20px)',
          opacity: isAnimating ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out',
        }}
      >
        <div className="bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden"
          style={{ boxShadow: '0 8px 30px rgba(124, 58, 237, 0.15), 0 0 0 1px rgba(124, 58, 237, 0.08)' }}
        >
          {/* Purple gradient accent bar */}
          <div className="h-0.5 bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600" />

          <div className="flex items-center gap-3 p-3">
            {/* Icon */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center flex-shrink-0">
              <ArrowUpCircle className="w-[18px] h-[18px] text-purple-600" strokeWidth={2.2} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-800 leading-tight">Update Available</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Tap to refresh & get latest version</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' }}
              >
                <RefreshCw className="w-3 h-3" />
                Update
              </button>
              <button
                onClick={handleDismiss}
                className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center active:bg-gray-100"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Center modal (existing design, refined) */}
      <div className="fixed inset-0 z-[99999] hidden md:flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto bg-white rounded-2xl p-4 min-w-[300px] max-w-[360px] flex items-center gap-3 border border-purple-100"
          style={{
            boxShadow: '0 16px 40px rgba(124, 58, 237, 0.2), 0 0 0 1px rgba(124, 58, 237, 0.1)',
            transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(8px)',
            opacity: isAnimating ? 1 : 0,
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease-out',
          }}
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center flex-shrink-0">
            <ArrowUpCircle className="w-[22px] h-[22px] text-purple-600" strokeWidth={2} />
          </div>

          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-800 mb-0.5">New Update Available!</h2>
            <p className="text-xs text-gray-500 mb-2.5 leading-relaxed">
              A new version has been deployed. Refresh to get the latest changes.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:-translate-y-px"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                  boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)',
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Now
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-gray-400 hover:text-gray-600 px-2.5 py-1.5 transition-colors"
              >
                Later
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 self-start transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>
    </>
  )
}
