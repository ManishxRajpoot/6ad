'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/lib/api'

export function TitleProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const updateUser = useAuthStore((state) => state.updateUser)
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const token = useAuthStore((state) => state.token)

  // Set title helper
  const setTitle = (agentName?: string | null) => {
    document.title = `${agentName || 'Ads System'} - Ad Account Management`
  }

  // On mount and when authenticated, fetch fresh data and set title
  useEffect(() => {
    if (!isHydrated) return

    const updateTitle = async () => {
      // Skip API call on login page — token may be stale from previous session
      const isLoginPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/login')

      // If authenticated and not on login page, fetch fresh user data
      if (isAuthenticated && token && !isLoginPage) {
        try {
          const response = await authApi.me()
          if (response.user) {
            updateUser(response.user)
            setTitle(response.user.agent?.username)
            return
          }
        } catch (e) {
          // Fall through to use stored data
        }
      }

      // Use stored user data or default
      setTitle(user?.agent?.username)
    }

    updateTitle()
  }, [isHydrated, isAuthenticated, token])

  // Also update title when user data changes in store
  useEffect(() => {
    if (isHydrated) {
      setTitle(user?.agent?.username)
    }
  }, [isHydrated, user?.agent?.username])

  // Re-apply title when tab becomes visible
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setTitle(user?.agent?.username)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.agent?.username])

  return <>{children}</>
}
