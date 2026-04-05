'use client'

import Link from 'next/link'
import StarField from '@/components/shared/StarField'

type Category = { id: string; name: string; slug: string; image?: string | null; icon?: string | null }

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'facebook-profiles': <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
  'business-managers': <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M20 7h-4V5l-2-2h-4L8 5v2H4c-1.1 0-2 .9-2 2v5c0 .75.4 1.38 1 1.73V19c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2v-3.28c.59-.35 1-.99 1-1.72V9c0-1.1-.9-2-2-2zM10 5h4v2h-4V5z"/></svg>,
  'facebook-pages': <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>,
  'full-ads-structure': <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>,
  'instagram-profiles': <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>,
  'tiktok-profiles': <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>,
  'twitter-profiles': <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
}

// Platform floating icons with positions around the center
const FLOATING_PLATFORMS = [
  { name: 'Meta', color: '#1877F2', x: '8%', y: '20%', size: 52, delay: '0s', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  { name: 'Google', color: '#34A853', x: '88%', y: '15%', size: 48, delay: '1s', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> },
  { name: 'TikTok', color: '#ff0050', x: '5%', y: '65%', size: 44, delay: '2s', icon: <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg> },
  { name: 'Instagram', color: '#E1306C', x: '92%', y: '60%', size: 46, delay: '0.5s', icon: <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg> },
  { name: 'X', color: '#ffffff', x: '15%', y: '85%', size: 40, delay: '1.5s', icon: <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { name: 'Snapchat', color: '#FFFC00', x: '82%', y: '82%', size: 42, delay: '2.5s', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.603.603 0 0 1 .464-.104c.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509-.015.075-.045.149-.075.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03a3.3 3.3 0 0 0-.538-.074c-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884a5.7 5.7 0 0 0-.928-.074c-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226a.59.59 0 0 1-.055-.225c-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809a3.7 3.7 0 0 1-.346-.119c-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.136 0 .256.031.375.086.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.794.807l.411-.015z"/></svg> },
]

export default function ShopHero({ categories, totalProducts }: {
  categories: Category[]
  totalProducts: number
}) {
  return (
    <div className="relative overflow-hidden pt-24 pb-2 sm:pt-28 sm:pb-8">
      {/* StarField */}
      <StarField />

      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-600/[0.1] rounded-full blur-[150px]" />
        <div className="absolute top-0 right-[10%] w-[400px] h-[400px] bg-indigo-600/[0.06] rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-[10%] w-[300px] h-[300px] bg-cyan-600/[0.05] rounded-full blur-[80px]" />
      </div>

      {/* Floating platform icons — hidden on mobile */}
      <div className="absolute inset-0 pointer-events-none z-[2] hidden lg:block">
        {FLOATING_PLATFORMS.map((p, i) => (
          <div
            key={i}
            className="absolute hero-float-1"
            style={{ left: p.x, top: p.y, animationDelay: p.delay }}
          >
            <div
              className="rounded-2xl flex items-center justify-center backdrop-blur-sm"
              style={{
                width: p.size, height: p.size,
                background: `${p.color}12`,
                border: `1px solid ${p.color}20`,
                boxShadow: `0 0 30px ${p.color}10`,
              }}
            >
              {p.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Center content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] mb-6 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/50 text-xs font-medium tracking-widest uppercase">Live Store</span>
          <span className="w-[1px] h-3 bg-white/10" />
          <span className="text-blue-400 text-xs font-bold">{totalProducts}</span>
          <span className="text-white/25 text-xs">products</span>
        </div>

        {/* Heading */}
        <h1 className="text-[26px] sm:text-5xl md:text-6xl lg:text-[68px] font-extrabold leading-[1.1] tracking-tight mb-3 sm:mb-5">
          <span className="text-white">The Marketplace for</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">Digital Ad Assets</span>
        </h1>

        <p className="text-white/35 text-[13px] sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-4 sm:mb-8">
          Aged profiles, Business Managers, Pages & more. Verified quality. USDT payment. Delivered in minutes.
        </p>

        {/* Platform logos + Stats in one compact row on mobile */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-6">
          {[
            { color: '#1877F2', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
            { color: '#4285F4', icon: <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> },
            { color: '#ff0050', icon: <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg> },
            { color: '#E1306C', icon: <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg> },
            { color: '#FFFC00', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.603.603 0 0 1 .464-.104c.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509-.015.075-.045.149-.075.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03a3.3 3.3 0 0 0-.538-.074c-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884a5.7 5.7 0 0 0-.928-.074c-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226a.59.59 0 0 1-.055-.225c-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809a3.7 3.7 0 0 1-.346-.119c-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.136 0 .256.031.375.086.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.794.807l.411-.015z"/></svg> },
            { color: '#fff', icon: <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5 sm:w-5 sm:h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
          ].map((p, i) => (
            <div key={i} className="w-9 h-9 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center" style={{ background: `${p.color}10`, border: `1px solid ${p.color}18` }}>
              {p.icon}
            </div>
          ))}
        </div>

        {/* Stats — compact on mobile */}
        <div className="flex items-center justify-center gap-5 sm:gap-12 mb-4 sm:mb-8">
          {[
            { value: '45+', label: 'Products' },
            { value: '2.5K+', label: 'Delivered' },
            { value: '<5min', label: 'Delivery' },
            { value: '4.9/5', label: 'Rating' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-white font-bold text-sm sm:text-xl">{s.value}</div>
              <div className="text-white/20 text-[8px] sm:text-[11px] uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
    </div>
  )
}
