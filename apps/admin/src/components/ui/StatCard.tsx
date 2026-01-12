import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

type StatCardProps = {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: LucideIcon
  iconColor?: string
  className?: string
}

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'bg-primary-100 text-primary-600',
  className,
}: StatCardProps) {
  return (
    <div className={cn('rounded-xl bg-white p-6 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          {change && (
            <p
              className={cn(
                'mt-1 text-sm',
                changeType === 'positive' && 'text-green-600',
                changeType === 'negative' && 'text-red-600',
                changeType === 'neutral' && 'text-gray-500'
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', iconColor)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}
