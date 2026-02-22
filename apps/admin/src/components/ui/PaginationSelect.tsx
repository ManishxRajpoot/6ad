'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationSelectProps {
  value: number
  onChange: (value: number) => void
  options?: { value: number; label: string }[]
  className?: string
}

const defaultOptions = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: -1, label: 'All' },
]

export function PaginationSelect({
  value,
  onChange,
  options = defaultOptions,
  className
}: PaginationSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn('relative', className)} ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-700',
          'transition-all duration-200',
          'hover:border-teal-500/50 hover:bg-gray-50',
          isOpen && 'border-teal-500 ring-2 ring-teal-500/20'
        )}
      >
        <span>{selectedOption?.label || value}</span>
        <ChevronDown className={cn(
          'w-3 h-3 text-gray-400 transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full mb-1 left-0 min-w-[70px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-[11px] text-left flex items-center justify-between gap-2',
                  'transition-all duration-150',
                  'hover:bg-teal-500/10',
                  value === option.value
                    ? 'bg-teal-500/10 text-teal-600 font-semibold'
                    : 'text-gray-700'
                )}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <Check className="w-3 h-3 text-teal-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
