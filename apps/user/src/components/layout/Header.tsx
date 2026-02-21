'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, ChevronDown, UserCircle, ShieldCheck, LogOut, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useDomainStore } from '@/store/domain'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NotificationBell } from '@/components/ui/NotificationBell'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuClick?: () => void
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const { isCustomDomain, branding } = useDomainStore()
  const router = useRouter()

  // Brand logo/name for mobile header
  const displayBrandLogo = isCustomDomain && branding?.brandLogo
    ? branding.brandLogo
    : user?.agent?.brandLogo
  const displayBrandName = isCustomDomain && branding?.brandName
    ? branding.brandName
    : user?.agent?.brandName || 'COINEST'
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Get wallet balance from user data (from API)
  const walletBalance = user?.walletBalance ? Number(user.walletBalance) : 0

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <header className="bg-white px-4 lg:px-6 py-2 lg:py-3 border-b border-gray-100 sticky top-0 z-50">
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(14deg); }
          40% { transform: rotate(-8deg); }
          60% { transform: rotate(14deg); }
          80% { transform: rotate(-4deg); }
        }
        .animate-wave {
          animation: wave 2s ease-in-out infinite;
          transform-origin: 70% 70%;
          display: inline-block;
        }
      `}</style>

      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center">
          {/* Mobile: Brand logo */}
          <div className="lg:hidden">
            <Link href="/dashboard" className="flex items-center">
              {displayBrandLogo ? (
                <img src={displayBrandLogo} alt={displayBrandName || 'Logo'} className="h-7 max-w-[130px] object-contain object-left" />
              ) : (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 48 28" className="w-9 h-6" fill="none">
                    <defs>
                      <linearGradient id="hdrRibbonGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366F1"/>
                        <stop offset="100%" stopColor="#8B5CF6"/>
                      </linearGradient>
                      <linearGradient id="hdrRibbonGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8B5CF6"/>
                        <stop offset="100%" stopColor="#EC4899"/>
                      </linearGradient>
                    </defs>
                    <path d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14" fill="url(#hdrRibbonGrad1)" />
                    <path d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14" fill="url(#hdrRibbonGrad2)" />
                  </svg>
                  <div className="flex flex-col leading-none">
                    <span className="text-[15px] font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent tracking-tight">SIXMEDIA</span>
                    <span className="text-[7px] font-semibold tracking-[0.15em] text-gray-400">ADVERTISING</span>
                  </div>
                </div>
              )}
            </Link>
          </div>

          {/* Desktop: Greeting */}
          <div className="hidden lg:flex items-center gap-3">
            <span className="text-2xl animate-wave">👋</span>
            <div>
              <p className="text-xs text-gray-400">{getGreeting()}</p>
              <h1 className="text-lg font-semibold text-[#1E293B]">
                {user?.username || 'User'}
              </h1>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Wallet Balance */}
          <Link href="/deposits" className="group">
            {/* Mobile wallet */}
            <div className="lg:hidden flex items-center gap-2 px-3 py-1.5 bg-[#F0FDF4] rounded-full border border-[#52B788]/20">
              <div className="w-6 h-6 rounded-full bg-[#52B788] flex items-center justify-center">
                <Wallet className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-bold text-[#1E293B] tabular-nums">
                ${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {/* Desktop wallet */}
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-[#52B788]/10 to-emerald-50 rounded-xl border border-[#52B788]/20 hover:border-[#52B788]/40 transition-all duration-300 hover:shadow-md hover:shadow-[#52B788]/10 hover:-translate-y-0.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#52B788] to-emerald-600 flex items-center justify-center shadow-sm">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-medium leading-none">Balance</span>
                <span className="text-base font-bold text-[#52B788] tabular-nums leading-tight">
                  ${walletBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </Link>

          {/* Notification Bell - desktop only */}
          <div className="hidden lg:block">
            <NotificationBell />
          </div>

          {/* Divider - desktop only */}
          <div className="h-8 w-px bg-gray-200 hidden lg:block" />

          {/* Profile with Dropdown - desktop only */}
          <div className="relative hidden lg:block" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="group"
            >
              <div className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-[#52B788]/5 transition-all duration-300">
                <div className="relative">
                  {user?.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt={user.username || 'Profile'}
                      className="w-9 h-9 rounded-xl object-cover shadow-sm ring-2 ring-white group-hover:ring-[#52B788]/20 transition-all duration-300"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#52B788] to-emerald-600 flex items-center justify-center shadow-sm ring-2 ring-white group-hover:ring-[#52B788]/20 transition-all duration-300">
                      <span className="text-white font-bold text-sm">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#52B788] rounded-full border-2 border-white" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-700 group-hover:text-[#52B788] transition-colors leading-none">
                    {user?.username || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-400">User</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 hidden sm:block transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown Menu */}
            <div
              className={`absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden transition-all duration-300 ease-out origin-top-right ${
                showDropdown
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              }`}
            >
              {/* User Info */}
              <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-[#52B788]/5 to-emerald-50/50">
                <p className="text-sm font-semibold text-slate-800">{(user as any)?.realName || user?.username || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  href="/settings?tab=profile"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-[#52B788]/5 hover:text-[#52B788] transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-[#52B788]/10 flex items-center justify-center transition-colors">
                    <UserCircle className="w-4 h-4 text-slate-500 group-hover:text-[#52B788] transition-colors" />
                  </div>
                  <span>Profile Settings</span>
                </Link>

                <Link
                  href="/settings?tab=security"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-[#52B788]/5 hover:text-[#52B788] transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-[#52B788]/10 flex items-center justify-center transition-colors">
                    <ShieldCheck className="w-4 h-4 text-slate-500 group-hover:text-[#52B788] transition-colors" />
                  </div>
                  <span>Security Settings</span>
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                    <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-500 transition-colors" />
                  </div>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
