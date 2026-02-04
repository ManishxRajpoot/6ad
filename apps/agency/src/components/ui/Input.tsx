'use client'

import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[15px] font-medium text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-5 py-3 border border-gray-300 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
            error && 'border-danger focus:ring-danger',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-[15px] text-danger">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
