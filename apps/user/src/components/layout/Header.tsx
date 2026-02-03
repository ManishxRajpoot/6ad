'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, ChevronDown, UserCircle, ShieldCheck, LogOut, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
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
  const router = useRouter()
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
    <header className="bg-white px-4 lg:px-6 py-3 border-b border-gray-100 relative z-50">
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(14deg); }
          40% { transform: rotate(-8deg); }
          60% { transform: rotate(14deg); }
          80% { transform: rotate(-4deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .animate-wave {
          animation: wave 2s ease-in-out infinite;
          transform-origin: 70% 70%;
          display: inline-block;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      {/* Subtle Background Line */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-[20%] right-[30%] top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
      </div>

      <div className="flex items-center justify-between relative z-10">
        {/* Left - Menu Button (mobile) + Welcome Message with Wave */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <span className="text-xl lg:text-2xl animate-wave">👋</span>
          <div>
            <p className="text-[10px] lg:text-xs text-gray-400">{getGreeting()}</p>
            <h1 className="text-sm lg:text-lg font-semibold text-[#1E293B]">
              {user?.username || 'User'}
            </h1>
          </div>
        </div>

        {/* Right - Balance, Notifications, Profile */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Balance Card */}
          <Link href="/deposits" className="group">
            <div className="flex items-center gap-1.5 lg:gap-2.5 px-2 lg:px-3 py-1.5 lg:py-2 bg-gradient-to-r from-[#52B788]/10 to-emerald-50 rounded-lg lg:rounded-xl border border-[#52B788]/20 hover:border-[#52B788]/40 transition-all duration-300 hover:shadow-md hover:shadow-[#52B788]/10 hover:-translate-y-0.5">
              <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-md lg:rounded-lg bg-gradient-to-br from-[#52B788] to-emerald-600 flex items-center justify-center shadow-sm">
                <Wallet className="w-3 h-3 lg:w-4 lg:h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] lg:text-[10px] text-gray-400 font-medium leading-none hidden sm:block">Balance</span>
                <span className="text-xs lg:text-base font-bold text-[#52B788] tabular-nums leading-tight">
                  ${walletBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </Link>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Divider */}
          <div className="h-8 w-px bg-gray-200 hidden sm:block" />

          {/* Profile with Dropdown */}
          <div className="relative" ref={dropdownRef}>
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
