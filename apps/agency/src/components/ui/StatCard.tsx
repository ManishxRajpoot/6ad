'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: LucideIcon
  iconBgColor?: string
  className?: string
}

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconBgColor = 'bg-primary-100',
  className
}: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-xl p-6 shadow-card', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[15px] text-gray-500 mb-1.5">{title}</p>
          <p className="text-[28px] font-bold text-gray-900">{value}</p>
          {change && (
            <p className={cn(
              'text-[15px] mt-1.5',
              changeType === 'positive' && 'text-success',
              changeType === 'negative' && 'text-danger',
              changeType === 'neutral' && 'text-gray-500'
            )}>
              {change}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('p-4 rounded-lg', iconBgColor)}>
            <Icon className="w-7 h-7 text-primary-500" />
          </div>
        )}
      </div>
    </div>
  )
}
