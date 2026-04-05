import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      { protocol: 'https', hostname: 'pub-ab628c238a58431a980c671b4352cc87.r2.dev' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  webpack: (config) => {
    return config
  },
}

export default nextConfig
