'use client'

import { Wallet, Bell } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuthStore()

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
    <header className="bg-white px-6 py-3 border-b border-gray-100 relative overflow-hidden">
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
        {/* Left - Welcome Message with Wave */}
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-wave">👋</span>
          <div>
            <p className="text-xs text-gray-400">{getGreeting()}</p>
            <h1 className="text-lg font-semibold text-[#1E293B]">
              {user?.username || 'User'}
            </h1>
          </div>
        </div>

        {/* Right - Balance, Notifications, Profile */}
        <div className="flex items-center gap-3">
          {/* Balance Card */}
          <Link href="/deposits" className="group">
            <div className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-[#52B788]/10 to-emerald-50 rounded-xl border border-[#52B788]/20 hover:border-[#52B788]/40 transition-all duration-300 hover:shadow-md hover:shadow-[#52B788]/10 hover:-translate-y-0.5">
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

          {/* Notification Bell */}
          <button className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-300 hover:scale-105 group">
            <Bell className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </button>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-200 hidden sm:block" />

          {/* Profile */}
          <Link href="/settings" className="group">
            <div className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-50 transition-all duration-300">
              <div className="relative">
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.username || 'Profile'}
                    className="w-9 h-9 rounded-full object-cover shadow-sm group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                    <span className="text-white font-semibold text-sm">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#52B788] rounded-full border-2 border-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-[#52B788] transition-colors hidden sm:block">
                {user?.username || 'User'}
              </span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}
