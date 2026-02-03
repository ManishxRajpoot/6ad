'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/lib/api'
import { Mandatory2FASetup } from '@/components/Mandatory2FASetup'
import { AnnouncementBanner } from '@/components/ui/AnnouncementBanner'
import { LiveChat } from '@/components/ui/LiveChat'
import { ProfileSetupPrompt } from '@/components/ui/ProfileSetupPrompt'

type DashboardLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const router = useRouter()
  const { isAuthenticated, isHydrated, setAuth, logout, user } = useAuthStore()

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
        if (user.role !== 'USER') {
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
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
      {/* Announcement Banner at top */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <AnnouncementBanner />
      </div>

      <Sidebar />
      <div className="ml-[240px] h-full flex flex-col">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 p-6 overflow-hidden flex flex-col">{children}</main>
      </div>

      {/* Live Chat Widget */}
      <LiveChat />

      {/* Mandatory 2FA Setup Modal - Non-cancellable */}
      {needs2FASetup && <Mandatory2FASetup />}

      {/* Profile Picture Setup Prompt - Shows after 2FA setup is complete */}
      {!needs2FASetup && <ProfileSetupPrompt />}
    </div>
  )
}
