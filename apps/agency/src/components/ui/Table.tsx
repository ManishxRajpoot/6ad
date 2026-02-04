'use client'

import { cn } from '@/lib/utils'

interface TableProps {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children, className }: TableProps) {
  return (
    <thead className={cn('bg-gray-50', className)}>
      {children}
    </thead>
  )
}

export function TableBody({ children, className }: TableProps) {
  return (
    <tbody className={cn('divide-y divide-gray-100', className)}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className }: TableProps) {
  return (
    <tr className={cn('hover:bg-gray-50 transition-colors', className)}>
      {children}
    </tr>
  )
}

interface TableCellProps extends TableProps {
  isHeader?: boolean
}

export function TableCell({ children, className, isHeader }: TableCellProps) {
  const Component = isHeader ? 'th' : 'td'
  return (
    <Component
      className={cn(
        'px-5 py-3.5 text-[15px]',
        isHeader ? 'font-medium text-gray-500 text-left' : 'text-gray-700',
        className
      )}
    >
      {children}
    </Component>
  )
}
