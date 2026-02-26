'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Search, ChevronDown, ChevronLeft, ChevronRight, X, Calendar, SlidersHorizontal, LayoutDashboard, Users, UserCog, CreditCard, FileText, ArrowUpRight, Settings, Megaphone, Globe, Ticket, Gift, Plug, Layers } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useDateFilterStore } from '@/store/dateFilter'

const searchablePages = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agents', href: '/agents', icon: UserCog },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Withdrawals', href: '/withdrawals', icon: ArrowUpRight },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'All Ad Accounts', href: '/ad-accounts', icon: Layers },
  { name: 'Facebook', href: '/facebook', icon: Megaphone },
  { name: 'Google', href: '/google', icon: Globe },
  { name: 'TikTok', href: '/tiktok', icon: Globe },
  { name: 'Snapchat', href: '/snapchat', icon: Globe },
  { name: 'Bing', href: '/bing', icon: Globe },
  { name: 'Announcements', href: '/announcements', icon: Megaphone },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Coupons', href: '/coupons', icon: Ticket },
  { name: 'Referrals', href: '/referrals', icon: Gift },
  { name: 'Extension API', href: '/extension', icon: Plug },
  { name: 'Whitelabel', href: '/domain-requests', icon: Globe },
  { name: 'Settings', href: '/settings', icon: Settings },
]

type HeaderProps = {
  title: string
  subtitle?: string
  pendingCount?: number
}

