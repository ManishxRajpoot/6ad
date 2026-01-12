'use client'

import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-card',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
