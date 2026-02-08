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
  size?: 'default' | 'sm' | 'modal'
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  className,
  disabled = false,
  size = 'default'
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

  const isSmall = size === 'sm'
  const isModal = size === 'modal'

  return (
    <div className={cn('relative', className)} ref={selectRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Select Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'w-full bg-gray-50 border border-gray-200 text-left',
          'flex items-center justify-between gap-2',
          'transition-all duration-200',
          'hover:border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed',
          // Size variants
          isSmall ? 'px-2.5 py-1.5 rounded-lg text-xs' :
          isModal ? 'px-3 py-2 rounded-lg text-[12px]' :
          'px-4 py-3 rounded-xl text-sm',
          // Focus/open states
          isModal
            ? 'focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white'
            : 'focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white',
          isOpen && (isModal
            ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20 bg-white'
            : 'border-[#52B788] ring-2 ring-[#52B788]/20 bg-white')
        )}
        disabled={disabled}
      >
        <span className={cn(
          selectedOption ? 'text-gray-900' : 'text-gray-500'
        )}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'text-gray-400 transition-transform duration-200',
            isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-full mt-1 bg-white border border-gray-200 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200',
            isModal ? 'rounded-lg' : 'rounded-xl'
          )}
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

          <div className={cn('max-h-60 overflow-auto', isSmall ? 'py-1' : 'py-1')}>
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full text-left flex items-center justify-between gap-2',
                  'transition-all duration-150',
                  isSmall ? 'px-3 py-2 text-xs' :
                  isModal ? 'px-3 py-2 text-[12px]' :
                  'px-4 py-3 text-sm',
                  isModal ? 'hover:bg-[#7C3AED]/10' : 'hover:bg-[#52B788]/10',
                  value === option.value
                    ? isModal
                      ? 'bg-[#7C3AED]/10 text-[#7C3AED] font-medium'
                      : 'bg-[#52B788]/10 text-[#52B788] font-medium'
                    : 'text-gray-700'
                )}
                style={{
                  animation: `dropdownItemIn 0.15s ease-out ${index * 0.03}s both`
                }}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <Check className={cn(
                    isSmall ? 'w-3.5 h-3.5' : isModal ? 'w-3.5 h-3.5' : 'w-4 h-4',
                    isModal ? 'text-[#7C3AED]' : 'text-[#52B788]'
                  )} />
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
