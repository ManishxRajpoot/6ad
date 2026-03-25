import { cn } from '@/lib/utils'

type TableProps = {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full', className)}>{children}</table>
    </div>
  )
}

export function TableHeader({ children, className }: TableProps) {
  return <thead className={cn('border-b border-gray-200 bg-gray-50', className)}>{children}</thead>
}

export function TableBody({ children, className }: TableProps) {
  return <tbody className={cn('divide-y divide-gray-200', className)}>{children}</tbody>
}

export function TableRow({ children, className }: TableProps) {
  return <tr className={cn('hover:bg-gray-50', className)}>{children}</tr>
}

type TableCellProps = {
  children: React.ReactNode
  className?: string
  header?: boolean
  colSpan?: number
}

export function TableCell({ children, className, header, colSpan }: TableCellProps) {
  const Component = header ? 'th' : 'td'
  return (
    <Component
      colSpan={colSpan}
      className={cn(
        'px-4 py-3 text-left text-sm',
        header ? 'font-medium text-gray-600' : 'text-gray-900',
        className
      )}
    >
      {children}
    </Component>
  )
}
