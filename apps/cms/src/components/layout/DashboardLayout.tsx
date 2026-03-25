'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'

type DashboardLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const router = useRouter()
  const { isAuthenticated, isHydrated, setAuth, logout } = useAuthStore()

  useEffect(() => {
    if (!isHydrated) return

    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }
      if (isAuthenticated) {
        // Verify token is still valid
        try {
          await api('/auth/me', { token })
        } catch {
          // Token invalid — clear everything and redirect
          localStorage.removeItem('token')
          localStorage.removeItem('auth-storage')
          localStorage.removeItem('cms-auth')
          logout()
          router.push('/login')
        }
        return
      }
      // Not authenticated, no valid session
      localStorage.removeItem('token')
      localStorage.removeItem('auth-storage')
      localStorage.removeItem('cms-auth')
      logout()
      router.push('/login')
    }

    checkAuth()
  }, [isHydrated, isAuthenticated, router, setAuth, logout])

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="h-screen bg-[#F8F9FC] overflow-hidden">
      <Sidebar />
      <div className="ml-[230px] h-full flex flex-col transition-all duration-300">
        <Header title={title} subtitle={subtitle} pendingCount={0} />
        <main className="px-4 py-3 flex-1 overflow-y-auto flex flex-col">{children}</main>
      </div>
    </div>
  )
}
