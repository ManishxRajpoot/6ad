import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  webpack: (config) => {
    return config
  },
}

export default nextConfig
