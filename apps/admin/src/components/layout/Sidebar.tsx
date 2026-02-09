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
  LogOut,
  Megaphone,
  Globe,
  Bell,
  Monitor,
  Gift,
  Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

// Platform icons
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M23.94 12.06c0-.9-.08-1.76-.22-2.6H12v5.12h6.72c-.32 1.6-1.18 2.96-2.46 3.88l3.9 3.02c2.28-2.1 3.78-5.2 3.78-9.42z"/>
    <path fill="#34A853" d="M12 24.06c3.02 0 5.74-1.14 7.84-2.98l-3.9-3.02c-1.1.72-2.47 1.14-3.94 1.14-2.67 0-5-1.47-6.26-3.66l-4 3.1C4.2 21.36 7.8 24.06 12 24.06z"/>
    <path fill="#FBBC05" d="M5.74 14.54a7.15 7.15 0 0 1 0-4.44l-4-3.1A11.91 11.91 0 0 0 0 12.06c0 1.92.45 3.73 1.26 5.34l4.48-2.86z"/>
    <path fill="#EA4335" d="M12 5.06c1.68 0 3.19.58 4.39 1.54l3.28-3.28A11.96 11.96 0 0 0 12 .06c-4.74 0-8.8 2.76-10.74 6.76l4 3.1A7.05 7.05 0 0 1 12 5.06z"/>
  </svg>
)

const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
)

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.603.603 0 0 1 .272-.063c.12 0 .24.03.345.09.264.135.39.345.39.585 0 .196-.076.375-.21.515-.15.135-.39.27-.795.39-.06.016-.12.03-.18.045-.165.045-.345.09-.51.135-.075.016-.15.045-.225.075-.15.06-.255.135-.3.225-.045.105-.045.225 0 .36.09.195.18.39.285.585.12.24.375.705.66 1.125.36.54.78.99 1.245 1.35.27.195.54.36.81.495.15.075.27.15.375.225.27.165.42.39.435.6.03.21-.075.435-.285.615a1.665 1.665 0 0 1-.765.345 4.2 4.2 0 0 1-.84.12c-.225.015-.45.045-.675.105-.15.045-.285.12-.405.21-.21.165-.315.33-.315.465-.015.135.015.27.075.405.06.135.135.27.225.405.18.27.285.585.255.885-.045.405-.345.72-.735.84-.21.06-.435.09-.66.09-.21 0-.405-.03-.585-.075a4.065 4.065 0 0 0-.675-.12c-.15-.015-.3-.015-.45 0-.195.015-.39.045-.585.09-.255.06-.51.135-.765.225l-.09.03c-.255.09-.54.18-.84.255a4.62 4.62 0 0 1-1.095.135c-.375 0-.75-.045-1.11-.135a7.316 7.316 0 0 1-.84-.255l-.075-.03a8.06 8.06 0 0 0-.765-.225 3.975 3.975 0 0 0-.585-.09c-.15-.015-.3-.015-.45 0-.225.015-.45.06-.675.12-.195.045-.39.075-.585.075-.225 0-.45-.03-.66-.09-.39-.12-.69-.435-.735-.84-.03-.3.075-.615.255-.885.09-.135.165-.27.225-.405.06-.135.09-.27.075-.405 0-.135-.105-.3-.315-.465a1.11 1.11 0 0 0-.405-.21 4.62 4.62 0 0 0-.675-.105 4.2 4.2 0 0 1-.84-.12 1.665 1.665 0 0 1-.765-.345c-.21-.18-.315-.405-.285-.615.015-.21.165-.435.435-.6.105-.075.225-.15.375-.225.27-.135.54-.3.81-.495.465-.36.885-.81 1.245-1.35.285-.42.54-.885.66-1.125.105-.195.195-.39.285-.585.045-.135.045-.255 0-.36-.045-.09-.15-.165-.3-.225a1.665 1.665 0 0 0-.225-.075 6.6 6.6 0 0 1-.51-.135c-.06-.015-.12-.03-.18-.045-.405-.12-.645-.255-.795-.39a.585.585 0 0 1-.21-.515c0-.24.126-.45.39-.585a.69.69 0 0 1 .345-.09c.09 0 .18.015.27.063.375.18.735.285 1.035.3.198 0 .326-.044.4-.089a4.95 4.95 0 0 1-.032-.51l-.004-.06c-.103-1.628-.229-3.654.3-4.847C7.86 1.069 11.215.793 12.206.793z"/>
  </svg>
)

const BingIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#008373" d="M5 3v16.5l4.5 2.5 8-4.5v-4L9.5 10V5.5L5 3z"/>
    <path fill="#00A99D" d="M9.5 5.5V10l8 3.5v4l-8 4.5L5 19.5V3l4.5 2.5z"/>
  </svg>
)

// Logo Component matching Figma
const SixMediaLogo = () => (
  <div className="flex items-center gap-2">
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" fill="#52B788"/>
      <path d="M16 12C16 12 12 14 12 20C12 26 16 28 16 28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="22" cy="20" r="6" fill="white"/>
      <circle cx="22" cy="20" r="3" fill="#52B788"/>
    </svg>
    <span className="text-lg font-bold text-gray-800">SIX Media</span>
  </div>
)

type MenuItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }> | (() => React.ReactElement)
}

type MenuSection = {
  label?: string
  items: MenuItem[]
}

const menuSections: MenuSection[] = [
  {
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ]
  },
  {
    label: 'Management',
    items: [
      { name: 'Agents', href: '/agents', icon: UserCog },
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Transactions', href: '/transactions', icon: CreditCard },
      { name: 'Withdrawals', href: '/withdrawals', icon: ArrowUpRight },
      { name: 'Reports', href: '/reports', icon: FileText },
    ]
  },
  {
    label: 'Platforms',
    items: [
      { name: 'Facebook', href: '/facebook', icon: FacebookIcon },
      { name: 'Google', href: '/google', icon: GoogleIcon },
      { name: 'TikTok', href: '/tiktok', icon: TiktokIcon },
      { name: 'Snapchat', href: '/snapchat', icon: SnapchatIcon },
      { name: 'Bing', href: '/bing', icon: BingIcon },
      { name: 'BM Config', href: '/bm-config', icon: Monitor },
    ]
  },
  {
    label: 'Content',
    items: [
      { name: 'Announcements', href: '/announcements', icon: Megaphone },
      { name: 'Notifications', href: '/notifications', icon: Bell },
      { name: 'Coupons', href: '/coupons', icon: Ticket },
      { name: 'Referrals', href: '/referrals', icon: Gift },
    ]
  },
  {
    label: 'System',
    items: [
      { name: 'Domains', href: '/domain-requests', icon: Globe },
      { name: 'Settings', href: '/settings', icon: Settings },
    ]
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[200px] bg-white flex flex-col border-r border-gray-100">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <SixMediaLogo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto">
        <div className="space-y-4">
          {menuSections.map((section, sIdx) => (
            <div key={sIdx}>
              {section.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  const IconComponent = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                        isActive
                          ? 'bg-[#52B788] text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <IconComponent className={cn("w-4 h-4", isActive ? "text-white" : "text-gray-500")} />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* User Profile */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
            <span className="text-amber-600 font-semibold text-sm">
              {user?.username?.charAt(0).toUpperCase() || 'F'}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {user?.username || 'Francesco'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {user?.email || 'france@gmail.com'}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={() => {
              logout()
              window.location.href = '/login'
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </aside>
  )
}
