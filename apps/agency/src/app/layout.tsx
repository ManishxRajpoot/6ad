import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import { UpdateChecker } from '@/components/UpdateChecker'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Six Media - Agency Dashboard',
  description: 'Six Media Agency Panel for managing users and ad accounts',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <ErrorBoundary>
          <ToastProvider>
            {children}
            <UpdateChecker />
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
