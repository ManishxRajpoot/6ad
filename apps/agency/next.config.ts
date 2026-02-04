import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },

  // Always disable webpack cache - no stale module errors
  webpack: (config) => {
    config.cache = false
    return config
  },
}

export default nextConfig
