'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DatePickerProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onClear: () => void
}

export function DatePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectingStart, setSelectingStart] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const daysOfWeek = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (number | null)[] = []

    // Add empty slots for days before the first day of month
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const dateStr = formatDateForInput(selectedDate)

    if (selectingStart) {
      onStartDateChange(dateStr)
      setSelectingStart(false)
    } else {
      // Ensure end date is after start date
      if (startDate && new Date(dateStr) < new Date(startDate)) {
        onStartDateChange(dateStr)
        onEndDateChange(startDate)
      } else {
        onEndDateChange(dateStr)
      }
      setSelectingStart(true)
      setIsOpen(false)
    }
  }

  const isDateInRange = (day: number) => {
    if (!startDate || !endDate) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const start = new Date(startDate)
    const end = new Date(endDate)
    return date >= start && date <= end
  }

  const isStartDate = (day: number) => {
    if (!startDate) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const start = new Date(startDate)
    return date.toDateString() === start.toDateString()
  }

  const isEndDate = (day: number) => {
    if (!endDate) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const end = new Date(endDate)
    return date.toDateString() === end.toDateString()
  }

  const isToday = (day: number) => {
    const today = new Date()
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return date.toDateString() === today.toDateString()
  }

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClear()
    setSelectingStart(true)
  }

  const days = getDaysInMonth(currentMonth)

  return (
    <div className="relative flex items-center gap-1" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all duration-200 ${
          isOpen
            ? 'border-[#7C3AED] bg-[#7C3AED]/5 shadow-sm'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Calendar className={`w-3.5 h-3.5 ${isOpen ? 'text-[#7C3AED]' : 'text-gray-400'}`} />
        <span className="text-[12px] text-gray-600">
          {startDate || endDate ? (
            <>
              <span className="font-medium text-gray-800">
                {startDate ? formatDate(startDate) : 'Start'}
              </span>
              <span className="mx-1 text-gray-400">-</span>
              <span className="font-medium text-gray-800">
                {endDate ? formatDate(endDate) : 'End'}
              </span>
            </>
          ) : (
            <span className="text-gray-400">Select date range</span>
          )}
        </span>
      </button>
      {/* Clear Button - Outside the trigger */}
      {(startDate || endDate) && (
        <button
          onClick={handleClear}
          className="p-1.5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
          title="Clear dates"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Calendar Dropdown - Compact */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 bg-white rounded-lg shadow-lg border border-gray-200 p-2.5 z-[100]"
          style={{
            animation: 'fadeInUp 0.2s ease-out',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goToPrevMonth}
              className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <h3 className="font-semibold text-gray-800 text-[11px]">
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button
              onClick={goToNextMonth}
              className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Selection indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <button
              onClick={() => setSelectingStart(true)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded transition-all text-[10px] font-medium ${
                selectingStart
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${selectingStart ? 'bg-white' : 'bg-gray-400'}`} />
              Start
            </button>
            <button
              onClick={() => setSelectingStart(false)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded transition-all text-[10px] font-medium ${
                !selectingStart
                  ? 'bg-[#7C3AED] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${!selectingStart ? 'bg-white' : 'bg-gray-400'}`} />
              End
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="w-7 h-5 flex items-center justify-center text-[9px] font-semibold text-gray-400"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, index) => (
              <div key={index}>
                {day ? (
                  <button
                    onClick={() => handleDateClick(day)}
                    className={`
                      w-7 h-7 flex items-center justify-center text-[11px] rounded transition-all duration-150 font-medium
                      ${isStartDate(day) || isEndDate(day)
                        ? 'bg-[#7C3AED] text-white shadow-sm'
                        : isDateInRange(day)
                        ? 'bg-[#7C3AED]/20 text-[#7C3AED]'
                        : isToday(day)
                        ? 'bg-gray-100 text-gray-800 ring-1 ring-[#7C3AED]/30'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    {day}
                  </button>
                ) : (
                  <div className="w-7 h-7" />
                )}
              </div>
            ))}
          </div>

          {/* Quick select buttons */}
          <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-4 gap-1">
            <button
              onClick={() => {
                const today = new Date()
                const dateStr = formatDateForInput(today)
                onStartDateChange(dateStr)
                onEndDateChange(dateStr)
                setIsOpen(false)
              }}
              className="px-1.5 py-1 text-[9px] font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => {
                const today = new Date()
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                onStartDateChange(formatDateForInput(weekAgo))
                onEndDateChange(formatDateForInput(today))
                setIsOpen(false)
              }}
              className="px-1.5 py-1 text-[9px] font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
            >
              7 days
            </button>
            <button
              onClick={() => {
                const today = new Date()
                const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                onStartDateChange(formatDateForInput(monthAgo))
                onEndDateChange(formatDateForInput(today))
                setIsOpen(false)
              }}
              className="px-1.5 py-1 text-[9px] font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
            >
              30 days
            </button>
            <button
              onClick={() => {
                const today = new Date()
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
                onStartDateChange(formatDateForInput(firstDay))
                onEndDateChange(formatDateForInput(today))
                setIsOpen(false)
              }}
              className="px-1.5 py-1 text-[9px] font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
            >
              Month
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
