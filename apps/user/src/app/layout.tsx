import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { DomainProvider } from '@/components/providers/DomainProvider'
import { TitleProvider } from '@/components/providers/TitleProvider'

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
        <DomainProvider>
          <TitleProvider>
            {children}
          </TitleProvider>
        </DomainProvider>
      </body>
    </html>
  )
}