export function Header({ title, subtitle, pendingCount }: HeaderProps) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const { startDate, endDate, setDateRange, clearDateRange } = useDateFilterStore()

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectingDate, setSelectingDate] = useState<'start' | 'end'>('start')
  const [tempStart, setTempStart] = useState<Date | null>(null)

  // Search / Command Palette state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const filteredPages = searchQuery.trim()
    ? searchablePages.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : searchablePages

  const handleSearchNavigate = useCallback((href: string) => {
    router.push(href)
    setSearchQuery('')
    setIsSearchOpen(false)
    searchInputRef.current?.blur()
  }, [router])

  // ⌘K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false)
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Arrow key navigation in search results
  useEffect(() => {
    if (!isSearchOpen) return
    const handleSearchKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredPages.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filteredPages[selectedIndex]) {
        e.preventDefault()
        handleSearchNavigate(filteredPages[selectedIndex].href)
      }
    }
    document.addEventListener('keydown', handleSearchKeys)
    return () => document.removeEventListener('keydown', handleSearchKeys)
  }, [isSearchOpen, selectedIndex, filteredPages, handleSearchNavigate])

  // Reset selected index on query change
  useEffect(() => { setSelectedIndex(0) }, [searchQuery])

  // Close search when clicking outside
  useEffect(() => {
    if (!isSearchOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSearchOpen])

  // Sync temp state with global state
  useEffect(() => {
    setTempStart(startDate)
  }, [startDate])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    return { daysInMonth, startingDay }
  }

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)

    if (selectingDate === 'start') {
      setTempStart(selectedDate)
      setSelectingDate('end')
    } else {
      if (tempStart && selectedDate >= tempStart) {
        // Update global state when both dates are selected
        setDateRange(tempStart, selectedDate)
        setIsDatePickerOpen(false)
        setSelectingDate('start')
      }
    }
  }

  const handleClearFilter = () => {
    clearDateRange()
    setTempStart(null)
    setSelectingDate('start')
  }

  const hasDateFilter = startDate && endDate

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between bg-[#FAFAFA] px-6 border-b border-gray-100">
      {/* Left — Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-[16px] font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <span className="h-6 px-2.5 rounded-md bg-gray-200/80 text-[11px] font-medium text-gray-500 flex items-center">
            {subtitle}
          </span>
        )}
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-1.5">
        {/* Search — Command Palette */}
        <div className="relative" ref={searchContainerRef}>
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 z-10" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true) }}
            onFocus={() => setIsSearchOpen(true)}
            className="h-8 w-[180px] rounded-lg border border-gray-200 bg-white pl-8 pr-9 text-[13px] placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 transition-all focus:w-[240px]"
          />
          {!isSearchOpen && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5">
              <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded border border-gray-200">⌘</kbd>
              <kbd className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded border border-gray-200">K</kbd>
            </div>
          )}
          {isSearchOpen && (
            <div className="absolute right-0 top-9 z-50 w-[280px] bg-white rounded-lg shadow-lg border border-gray-100 py-1 max-h-[320px] overflow-y-auto">
              {filteredPages.length === 0 ? (
                <p className="px-3 py-4 text-[12px] text-gray-400 text-center">No pages found</p>
              ) : (
                filteredPages.map((page, idx) => {
                  const Icon = page.icon
                  return (
                    <button
                      key={page.href}
                      onClick={() => handleSearchNavigate(page.href)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors ${
                        idx === selectedIndex ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{page.name}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Date Picker */}
        <div className="relative">
          <button
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors ${
              hasDateFilter
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-200/60'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {hasDateFilter
                ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                : tempStart && selectingDate === 'end'
                ? `${formatDate(tempStart)} - ...`
                : 'Date Range'}
            </span>
            {hasDateFilter ? (
              <X
                className="h-3 w-3 text-gray-400 hover:text-white ml-0.5"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearFilter()
                }}
              />
            ) : (
              <ChevronDown className="h-3 w-3 ml-0.5" />
            )}
          </button>

          {isDatePickerOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDatePickerOpen(false)}
              />
              <div className="absolute right-0 top-9 z-50 bg-white rounded-lg shadow-lg border border-gray-100 p-4 w-[280px]">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-500" />
                  </button>
                  <span className="text-[13px] font-medium text-gray-900">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <div key={day} className="text-center text-[11px] font-medium text-gray-400 py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const { daysInMonth, startingDay } = getDaysInMonth(calendarMonth)
                    const days = []

                    for (let i = 0; i < startingDay; i++) {
                      days.push(<div key={`empty-${i}`} className="h-8" />)
                    }

                    for (let day = 1; day <= daysInMonth; day++) {
                      const currentDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                      const displayStart = tempStart || startDate
                      const displayEnd = endDate

                      const isStart = displayStart && currentDate.toDateString() === displayStart.toDateString()
                      const isEnd = displayEnd && currentDate.toDateString() === displayEnd.toDateString()
                      const isInRange = displayStart && displayEnd && currentDate > displayStart && currentDate < displayEnd
                      const isToday = currentDate.toDateString() === new Date().toDateString()

                      days.push(
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDateSelect(day)}
                          className={`h-8 w-8 rounded-md text-[12px] font-medium transition-colors ${
                            isStart || isEnd
                              ? 'bg-gray-900 text-white'
                              : isInRange
                              ? 'bg-gray-200 text-gray-900'
                              : isToday
                              ? 'border border-gray-900 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {day}
                        </button>
                      )
                    }

                    return days
                  })()}
                </div>

                {/* Selection Info */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[11px] text-gray-500">
                    {selectingDate === 'start' ? 'Select start date' : 'Select end date'}
                  </p>
                  {(startDate || endDate || tempStart) && (
                    <button
                      type="button"
                      onClick={handleClearFilter}
                      className="mt-2 text-[11px] text-gray-900 font-medium hover:underline"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-200 mx-1.5" />

        {/* Notifications */}
        <button
          onClick={() => router.push('/notifications')}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-200/60 transition-colors"
        >
          <Bell className="h-4 w-4 text-gray-500" />
          {(pendingCount ?? 0) > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {/* User — compact avatar + dropdown */}
        <button className="flex items-center gap-2 rounded-lg hover:bg-gray-200/60 px-2 py-1.5 transition-colors">
          <div className="h-7 w-7 rounded-lg bg-gray-900 flex items-center justify-center">
            <span className="text-white text-[10px] font-semibold">
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <span className="text-[13px] font-medium text-gray-700">{user?.username || 'Admin'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>
    </header>
  )
}
