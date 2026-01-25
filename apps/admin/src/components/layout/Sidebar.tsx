'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCog,
  CreditCard,
  FileText,
  ArrowUpRight,
  Settings,
  Bell,
  LogOut,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agents', href: '/agents', icon: UserCog },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Reports', href: '/reports', icon: FileText },
  {
    name: 'Facebook',
    href: '/facebook',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z" />
      </svg>
    )
  },
  {
    name: 'Google',
    href: '/google',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    )
  },
  {
    name: 'Snapchat',
    href: '/snapchat',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12.166 3a5.111 5.111 0 0 0-5.111 5.111v.002c0 1.023-.236 1.906-.917 2.726a5.11 5.11 0 0 1 3.945 1.498A1.145 1.145 0 0 0 11.5 13a1.145 1.145 0 0 0 1.417-.663 5.11 5.11 0 0 1 3.945-1.498c-.681-.82-.917-1.703-.917-2.726v-.002A5.111 5.111 0 0 0 12.166 3z"/>
      </svg>
    )
  },
  {
    name: 'Tiktok',
    href: '/tiktok',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    )
  },
  {
    name: 'Bing',
    href: '/bing',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="m5.71 3 3.593 1.264v12.645l5.061-2.919-2.48-1.165-1.566-3.897 7.974 2.802v4.073l-8.984 5.183-3.595-2L5.71 3z"/>
      </svg>
    )
  },
  { name: 'Withdrawals', href: '/withdrawals', icon: ArrowUpRight },
  { name: 'User Setting', href: '/user-settings', icon: Settings2 },
  { name: 'Notices', href: '/notices', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 bg-[#1a1d29] flex flex-col overflow-hidden border-r border-white/5">
      {/* Logo */}
      <div className="flex items-center justify-center px-5 py-6 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm">6</span>
          </div>
          <span className="text-white font-bold text-lg">Media</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const IconComponent = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
                  isActive
                    ? 'bg-[#8B5CF6] text-white shadow-lg shadow-purple-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                )}
              >
                {typeof IconComponent === 'function' && (
                  <span className="h-4 w-4 flex-shrink-0 flex items-center justify-center">
                    <IconComponent />
                  </span>
                )}
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-white/5 p-3 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-pointer group hover:scale-[1.02]">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-white font-semibold text-sm shadow-md transition-all duration-200 group-hover:shadow-lg group-hover:shadow-purple-500/30">
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#52B788] rounded-full border-2 border-[#1a1d29] animate-pulse"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.username || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email || 'admin@6ad.in'}</p>
          </div>
          <button
            onClick={() => {
              logout()
              window.location.href = '/login'
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>
    </aside>
  )
}
