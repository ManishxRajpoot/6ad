'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  ArrowUpCircle,
  Receipt,
  Settings,
  LogOut,
  Globe,
  FileText,
  Wallet,
  CreditCard,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useAuthStore()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) onClose()
  }, [pathname])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-gray-100 flex flex-col z-50 transition-transform duration-300",
        "w-[240px] xl:w-[264px] 2xl:w-[288px]",
        // Mobile: hidden by default, show when isOpen
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            {user?.brandLogo ? (
              <img
                src={user.brandLogo}
                alt={user.brandName || 'Brand Logo'}
                className="h-10 max-w-[192px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2.5">
                {/* Six Media - Twisted Ribbon Infinity (Meta-style) */}
                <svg viewBox="0 0 48 28" className="w-12 h-7" fill="none">
                  <defs>
                    <linearGradient id="ribbonGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366F1"/>
                      <stop offset="100%" stopColor="#8B5CF6"/>
                    </linearGradient>
                    <linearGradient id="ribbonGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8B5CF6"/>
                      <stop offset="100%" stopColor="#EC4899"/>
                    </linearGradient>
                  </defs>
                  {/* Left ribbon - continuous twisted band */}
                  <path
                    d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14"
                    fill="url(#ribbonGrad1)"
                  />
                  {/* Right ribbon - continuous twisted band */}
                  <path
                    d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14"
                    fill="url(#ribbonGrad2)"
                  />
                  {/* Center twist overlay for depth */}
                  <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
                </svg>
                {/* Text - Modern Typography */}
                <div className="flex flex-col leading-none">
                  <span className="text-[19px] font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent tracking-tight">
                    SIXMEDIA
                  </span>
                  <span className="text-[8px] font-semibold tracking-[0.2em] text-gray-400">
                    ADVERTISING
                  </span>
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Main Menu */}
        <nav className="flex-1 px-4 overflow-y-auto">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/dashboard')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>

          {/* Add Money */}
          <Link
            href="/add-money"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/add-money')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Wallet className="w-5 h-5" />
            Add Money
          </Link>

          {/* Users */}
          <Link
            href="/users"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/users')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Users className="w-5 h-5" />
            Users
          </Link>

          {/* Ad Accounts */}
          <Link
            href="/ad-accounts"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/ad-accounts')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <CreditCard className="w-5 h-5" />
            Ad Accounts
          </Link>

          {/* Transactions */}
          <Link
            href="/transactions"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/transactions')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Receipt className="w-5 h-5" />
            Transactions
          </Link>

          {/* Withdrawals */}
          <Link
            href="/withdrawals"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/withdrawals')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <ArrowUpCircle className="w-5 h-5" />
            Withdrawals
          </Link>

          {/* BM & AD Request */}
          <Link
            href="/bm-ad-request"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/bm-ad-request')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <FileText className="w-5 h-5" />
            BM & AD Request
          </Link>

          {/* Whitelabel */}
          <Link
            href="/whitelabel"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/whitelabel')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Globe className="w-5 h-5" />
            Whitelabel
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 mb-1.5',
              isActive('/settings')
                ? 'bg-[#7C3AED] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-base font-medium">
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-gray-900 truncate">
                {user?.username || 'Agent'}
              </p>
              <p className="text-[12px] text-gray-500 truncate">{user?.email || 'agent@sixmedia.in'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
