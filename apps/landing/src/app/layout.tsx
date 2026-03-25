import type { Metadata } from 'next'
import { Outfit, Press_Start_2P } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['400', '600', '700'],
})

const pressStart2P = Press_Start_2P({
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
  weight: '400',
})

export const metadata: Metadata = {
  title: 'ADS360 - Real Agency Ad Accounts | Scale Your Ads Without Limits',
  description: 'Get ban-resistant agency ad accounts for Meta, Google, TikTok, Snapchat & Bing. Live in 1 hour. Unlimited spend. 24/7 support.',
  keywords: ['agency ad accounts', 'meta ad accounts', 'facebook agency accounts', 'google ads agency', 'tiktok ad accounts', 'ban resistant ad accounts', 'ads360'],
  metadataBase: new URL('https://ads360.ai'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'ADS360 - Real Agency Ad Accounts',
    description: 'Get ban-resistant agency ad accounts for Meta, Google, TikTok, Snapchat & Bing. Live in 1 hour. Unlimited spend. No bans.',
    type: 'website',
    locale: 'en_US',
    url: 'https://ads360.ai',
    siteName: 'ADS360',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ADS360 - Real Agency Ad Accounts',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADS360 - Real Agency Ad Accounts',
    description: 'Get ban-resistant agency ad accounts live in 1 hour. Unlimited spend. No bans.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${pressStart2P.variable}`}>
      <body className={outfit.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
