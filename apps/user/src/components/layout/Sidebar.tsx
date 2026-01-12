'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'

// Platform icons
const FacebookIcon = () => (
  <div className="w-5 h-5 rounded-full bg-[#1877F2] flex items-center justify-center">
    <span className="text-white text-xs font-bold">f</span>
  </div>
)

const GoogleIcon = () => (
  <div className="w-5 h-5 rounded-full bg-[#4285F4] flex items-center justify-center">
    <span className="text-white text-xs font-bold">G</span>
  </div>
)

const SnapchatIcon = () => (
  <div className="w-5 h-5 rounded-full bg-[#FFFC00] flex items-center justify-center">
    <span className="text-black text-xs font-bold">S</span>
  </div>
)

const TikTokIcon = () => (
  <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
    <span className="text-white text-xs font-bold">T</span>
  </div>
)

const BingIcon = () => (
  <div className="w-5 h-5 rounded-full bg-[#00809D] flex items-center justify-center">
    <span className="text-white text-xs font-bold">B</span>
  </div>
)

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'My Accounts', href: '/accounts', icon: Wallet },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Deposits', href: '/deposits', icon: ArrowDownCircle },
  { name: 'Withdrawals', href: '/withdrawals', icon: ArrowUpCircle },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">6</span>
          </div>
          <span className="text-white font-semibold text-xl">COINEST</span>
        </Link>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 px-3">Main Menu</p>
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Settings */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 px-3">Settings</p>
          <ul className="space-y-1">
            <li>
              <Link
                href="/settings"
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === '/settings'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
                )}
              >
                <Settings className="w-5 h-5" />
                Settings
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center">
            <span className="text-white font-medium">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.username || 'User'}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-sidebar-hover rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}
