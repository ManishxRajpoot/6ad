'use client'

import { Search, Bell, ChevronDown, Calendar } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuthStore()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left - Title */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>

        {/* Right - Search, Date, Notifications, Profile */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-64 pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Notifications */}
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
          </button>

          {/* Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">{user?.username || 'User'}</p>
              <p className="text-xs text-gray-500">User</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    </header>
  )
}
