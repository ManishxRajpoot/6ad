'use client'

import { Search, Settings } from 'lucide-react'
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

  return (
    <header className="bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left - Welcome Message */}
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B]">
            Hi, Welcome {user?.username || 'Ali Baloch'}
          </h1>
        </div>

        {/* Right - Search, Balance, Settings, Profile */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search placeholder"
              className="w-52 pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
            />
          </div>

          {/* Balance */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Balance</span>
            <span className="text-lg font-bold text-[#52B788]">
              $ {walletBalance.toLocaleString()}
            </span>
          </div>

          {/* Settings Icon */}
          <Link href="/settings">
            <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </Link>

          {/* Profile */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-900">{user?.username || 'Andrew Forbist'}</span>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user?.username?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#52B788] rounded-full border-2 border-white"></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
