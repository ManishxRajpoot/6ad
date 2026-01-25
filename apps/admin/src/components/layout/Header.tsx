'use client'

import { useState, useEffect } from 'react'
import { Bell, Search, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useDateFilterStore } from '@/store/dateFilter'

type HeaderProps = {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const user = useAuthStore((state) => state.user)
  const { startDate, endDate, setDateRange, clearDateRange } = useDateFilterStore()

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectingDate, setSelectingDate] = useState<'start' | 'end'>('start')
  const [tempStart, setTempStart] = useState<Date | null>(null)

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

  return (
    <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between bg-background px-6">
      {/* Left - Title */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search here..."
            className="h-9 w-[200px] rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
          />
        </div>

        {/* Date Picker */}
        <div className="relative">
          <button
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className={`flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-sm transition-colors ${
              startDate && endDate
                ? 'border-[#8B5CF6] text-[#8B5CF6]'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>
              {startDate && endDate
                ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                : tempStart && selectingDate === 'end'
                ? `${formatDate(tempStart)} - Select end`
                : 'Select Date Range'}
            </span>
            {(startDate || endDate) ? (
              <X
                className="h-4 w-4 text-gray-400 hover:text-gray-600"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearFilter()
                }}
              />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isDatePickerOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDatePickerOpen(false)}
              />
              <div className="absolute right-0 top-11 z-50 bg-white rounded-lg shadow-lg border border-gray-100 p-4 w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium text-gray-900">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
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
                          className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                            isStart || isEnd
                              ? 'bg-[#8B5CF6] text-white'
                              : isInRange
                              ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]'
                              : isToday
                              ? 'border border-[#8B5CF6] text-[#8B5CF6]'
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
                  <p className="text-xs text-gray-500">
                    {selectingDate === 'start' ? 'Select start date' : 'Select end date'}
                  </p>
                  {(startDate || endDate || tempStart) && (
                    <button
                      type="button"
                      onClick={handleClearFilter}
                      className="mt-2 text-xs text-[#8B5CF6] hover:underline"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-50">
          <Bell className="h-[18px] w-[18px] text-gray-600" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            3
          </span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 leading-tight">{user?.username || 'Admin'}</p>
            <p className="text-xs text-gray-500 leading-tight">{user?.role || 'ADMIN'}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 ml-1" />
        </div>
      </div>
    </header>
  )
}
