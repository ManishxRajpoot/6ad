import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { DomainProvider } from '@/components/providers/DomainProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '6AD - Ad Account Management',
  description: 'Manage your ad accounts across multiple platforms',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DomainProvider>
          {children}
        </DomainProvider>
      </body>
    </html>
  )
}
