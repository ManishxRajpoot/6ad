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
  chartColor?: string
  chartData?: number[]
}

// Mini sparkline chart component
function MiniChart({ data, color }: { data: number[], color: string }) {
  if (!data || data.length === 0) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 120
  const height = 50
  const padding = 5

  // Generate smooth curve points
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    return { x, y }
  })

  // Create smooth curve path using bezier curves
  const createSmoothPath = () => {
    if (points.length < 2) return ''

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i]
      const next = points[i + 1]
      const controlX = (current.x + next.x) / 2

      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`
    }

    return path
  }

  // Create area fill path
  const createAreaPath = () => {
    const linePath = createSmoothPath()
    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]

    return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path
        d={createAreaPath()}
        fill={`url(#gradient-${color.replace('#', '')})`}
      />
      {/* Line */}
      <path
        d={createSmoothPath()}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconBgColor = 'bg-primary-100',
  className,
  chartColor = '#8B5CF6',
  chartData
}: StatCardProps) {
  // Default chart data if none provided
  const defaultChartData = [30, 45, 35, 50, 40, 60, 55, 70, 65, 80]
  const dataToUse = chartData || defaultChartData

  return (
    <div className={cn('bg-white rounded-2xl p-5 shadow-sm border border-gray-100', className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <div className="flex items-center gap-3">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {change && (
              <span className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold',
                changeType === 'positive' && 'bg-green-500 text-white',
                changeType === 'negative' && 'bg-red-500 text-white',
                changeType === 'neutral' && 'bg-gray-200 text-gray-600'
              )}>
                {change}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Mini Chart */}
      <div className="flex justify-end -mb-2 -mr-2">
        <MiniChart data={dataToUse} color={chartColor} />
      </div>
    </div>
  )
}
