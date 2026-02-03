'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Wallet,
  Settings,
  LogOut,
  BookOpen,
  Gift,
  Menu,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useDomainStore } from '@/store/domain'
import { useRouter } from 'next/navigation'
import { settingsApi, PlatformSettings } from '@/lib/api'

// Platform icons - Black/White outline style (w-6 h-6 to match other icons)
const FacebookIcon = () => (
  <svg viewBox="0 0 18 18" className="w-6 h-6" fill="currentColor">
    <path d="M9.0007 1.58039e-06C11.2829 -0.00135006 13.4803 0.864345 15.1484 2.42189C16.8164 3.97944 17.8305 6.11251 17.9853 8.38943C18.1401 10.6663 17.4242 12.9171 15.9823 14.6861C14.5405 16.4551 12.4804 17.6103 10.2191 17.9179V11.4435H12.5478L12.9146 9.06638H10.2191V7.76588C10.2191 6.83325 10.506 5.99963 11.3115 5.90963L11.46 5.90175H12.9371V3.82613L12.6097 3.78563C12.2947 3.75188 11.8098 3.71363 11.091 3.71363C8.99845 3.71363 7.7407 4.78913 7.6597 7.227L7.6552 7.4835V9.0675H5.42883V11.4446H7.65633V17.9021C5.4129 17.5609 3.38111 16.385 1.96761 14.6097C0.554103 12.8345 -0.136826 10.591 0.033105 8.32811C0.203036 6.06526 1.22129 3.95005 2.88407 2.40584C4.54685 0.861639 6.73147 0.00236515 9.0007 1.58039e-06Z"/>
  </svg>
)

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M2.97714 6.87661C3.74157 5.35537 4.91382 4.07656 6.36298 3.183C7.81214 2.28943 9.48117 1.81629 11.1837 1.81641C13.6587 1.81641 15.7379 2.72651 17.3276 4.20875L14.6946 6.84263C13.7422 5.93253 12.5318 5.46875 11.1837 5.46875C8.79133 5.46875 6.76633 7.08508 6.04541 9.25518C5.86174 9.8062 5.75704 10.394 5.75704 11.0001C5.75704 11.6062 5.86174 12.194 6.04541 12.745C6.76725 14.916 8.79133 16.5314 11.1837 16.5314C12.4189 16.5314 13.4704 16.2054 14.2933 15.6544C14.7703 15.3403 15.1787 14.9327 15.4938 14.4564C15.8088 13.98 16.024 13.4446 16.1263 12.8827H11.1837V9.33049H19.8329C19.9412 9.9311 20 10.5574 20 11.2085C20 14.0059 18.999 16.3606 17.2614 17.9585C15.7424 19.3618 13.6633 20.1838 11.1837 20.1838C9.97752 20.1842 8.7831 19.947 7.66866 19.4857C6.55423 19.0243 5.54164 18.3479 4.68876 17.495C3.83588 16.6421 3.15943 15.6295 2.69808 14.5151C2.23673 13.4007 1.99952 12.2062 2 11.0001C2 9.51784 2.35449 8.11641 2.97714 6.87661Z"/>
  </svg>
)

