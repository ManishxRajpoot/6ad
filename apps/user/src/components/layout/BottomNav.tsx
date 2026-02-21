'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wallet, Bell, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const HomeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className || 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
)

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 18 18" className={className || 'w-5 h-5'} fill="currentColor">
    <path d="M9.0007 1.58039e-06C11.2829 -0.00135006 13.4803 0.864345 15.1484 2.42189C16.8164 3.97944 17.8305 6.11251 17.9853 8.38943C18.1401 10.6663 17.4242 12.9171 15.9823 14.6861C14.5405 16.4551 12.4804 17.6103 10.2191 17.9179V11.4435H12.5478L12.9146 9.06638H10.2191V7.76588C10.2191 6.83325 10.506 5.99963 11.3115 5.90963L11.46 5.90175H12.9371V3.82613L12.6097 3.78563C12.2947 3.75188 11.8098 3.71363 11.091 3.71363C8.99845 3.71363 7.7407 4.78913 7.6597 7.227L7.6552 7.4835V9.0675H5.42883V11.4446H7.65633V17.9021C5.4129 17.5609 3.38111 16.385 1.96761 14.6097C0.554103 12.8345 -0.136826 10.591 0.033105 8.32811C0.203036 6.06526 1.22129 3.95005 2.88407 2.40584C4.54685 0.861639 6.73147 0.00236515 9.0007 1.58039e-06Z"/>
  </svg>
)

const navItems = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/facebook', label: 'Facebook', icon: FacebookIcon },
  { href: '/notifications', label: 'Alerts', icon: Bell },
  { href: '/settings', label: 'Account', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/deposits') return pathname === '/deposits' || pathname === '/withdrawals'
    if (href === '/settings') return pathname.startsWith('/settings')
    return pathname.startsWith(href)
  }

  const walletActive = isActive('/deposits')
  const leftItems = navItems.slice(0, 2)
  const rightItems = navItems.slice(2)

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="relative">
        <div className="bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
          <div className="flex items-end justify-around h-16 px-1">
            {/* Left items */}
            {leftItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors',
                    active ? 'text-[#52B788]' : 'text-gray-400'
                  )}
                >
                  <item.icon className="w-[22px] h-[22px]" />
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </Link>
              )
            })}

            {/* Center spacer + label */}
            <div className="flex flex-col items-center justify-end flex-1 py-2">
              <span className={cn(
                'text-[10px] font-semibold leading-none',
                walletActive ? 'text-[#52B788]' : 'text-gray-400'
              )}>Add Money</span>
            </div>

            {/* Right items */}
            {rightItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors',
                    active ? 'text-[#52B788]' : 'text-gray-400'
                  )}
                >
                  <item.icon className="w-[22px] h-[22px]" />
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Raised center button */}
        <Link
          href="/deposits"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 -top-6 w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-lg shadow-[#52B788]/25 transition-all active:scale-95 border-[3px] border-white',
            walletActive
              ? 'bg-[#52B788]'
              : 'bg-[#52B788]'
          )}
        >
          <Wallet className="w-6 h-6 text-white" />
        </Link>
      </div>
    </nav>
  )
}
