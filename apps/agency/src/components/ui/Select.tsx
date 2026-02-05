'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
  disabled?: boolean
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  className,
  disabled = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  return (
    <div className={cn('relative', className)} ref={selectRef}>
      {label && (
        <label className="block text-[15px] font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Select Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'w-full h-[34px] px-3 bg-white border border-gray-200 rounded-lg text-[12px] text-left',
          'flex items-center justify-between gap-1',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]',
          'hover:border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20'
        )}
        disabled={disabled}
      >
        <span className={cn(
          selectedOption ? 'text-gray-700' : 'text-gray-500'
        )}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-gray-400 transition-transform duration-200',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            animation: 'dropdownIn 0.2s ease-out'
          }}
        >
          <style jsx>{`
            @keyframes dropdownIn {
              from {
                opacity: 0;
                transform: translateY(-8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>

          <div className="py-0.5 max-h-60 overflow-auto">
            {options.map((option, index) => (
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
                  'hover:bg-[#7C3AED]/10',
                  value === option.value
                    ? 'bg-[#7C3AED]/10 text-[#7C3AED] font-medium'
                    : 'text-gray-700'
                )}
                style={{
                  animation: `dropdownItemIn 0.15s ease-out ${index * 0.03}s both`
                }}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <Check className="w-3 h-3 text-[#7C3AED]" />
                )}
              </button>
            ))}
          </div>

          <style jsx>{`
            @keyframes dropdownItemIn {
              from {
                opacity: 0;
                transform: translateX(-8px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
