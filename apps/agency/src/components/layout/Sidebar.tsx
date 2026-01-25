'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'

// Platform icons (official brand SVG logos)
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#FFFC00">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.42.42 0 0 1 .464.053c.15.135.18.359.074.555-.12.226-.351.396-.535.501-.249.146-.498.252-.69.319-.107.041-.174.066-.203.076a.588.588 0 0 0-.167.115c-.075.09-.09.21-.045.375.15.555.449 1.095.704 1.485.286.436.614.84.886 1.095.143.134.271.238.384.324.165.12.3.21.435.3l.003.003a.783.783 0 0 1 .313.44c.056.209.009.464-.18.66-.54.555-1.485.75-2.22.84-.195.03-.375.045-.495.06-.09.015-.165.03-.225.046-.195.3-.405.63-.66.93-.285.337-.616.627-.916.839a3.17 3.17 0 0 1-.72.375 7.09 7.09 0 0 1-1.65.405c-.45.075-.93.12-1.38.12-.449 0-.93-.045-1.38-.12a7.09 7.09 0 0 1-1.65-.405 3.17 3.17 0 0 1-.72-.375c-.3-.212-.63-.502-.915-.839-.256-.3-.466-.63-.66-.93-.06-.016-.135-.031-.226-.046-.12-.015-.3-.03-.494-.06-.735-.09-1.68-.285-2.22-.84-.19-.196-.237-.451-.181-.66a.783.783 0 0 1 .313-.44l.003-.003c.135-.09.27-.18.434-.3.114-.086.242-.19.385-.324.27-.255.6-.66.885-1.095.256-.39.555-.93.705-1.485.044-.165.03-.285-.046-.375a.588.588 0 0 0-.166-.115c-.03-.01-.097-.035-.204-.076a4.16 4.16 0 0 1-.69-.319c-.184-.105-.415-.275-.535-.501a.45.45 0 0 1 .074-.555.42.42 0 0 1 .464-.053c.374.18.733.285 1.033.301.198 0 .326-.045.401-.09a17.94 17.94 0 0 1-.03-.51l-.004-.06c-.104-1.628-.23-3.654.3-4.847C7.852 1.07 11.21.793 12.2.793h.006z"/>
  </svg>
)

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#25F4EE" d="M16.708 0.027c1.745-0.027 3.48-0.011 5.213-0.027 0.105 2.041 0.839 4.12 2.333 5.563 1.491 1.479 3.6 2.156 5.652 2.385v5.369c-1.923-0.063-3.855-0.463-5.6-1.291-0.76-0.344-1.468-0.787-2.161-1.24-0.009 3.896 0.016 7.787-0.025 11.667-0.104 1.864-0.719 3.719-1.803 5.255-1.744 2.557-4.771 4.224-7.88 4.276-1.907 0.109-3.812-0.411-5.437-1.369C4.307 29.027 2.412 26.12 2.136 23a22.3 22.3 0 0 1-.016-1.984c0.24-2.537 1.495-4.964 3.443-6.615 2.208-1.923 5.301-2.839 8.197-2.297 0.027 1.975-0.052 3.948-0.052 5.923-1.323-0.428-2.869-0.308-4.025 0.495a4.6 4.6 0 0 0-1.819 2.333c-0.276 0.676-0.197 1.427-0.181 2.145 0.317 2.188 2.421 4.027 4.667 3.828 1.489-0.016 2.916-0.88 3.692-2.145 0.251-0.443 0.532-0.896 0.547-1.417 0.131-2.385 0.079-4.76 0.095-7.145 0.011-5.375-0.016-10.735 0.025-16.093z"/>
    <path fill="#FE2C55" d="M16.708 0.027c1.745-0.027 3.48-0.011 5.213-0.027 0.105 2.041 0.839 4.12 2.333 5.563 1.491 1.479 3.6 2.156 5.652 2.385v5.369c-1.923-0.063-3.855-0.463-5.6-1.291-0.76-0.344-1.468-0.787-2.161-1.24-0.009 3.896 0.016 7.787-0.025 11.667-0.104 1.864-0.719 3.719-1.803 5.255-1.744 2.557-4.771 4.224-7.88 4.276-1.907 0.109-3.812-0.411-5.437-1.369-2.693-1.588-4.588-4.495-4.864-7.615a22.3 22.3 0 0 1-.016-1.984c0.24-2.537 1.495-4.964 3.443-6.615 2.208-1.923 5.301-2.839 8.197-2.297 0.027 1.975-0.052 3.948-0.052 5.923-1.323-0.428-2.869-0.308-4.025 0.495a4.6 4.6 0 0 0-1.819 2.333c-0.276 0.676-0.197 1.427-0.181 2.145 0.317 2.188 2.421 4.027 4.667 3.828 1.489-0.016 2.916-0.88 3.692-2.145 0.251-0.443 0.532-0.896 0.547-1.417 0.131-2.385 0.079-4.76 0.095-7.145 0.011-5.375-0.016-10.735 0.025-16.093z"/>
    <path fill="#000000" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
)

const BingIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#00809D" d="M5.063 0v18.281l4.968 2.969 9.063-4.125V12.75l-6.75-2.438-2.344 1.125v5.25l-1.875-1.125V0zm4.968 5.719l2.625.938v5.625l4.125 1.5v2.063l-6.75 3.094V5.719z"/>
  </svg>
)

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Deposits', href: '/deposits', icon: ArrowDownCircle },
  { name: 'Withdrawals', href: '/withdrawals', icon: ArrowUpCircle },
]

const platformItems = [
  { name: 'Facebook', href: '/facebook', icon: FacebookIcon },
  { name: 'Google', href: '/google', icon: GoogleIcon },
  { name: 'Snapchat', href: '/snapchat', icon: SnapchatIcon },
  { name: 'TikTok', href: '/tiktok', icon: TikTokIcon },
  { name: 'Bing', href: '/bing', icon: BingIcon },
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
          {user?.brandLogo ? (
            <img
              src={user.brandLogo}
              alt={user.brandName || 'Brand Logo'}
              className="h-8 max-w-[180px] object-contain"
            />
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">6</span>
              </div>
              <span className="text-white font-semibold text-xl">{user?.brandName || 'COINEST'}</span>
            </>
          )}
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

        {/* Platforms */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 px-3">Platforms</p>
          <ul className="space-y-1">
            {platformItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const IconComponent = item.icon
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
                    <IconComponent />
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
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.username || 'Agent'}
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
