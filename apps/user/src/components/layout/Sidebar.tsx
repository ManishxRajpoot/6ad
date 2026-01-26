'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Wallet,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'

// Platform icons
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
  <svg viewBox="0 0 500 500" className="w-5 h-5">
    <path fill="#FFFC00" d="M417.93,340.71c-60.61-29.34-70.27-74.64-70.7-78-.52-4.07-1.11-7.27,3.38-11.41,4.33-4,23.54-15.89,28.87-19.61,8.81-6.16,12.69-12.31,9.83-19.87-2-5.23-6.87-7.2-12-7.2a22.3,22.3,0,0,0-4.81.54c-9.68,2.1-19.08,6.95-24.52,8.26a8.56,8.56,0,0,1-2,.27c-2.9,0-4-1.29-3.72-4.78.68-10.58,2.12-31.23.45-50.52-2.29-26.54-10.85-39.69-21-51.32C316.8,101.43,294,77.2,250,77.2S183.23,101.43,178.35,107c-10.18,11.63-18.73,24.78-21,51.32-1.67,19.29-.17,39.93.45,50.52.2,3.32-.82,4.78-3.72,4.78a8.64,8.64,0,0,1-2-.27c-5.43-1.31-14.83-6.16-24.51-8.26a22.3,22.3,0,0,0-4.81-.54c-5.15,0-10,2-12,7.2-2.86,7.56,1,13.71,9.84,19.87,5.33,3.72,24.54,15.6,28.87,19.61,4.48,4.14,3.9,7.34,3.38,11.41-.43,3.41-10.1,48.71-70.7,78-3.55,1.72-9.59,5.36,1.06,11.24,16.72,9.24,27.85,8.25,36.5,13.82,7.34,4.73,3,14.93,8.34,18.61,6.56,4.53,25.95-.32,51,7.95,21,6.92,33.76,26.47,71,26.47s50.37-19.64,71-26.47c25-8.27,44.43-3.42,51-7.95,5.33-3.68,1-13.88,8.34-18.61,8.65-5.57,19.77-4.58,36.5-13.82C427.52,346.07,421.48,342.43,417.93,340.71Z"/>
  </svg>
)

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#000000">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
)

const BingIcon = () => (
  <svg viewBox="0 0 29700 21000" className="w-5 h-5">
    <defs>
      <linearGradient id="bingGradient" x1="9438.21" y1="2509.42" x2="9012.51" y2="23085.06" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#26B8F4"/>
        <stop offset="1" stopColor="#1B48EF"/>
      </linearGradient>
    </defs>
    <polygon fill="url(#bingGradient)" points="8475.16,1399.66 12124.09,2685.03 12136.1,15485.22 17223.25,12520.22 14741.02,11358.99 13148.22,7402.88 21223.77,10231.3 21217.16,14376.26 12123.05,19614.59 8487.02,17591.25"/>
  </svg>
)

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* Show agent's branding if user belongs to an agent with custom branding */}
          {user?.agent?.brandLogo ? (
            <img
              src={user.agent.brandLogo}
              alt={user.agent.brandName || 'Brand Logo'}
              className="h-8 max-w-[200px] object-contain"
            />
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <span className="text-yellow-400 text-lg">⚡</span>
              </div>
              <span className="text-gray-900 font-semibold text-xl tracking-tight">
                {user?.agent?.brandName || 'COINEST'}
              </span>
            </>
          )}
        </Link>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 px-4 overflow-y-auto">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
            isActive('/dashboard')
              ? 'bg-[#52B788] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          Dashboard
        </Link>

        {/* Wallet */}
        <Link
          href="/deposits"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
            isActive('/deposits') || isActive('/withdrawals')
              ? 'bg-[#52B788] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <Wallet className="w-5 h-5" />
          Wallet
        </Link>

        {/* Platform Links */}
        <Link
          href="/facebook"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
            pathname === '/facebook'
              ? 'bg-[#52B788] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <FacebookIcon />
          Facebook
        </Link>

        <Link
          href="/google"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
            pathname === '/google'
              ? 'bg-[#52B788] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <GoogleIcon />
          Google
        </Link>

        <Link
          href="/snapchat"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
            pathname === '/snapchat'
              ? 'bg-[#52B788] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <SnapchatIcon />
          Snapchat
        </Link>

        <Link
          href="/tiktok"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
            pathname === '/tiktok'
              ? 'bg-[#52B788] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <TikTokIcon />
          Tiktok
        </Link>

        <Link
          href="/bing"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
            pathname === '/bing'
              ? 'bg-[#52B788] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <BingIcon />
          Bing
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
            isActive('/settings')
              ? 'bg-[#52B788] text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
            {user?.username?.charAt(0).toUpperCase() || 'T'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.username || 'TestUser'}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email || 'user@6ad.in'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
