'use client'

import { cn } from '@/lib/utils'
import {
  Search,
  LayoutGrid,
  CreditCard,
  EyeOff,
  RefreshCw,
  Share2,
  Zap,
  Target,
  Save,
  FileText,
  Settings,
  Bell,
  Headphones,
} from 'lucide-react'

type MenuItem = {
  name: string
  icon: React.ComponentType<{ className?: string }>
  active?: boolean
  comingSoon?: boolean
  badge?: string
}

const menuItems: MenuItem[] = [
  { name: 'Ads Check Pro', icon: Search, active: true },
  { name: 'Ads Manager', icon: LayoutGrid, comingSoon: true, badge: 'New' },
  { name: 'Extended Payment', icon: CreditCard, comingSoon: true },
  { name: 'Remove Hidden Ads', icon: EyeOff, comingSoon: true },
  { name: 'Change Account', icon: RefreshCw, comingSoon: true },
  { name: 'Share Pixel', icon: Share2, comingSoon: true },
  { name: 'Super Share', icon: Zap, comingSoon: true, badge: 'Update' },
  { name: 'Super Target', icon: Target, comingSoon: true },
  { name: 'Ads Save', icon: Save, comingSoon: true },
  { name: 'Appeal Ad Account', icon: FileText, comingSoon: true },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[240px] bg-gradient-to-b from-emerald-600 to-emerald-700 flex flex-col shadow-xl">
      {/* Logo / Branding */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
            <Search className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[17px] font-bold text-white tracking-tight leading-tight">
              Ads Check
            </span>
            <span className="text-[11px] text-emerald-200/80 font-medium">
              by 6AD
            </span>
          </div>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-400/30 text-[9px] font-bold text-white uppercase tracking-wider">
            Launched
          </span>
        </div>
      </div>

      {/* Agency info box */}
      <div className="mx-3 mb-3 px-3 py-2.5 rounded-lg bg-white/10 backdrop-blur-sm">
        <p className="text-[11px] font-semibold text-white">6AD Tools</p>
        <p className="text-[10px] text-emerald-200/70 leading-tight mt-0.5">
          Professional Facebook Ads Management Tools
        </p>
      </div>

      {/* Menu label */}
      <div className="px-5 py-2">
        <span className="text-[10px] font-semibold text-emerald-300/60 uppercase tracking-[0.15em]">
          Menu
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.name}
              disabled={item.comingSoon}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all relative group',
                item.active
                  ? 'bg-white text-emerald-700 font-semibold shadow-sm'
                  : item.comingSoon
                    ? 'text-emerald-200/50 cursor-not-allowed'
                    : 'text-emerald-100 hover:bg-white/10 font-normal'
              )}
            >
              <Icon className={cn(
                'w-[16px] h-[16px] flex-shrink-0',
                item.active ? 'text-emerald-600' : 'text-current'
              )} />
              <span className="truncate">{item.name}</span>
              {item.badge && (
                <span className={cn(
                  'ml-auto px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase',
                  item.badge === 'New'
                    ? 'bg-orange-400 text-white'
                    : 'bg-emerald-400/30 text-emerald-100'
                )}>
                  {item.badge}
                </span>
              )}
              {item.comingSoon && !item.badge && (
                <span className="ml-auto text-[8px] text-emerald-300/40 font-medium">
                  Soon
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/10 p-3 space-y-0.5">
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-emerald-200/50 cursor-not-allowed">
          <Settings className="w-[16px] h-[16px]" />
          <span>Settings</span>
          <span className="ml-auto text-[8px] text-emerald-300/40 font-medium">Soon</span>
        </button>
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-emerald-200/50 cursor-not-allowed">
          <Bell className="w-[16px] h-[16px]" />
          <span>Notifications</span>
          <span className="ml-auto text-[8px] text-emerald-300/40 font-medium">Soon</span>
        </button>
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-emerald-100 hover:bg-white/10 transition-colors">
          <Headphones className="w-[16px] h-[16px]" />
          <span>Support</span>
        </button>
      </div>
    </aside>
  )
}
