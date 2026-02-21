import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.1.35'],

  // Always disable webpack cache - no stale module errors
  webpack: (config) => {
    config.cache = false
    return config
  },
}

export default nextConfig
