'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/lib/api'
import { Mandatory2FASetup } from '@/components/Mandatory2FASetup'
import { ProfileSetupPrompt } from '@/components/ui/ProfileSetupPrompt'

type DashboardLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isHydrated, setAuth, logout, user } = useAuthStore()
  const [isPageLoaded, setIsPageLoaded] = useState(false)
  // Move useState before any conditional returns to follow Rules of Hooks
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Reset animation on route change
  useEffect(() => {
    setIsPageLoaded(false)
    const timer = setTimeout(() => setIsPageLoaded(true), 50)
    return () => clearTimeout(timer)
  }, [pathname])

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
        if (user.role !== 'AGENT') {
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

  // Show loading only during initial hydration
  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FA]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#52B788] border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Check if user needs to complete 2FA setup
  const needs2FASetup = user && (!user.emailVerified || !user.twoFactorEnabled)

  return (
    <div className="h-screen overflow-hidden bg-[#F8F9FA]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[240px] xl:ml-[264px] 2xl:ml-[288px] h-full flex flex-col transition-all duration-300">
        <Header title={title} subtitle={subtitle} onMenuClick={() => setSidebarOpen(true)} />
        <main className={`flex-1 p-3 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-out ${isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          {children}
        </main>
      </div>

      {/* Mandatory 2FA Setup Modal - Non-cancellable */}
      {needs2FASetup && <Mandatory2FASetup />}

      {/* Profile Picture Setup Prompt - Shows after 2FA setup is complete */}
      {!needs2FASetup && <ProfileSetupPrompt />}
    </div>
  )
}