const SnapchatIcon = () => (
  <svg viewBox="0 0 20 19" className="w-6 h-6" fill="currentColor">
    <path d="M9.87076 18.765C8.68076 18.765 7.88676 18.203 7.17776 17.708C6.67376 17.351 6.20176 17.012 5.64476 16.918C5.37954 16.8726 5.11084 16.8505 4.84176 16.852C4.36976 16.852 3.99476 16.923 3.72776 16.977C3.55776 17.007 3.41576 17.035 3.30376 17.035C3.18776 17.035 3.04076 17.003 2.98376 16.807C2.93376 16.647 2.90276 16.495 2.87176 16.348C2.79176 15.978 2.72476 15.751 2.58576 15.728C1.09676 15.501 0.205758 15.158 0.0317582 14.752C0.0177582 14.708 0.00075833 14.662 0.00075833 14.627C-0.00924167 14.503 0.0807583 14.4 0.205758 14.377C1.38676 14.182 2.44776 13.553 3.34376 12.519C4.03976 11.716 4.37876 10.94 4.40976 10.856C4.40976 10.846 4.41876 10.846 4.41876 10.846C4.58943 10.4947 4.62343 10.1963 4.52076 9.951C4.32876 9.491 3.69576 9.295 3.26376 9.161C3.15276 9.131 3.05876 9.095 2.97876 9.068C2.60876 8.921 1.99276 8.608 2.07376 8.176C2.13176 7.864 2.54576 7.641 2.88476 7.641C2.97876 7.63967 3.05876 7.65633 3.12476 7.691C3.50476 7.864 3.84776 7.953 4.14176 7.953C4.50776 7.953 4.68176 7.815 4.72576 7.771C4.71644 7.5732 4.70477 7.37552 4.69076 7.178C4.60076 5.813 4.49876 4.119 4.93076 3.148C6.22876 0.241 8.98376 0.0079999 9.79976 0.0079999L10.1558 0H10.2058C11.0208 0 13.7758 0.227 15.0738 3.139C15.5108 4.11 15.4038 5.809 15.3138 7.169L15.3048 7.236C15.2968 7.418 15.2828 7.592 15.2748 7.771C15.3188 7.806 15.4788 7.94 15.8088 7.944C16.0948 7.936 16.4068 7.842 16.7628 7.681C16.8613 7.63828 16.9674 7.61584 17.0748 7.615C17.1998 7.615 17.3248 7.645 17.4318 7.681H17.4408C17.7398 7.793 17.9358 8.002 17.9358 8.221C17.9448 8.426 17.7838 8.738 17.0218 9.046C16.9418 9.076 16.8478 9.113 16.7368 9.139C16.3128 9.269 15.6798 9.474 15.4788 9.929C15.3678 10.169 15.4118 10.477 15.5818 10.825C15.5818 10.833 15.5908 10.833 15.5908 10.833C15.6398 10.958 16.9278 13.883 19.7948 14.36C19.8534 14.3699 19.9064 14.4006 19.9441 14.4466C19.9818 14.4926 20.0016 14.5506 19.9998 14.61C20.0004 14.6547 19.9901 14.6977 19.9688 14.739C19.7948 15.149 18.9118 15.483 17.4138 15.715C17.2758 15.737 17.2088 15.965 17.1288 16.335C17.0969 16.4892 17.0599 16.6423 17.0178 16.794C16.9728 16.941 16.8788 17.021 16.7178 17.021H16.6968C16.5542 17.0184 16.4122 17.002 16.2728 16.972C15.9062 16.894 15.5325 16.8551 15.1578 16.856C14.8891 16.8567 14.6209 16.8792 14.3558 16.923C13.8028 17.013 13.3258 17.356 12.8218 17.713C12.1038 18.203 11.3058 18.765 10.1248 18.765H9.87076Z"/>
  </svg>
)

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M16.6002 5.82C15.9167 5.03953 15.5401 4.0374 15.5402 3H12.4502V15.4C12.4268 16.0712 12.1437 16.7071 11.6605 17.1735C11.1773 17.6399 10.5318 17.9004 9.86016 17.9C8.44016 17.9 7.26016 16.74 7.26016 15.3C7.26016 13.58 8.92016 12.29 10.6302 12.82V9.66C7.18016 9.2 4.16016 11.88 4.16016 15.3C4.16016 18.63 6.92016 21 9.85016 21C12.9902 21 15.5402 18.45 15.5402 15.3V9.01C16.7932 9.90985 18.2975 10.3926 19.8402 10.39V7.3C19.8402 7.3 17.9602 7.39 16.6002 5.82Z"/>
  </svg>
)

const BingIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M10.1 8.6L11.8 12.9L14.6 14.2L9 17.5V3.4L5 2V19.8L9 22L19 16.2V11.7L10.1 8.6Z"/>
  </svg>
)

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useAuthStore()
  const { isCustomDomain, branding } = useDomainStore()
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    facebook: 'active',
    google: 'active',
    tiktok: 'active',
    snapchat: 'active',
    bing: 'active',
  })

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) onClose()
  }, [pathname])

  // Fetch platform visibility settings
  useEffect(() => {
    const fetchPlatformSettings = async () => {
      try {
        const response = await settingsApi.platforms.get()
        setPlatformSettings(response.platforms)
      } catch {
        // Silently fail - use default settings if API is unavailable
      }
    }
    fetchPlatformSettings()
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  // Helper to check if a platform should be shown (not 'hidden')
  const shouldShowPlatform = (platform: keyof PlatformSettings) => {
    return platformSettings[platform] !== 'hidden'
  }

  // Use custom domain branding if available, otherwise fall back to user's agent branding
  const displayBrandName = isCustomDomain && branding?.brandName
    ? branding.brandName
    : user?.agent?.brandName || 'COINEST'
  const displayBrandLogo = isCustomDomain && branding?.brandLogo
    ? branding.brandLogo
    : user?.agent?.brandLogo

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-screen w-[240px] bg-white border-r border-gray-100 flex flex-col z-50 transition-transform duration-300",
        // Mobile: hidden by default, show when isOpen
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* Show custom domain branding or agent's branding */}
            {displayBrandLogo ? (
              <img
                src={displayBrandLogo}
                alt={displayBrandName || 'Brand Logo'}
                className="h-8 max-w-[200px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2.5">
                {/* Six Media - Twisted Ribbon Infinity (Meta-style) */}
                <svg viewBox="0 0 48 28" className="w-12 h-7" fill="none">
                  <defs>
                    <linearGradient id="userRibbonGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366F1"/>
                      <stop offset="100%" stopColor="#8B5CF6"/>
                    </linearGradient>
                    <linearGradient id="userRibbonGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8B5CF6"/>
                      <stop offset="100%" stopColor="#EC4899"/>
                    </linearGradient>
                  </defs>
                  {/* Left ribbon - continuous twisted band */}
                  <path
                    d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14"
                    fill="url(#userRibbonGrad1)"
                  />
                  {/* Right ribbon - continuous twisted band */}
                  <path
                    d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14"
                    fill="url(#userRibbonGrad2)"
                  />
                  {/* Center twist overlay for depth */}
                  <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
                </svg>
                {/* Text - Modern Typography */}
                <div className="flex flex-col leading-none">
                  <span className="text-[17px] font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent tracking-tight">
                    SIXMEDIA
                  </span>
                  <span className="text-[8px] font-semibold tracking-[0.2em] text-gray-400 mt-0.5">
                    ADVERTISING
                  </span>
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Main Menu */}
        <nav className="flex-1 px-4 overflow-y-auto">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            data-tutorial="dashboard-menu"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
              isActive('/dashboard')
                ? 'bg-[#52B788] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <LayoutDashboard className="w-6 h-6" />
            Dashboard
          </Link>

          {/* Wallet */}
          <Link
            href="/deposits"
            data-tutorial="wallet-menu"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
              isActive('/deposits') || isActive('/withdrawals')
                ? 'bg-[#52B788] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Wallet className="w-6 h-6" />
            Wallet
          </Link>

          {/* Platform Links - Conditionally rendered based on visibility settings */}
          {shouldShowPlatform('facebook') && (
            <Link
              href="/facebook"
              data-tutorial="facebook-menu"
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
          )}

          {shouldShowPlatform('google') && (
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
          )}

          {shouldShowPlatform('snapchat') && (
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
          )}

          {shouldShowPlatform('tiktok') && (
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
          )}

          {shouldShowPlatform('bing') && (
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
          )}

          {/* Guide */}
          <Link
            href="/guide"
            data-tutorial="guide-menu"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
              isActive('/guide')
                ? 'bg-[#52B788] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <BookOpen className="w-6 h-6" />
            Guide
          </Link>

          {/* Referrals */}
          <Link
            href="/referrals"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 mb-1',
              isActive('/referrals')
                ? 'bg-[#52B788] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <Gift className="w-6 h-6" />
            Referrals
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
            <Settings className="w-6 h-6" />
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
    </>
  )
}
