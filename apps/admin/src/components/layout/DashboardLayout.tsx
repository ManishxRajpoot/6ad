'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuthStore } from '@/store/auth'
import { authApi, dashboardApi } from '@/lib/api'

type DashboardLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const router = useRouter()
  const { isAuthenticated, isHydrated, setAuth, logout } = useAuthStore()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    // Wait for zustand to hydrate from localStorage
    if (!isHydrated) return

    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      // If already authenticated, skip the API call
      if (isAuthenticated) return

      try {
        const { user } = await authApi.me()
        if (user.role !== 'ADMIN') {
          logout()
          router.push('/login')
          return
        }
        setAuth(user, token)
      } catch (error) {
        logout()
        router.push('/login')
      }
    }

    checkAuth()
  }, [isHydrated, isAuthenticated, router, setAuth, logout])

  // Fetch pending counts for bell notification
  useEffect(() => {
    if (!isAuthenticated) return
    const fetchPending = async () => {
      try {
        const data = await dashboardApi.getStats()
        const s = data.stats || {}
        setPendingCount(
          (s.pendingDeposits || 0) + (s.pendingWithdrawals || 0) +
          (s.pendingRefunds || 0) + (s.pendingAccounts || 0)
        )
      } catch { /* ignore — bell just won't show dot */ }
    }
    fetchPending()
    // Re-check every 60s
    const interval = setInterval(fetchPending, 60_000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Show loading only during initial hydration
  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <Sidebar />
      <div className="ml-[230px] transition-all duration-300">
        <Header title={title} subtitle={subtitle} pendingCount={pendingCount} />
        <main className="p-5">{children}</main>
      </div>
    </div>
  )
}
