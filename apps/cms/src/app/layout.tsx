import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ADS360 CMS',
  description: 'Content Management System for ADS360',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
