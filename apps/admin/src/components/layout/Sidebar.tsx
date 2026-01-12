'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCog,
  CreditCard,
  FileText,
  Facebook,
  Chrome,
  Ghost,
  Music2,
  Search,
  ArrowUpRight,
  Settings,
  Bell,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agents', href: '/agents', icon: UserCog },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Facebook', href: '/facebook', icon: Facebook },
  { name: 'Google', href: '/google', icon: Chrome },
  { name: 'Snapchat', href: '/snapchat', icon: Ghost },
  { name: 'TikTok', href: '/tiktok', icon: Music2 },
  { name: 'Bing', href: '/bing', icon: Search },
  { name: 'Withdrawals', href: '/withdrawals', icon: ArrowUpRight },
  { name: 'User Settings', href: '/user-settings', icon: Settings },
  { name: 'Notices', href: '/notices', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const logout = useAuthStore((state) => state.logout)

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[220px] bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500">
          <span className="text-base font-bold text-white">6</span>
        </div>
        <span className="text-lg font-semibold text-white tracking-wide">COINEST</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <div className="space-y-0.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => {
            logout()
            window.location.href = '/login'
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-gray-400 transition-colors hover:bg-sidebar-hover hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Logout
        </button>
      </div>
    </aside>
  )
}
