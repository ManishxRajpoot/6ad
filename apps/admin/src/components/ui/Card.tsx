import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('rounded-xl bg-white p-6 shadow-sm', className)} {...props}>
      {children}
    </div>
  )
}

type CardHeaderProps = {
  children: React.ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

type CardTitleProps = {
  children: React.ReactNode
  className?: string
}

export function CardTitle({ children, className }: CardTitleProps) {
  return <h3 className={cn('text-lg font-semibold text-gray-900', className)}>{children}</h3>
}

type CardContentProps = {
  children: React.ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={className}>{children}</div>
}
