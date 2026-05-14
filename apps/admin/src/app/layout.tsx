import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/contexts/ToastContext'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import { UpdateChecker } from '@/components/UpdateChecker'
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/components/providers/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '6AD Admin - Dashboard',
  description: '6AD Admin Panel for managing agents, users, and ad accounts',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme bootstrap — prevents white flash for dark-mode users */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmProvider>
                {children}
                <UpdateChecker />
              </ConfirmProvider>
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
