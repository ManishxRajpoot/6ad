'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCog,
  ArrowLeftRight,
  Facebook,
  Chrome,
  Music2,
  Ghost,
  Search,
  Wallet,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useState } from 'react'

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agents', href: '/agents', icon: UserCog },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  {
    name: 'Platforms',
    icon: Wallet,
    submenu: [
      { name: 'Facebook', href: '/platforms/facebook', icon: Facebook },
      { name: 'Google', href: '/platforms/google', icon: Chrome },
      { name: 'TikTok', href: '/platforms/tiktok', icon: Music2 },
      { name: 'Snapchat', href: '/platforms/snapchat', icon: Ghost },
      { name: 'Bing', href: '/platforms/bing', icon: Search },
    ],
  },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const logout = useAuthStore((state) => state.logout)
  const [platformsOpen, setPlatformsOpen] = useState(false)

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-6 border-b border-white/10">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500">
            <span className="text-lg font-bold text-white">6</span>
          </div>
          <span className="text-xl font-semibold text-white">COINEST</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {menuItems.map((item) => {
            if (item.submenu) {
              const isSubActive = item.submenu.some((sub) => pathname.startsWith(sub.href))
              return (
                <div key={item.name}>
                  <button
                    onClick={() => setPlatformsOpen(!platformsOpen)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isSubActive
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </div>
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', platformsOpen && 'rotate-180')}
                    />
                  </button>
                  {platformsOpen && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.submenu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            pathname === sub.href
                              ? 'bg-primary-500/20 text-primary-400'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          <sub.icon className="h-4 w-4" />
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => {
              logout()
              window.location.href = '/login'
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  )
}
