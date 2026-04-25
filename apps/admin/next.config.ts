import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'api.6ad.in'],
  },
  // Generate unique build IDs to prevent cache issues
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
  // Disable caching in development
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 2,
  },
  // Permanent redirect from old /yeewallex route to /sixcards
  async redirects() {
    return [
      { source: '/yeewallex', destination: '/sixcards', permanent: true },
      { source: '/yeewallex/:path*', destination: '/sixcards/:path*', permanent: true },
    ]
  },
  // Headers for cache control
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
