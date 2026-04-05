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
  title: {
    default: 'ADS360 - Real Agency Ad Accounts | Scale Your Ads Without Limits',
    template: '%s | ADS360',
  },
  applicationName: 'ADS360',
  description: 'Get ban-resistant agency ad accounts for Meta, Google, TikTok, Snapchat & Bing. Live in 1 hour. Unlimited spend. 24/7 support.',
  keywords: ['agency ad accounts', 'meta ad accounts', 'facebook agency accounts', 'google ads agency', 'tiktok ad accounts', 'ban resistant ad accounts', 'ads360'],
  metadataBase: new URL('https://ads360.ai'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
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
      <head>
        {/* Preload hero image for LCP */}
        <link rel="preload" as="image" href="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/hero-dashboard.webp" fetchPriority="high" type="image/webp" />
        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "ADS360",
              "url": "https://ads360.ai",
              "logo": "https://ads360.ai/logos/ads360-icon-512.png",
              "description": "Premium agency ad accounts for Facebook, Google, TikTok, Snapchat, and Bing. Trusted by 500+ advertisers worldwide.",
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "sales",
                "email": "support@ads360.ai",
                "url": "https://ads360.ai/#contact"
              },
              "sameAs": [
                "https://t.me/ads360support"
              ]
            })
          }}
        />
        {/* Website Schema with SearchAction for sitelinks */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "ADS360",
              "alternateName": ["ADS 360", "Ads360"],
              "url": "https://ads360.ai",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://ads360.ai/blog?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        {/* SiteNavigationElement for sitelinks */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": [
                {
                  "@type": "SiteNavigationElement",
                  "position": 1,
                  "name": "Facebook Agency Ad Accounts",
                  "description": "Get premium Facebook agency ad accounts with unlimited spend and zero bans.",
                  "url": "https://ads360.ai/#agency-facebook"
                },
                {
                  "@type": "SiteNavigationElement",
                  "position": 2,
                  "name": "Google Agency Ad Accounts",
                  "description": "Scale your Google Ads with ban-proof agency accounts.",
                  "url": "https://ads360.ai/#agency-google"
                },
                {
                  "@type": "SiteNavigationElement",
                  "position": 3,
                  "name": "TikTok Agency Ad Accounts",
                  "description": "Get TikTok agency ad accounts ready in under 5 minutes.",
                  "url": "https://ads360.ai/#agency-tiktok"
                },
                {
                  "@type": "SiteNavigationElement",
                  "position": 4,
                  "name": "Blog",
                  "description": "Expert guides on agency ad accounts, scaling strategies, and platform tips.",
                  "url": "https://ads360.ai/blog"
                },
                {
                  "@type": "SiteNavigationElement",
                  "position": 5,
                  "name": "Pricing",
                  "description": "Transparent pricing for agency ad accounts across all platforms.",
                  "url": "https://ads360.ai/#pricing"
                },
                {
                  "@type": "SiteNavigationElement",
                  "position": 6,
                  "name": "Contact",
                  "description": "Get in touch with ADS360 for premium agency ad accounts.",
                  "url": "https://ads360.ai/#contact"
                }
              ]
            })
          }}
        />
        {/* FAQ Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is an agency ad account?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "An agency ad account is a premium advertising account provided through a certified agency partner. These accounts offer higher spending limits, better ad approval rates, and protection against bans compared to regular ad accounts."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How fast can I get an ad account from ADS360?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Most agency ad accounts are set up and ready to use within 5 minutes. Our team reviews your request and activates your account quickly so you can start running ads immediately."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Which platforms does ADS360 support?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "ADS360 provides agency ad accounts for Facebook (Meta), Google Ads, TikTok, Snapchat, and Bing (Microsoft Advertising)."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Are agency ad accounts ban-proof?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Agency ad accounts are significantly more resistant to bans compared to regular accounts. They are managed under a verified agency structure which provides additional stability and higher trust scores with ad platforms."
                  }
                }
              ]
            })
          }}
        />
      </head>
      <body className={outfit.className} suppressHydrationWarning>
        <main>{children}</main>
      </body>
    </html>
  )
}
