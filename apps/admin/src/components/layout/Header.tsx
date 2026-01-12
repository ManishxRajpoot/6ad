'use client'

import { Bell, Search, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import Image from 'next/image'

type HeaderProps = {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const user = useAuthStore((state) => state.user)

  return (
    <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between bg-background px-6">
      {/* Left - Title */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search here..."
            className="h-9 w-[200px] rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Date Picker Placeholder */}
        <button className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 hover:bg-gray-50">
          <span>Jan 12, 2026 - Jan 12, 2026</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-50">
          <Bell className="h-[18px] w-[18px] text-gray-600" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            3
          </span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 leading-tight">{user?.username || 'Andrew Parker'}</p>
            <p className="text-xs text-gray-500 leading-tight">{user?.role || 'Admin'}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 ml-1" />
        </div>
      </div>
    </header>
  )
}
