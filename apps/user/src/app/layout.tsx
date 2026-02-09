import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { DomainProvider } from '@/components/providers/DomainProvider'
import { TitleProvider } from '@/components/providers/TitleProvider'
import { ToastProvider } from '@/contexts/ToastContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import { UpdateChecker } from '@/components/UpdateChecker'
import { SSEProvider } from '@/components/providers/SSEProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ads System - Ad Account Management',
  description: 'Manage your ad accounts across multiple platforms',
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
            <DomainProvider>
              <TitleProvider>
                <SSEProvider>
                  {children}
                </SSEProvider>
                <UpdateChecker />
              </TitleProvider>
            </DomainProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
