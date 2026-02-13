'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Wallet, ChevronDown, Search, LayoutDashboard, UserCircle, ShieldCheck, LogOut, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  // Format wallet balance - show full amount with commas
  const formatBalance = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const walletBalance = Number(user?.walletBalance) || 0
  const couponBalance = Number(user?.couponBalance) || 0

  return (
    <header className="bg-white px-4 lg:px-5 py-3 border-b border-slate-100 relative z-50">
      <div className="flex items-center justify-between">
        {/* Left - Menu Button (mobile) + Welcome Message */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-9 h-9 rounded-lg bg-[#6366F1] flex items-center justify-center shadow-sm">
            <LayoutDashboard className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-[11px] text-slate-400 font-medium">{getGreeting()}</p>
            <h1 className="text-[13px] font-bold text-slate-800">
              {user?.username || 'Partner'}
            </h1>
          </div>
        </div>

        {/* Center - Search Bar */}
        <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={user?.email || 'Search users, accounts...'}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
            />
          </div>
        </div>

        {/* Right - Wallet, Notifications, Profile */}
        <div className="flex items-center gap-2">
          {/* Wallet Balance Card */}
          <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#6366F1] flex items-center justify-center">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium leading-none hidden sm:block">Wallet</p>
                <p className="text-[13px] font-bold text-slate-800">{formatBalance(walletBalance)}</p>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:block">
              <p className="text-[10px] text-slate-400 font-medium leading-none">Coupons</p>
              <p className="text-[13px] font-bold text-amber-500">{couponBalance}</p>
            </div>
          </div>

          {/* Notification Bell */}
          <button className="relative p-2 hover:bg-[#6366F1]/5 rounded-lg transition-all group">
            <Bell className="w-5 h-5 text-slate-500 group-hover:text-[#6366F1] transition-colors" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Divider */}
          <div className="h-7 w-px bg-slate-200 hidden sm:block" />

          {/* Profile with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="group"
            >
              <div className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-lg hover:bg-[#6366F1]/5 transition-all duration-300">
                <div className="relative">
                  {user?.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt={user.username || 'Profile'}
                      className="w-9 h-9 rounded-lg object-cover shadow-sm ring-1 ring-white group-hover:ring-[#6366F1]/20 transition-all duration-300"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-[#6366F1] flex items-center justify-center shadow-sm ring-1 ring-white group-hover:ring-[#6366F1]/20 transition-all duration-300">
                      <span className="text-white font-bold text-[13px]">
                        {user?.username?.charAt(0).toUpperCase() || 'P'}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#6366F1] rounded-full border-2 border-white" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-[13px] font-semibold text-slate-700 group-hover:text-[#6366F1] transition-colors leading-none">
                    {user?.username || 'Partner'}
                  </p>
                  <p className="text-[11px] text-slate-400">Partner</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 hidden sm:block transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown Menu */}
            <div
              className={`absolute right-0 top-full mt-1.5 w-52 bg-white rounded-lg shadow-lg border border-slate-100 overflow-hidden transition-all duration-300 ease-out origin-top-right ${
                showDropdown
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              }`}
            >
              {/* User Info */}
              <div className="px-3.5 py-2.5 border-b border-slate-100 bg-[#6366F1]/5">
                <p className="text-xs font-semibold text-slate-800">{user?.realName || user?.username || 'Partner'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-600 hover:bg-[#6366F1]/5 hover:text-[#6366F1] transition-all duration-200"
                >
                  <UserCircle className="w-4 h-4 text-slate-400" />
                  <span>Profile Settings</span>
                </Link>

                <Link
                  href="/settings?tab=security"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-600 hover:bg-[#6366F1]/5 hover:text-[#6366F1] transition-all duration-200"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>Security Settings</span>
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-600 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
                >
                  <LogOut className="w-4 h-4 text-slate-400" />
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
