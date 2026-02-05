'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, Sparkles } from 'lucide-react'

const CHECK_INTERVAL = 30000 // Check every 30 seconds
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.6ad.in'

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

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
        // First load - store the current version
        setCurrentVersion(serverVersion)
        localStorage.setItem('app_version', serverVersion)
      } else if (serverVersion !== currentVersion) {
        // Version changed - update available!
        setUpdateAvailable(true)
      }
    } catch (error) {
      // Silently fail - don't show errors for version check
      console.debug('[UpdateChecker] Failed to check for updates')
    }
  }, [currentVersion])

  useEffect(() => {
    // Get stored version on mount
    const storedVersion = localStorage.getItem('app_version')
    if (storedVersion) {
      setCurrentVersion(storedVersion)
    }

    // Initial check
    checkForUpdates()

    // Set up interval
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [checkForUpdates])

  const handleRefresh = () => {
    // Clear cache and reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name)
        })
      })
    }
    window.location.reload()
  }

  const handleDismiss = () => {
    setDismissed(true)
    // Auto-show again after 5 minutes if still not refreshed
    setTimeout(() => setDismissed(false), 300000)
  }

  if (!updateAvailable || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-[99999] animate-slide-up">
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl shadow-2xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="bg-white/20 rounded-full p-2 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">New Update Available!</h4>
            <p className="text-xs text-white/80 mt-1">
              A new version is ready. Refresh to get the latest features and improvements.
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 bg-white text-purple-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/90 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Now
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-white/70 hover:text-white transition-colors"
              >
                Later
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
