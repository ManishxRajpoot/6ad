'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

// ==================== PLATFORM ICONS ====================
const platformsLeft = [
  { name: 'Meta', icon: '/meta-logo.png' },
  { name: 'TikTok', icon: '/tiktok-logo.png' },
  { name: 'Bing', icon: '/bing-logo.png' },
]
const platformsRight = [
  { name: 'Google', icon: '/google-logo.png' },
  { name: 'Facebook', icon: '/fb.png', size: 36 },
  { name: 'Snapchat', icon: '/snapchat.png' },
]

// ==================== FOOTER LINKS ====================
const footerLinks = [
  {
    title: 'AD ACCOUNTS',
    links: [
      { label: 'Facebook Ad Accounts', href: '#' },
      { label: 'Google Ad Accounts', href: '#' },
      { label: 'TikTok Ad Accounts', href: '#' },
      { label: 'Bing Ad Accounts', href: '#' },
      { label: 'Snapchat Ad Accounts', href: '#' },
    ],
  },
  {
    title: 'ASSETS',
    links: [
      { label: 'Facebook Accounts', href: '#' },
      { label: 'Business Managers', href: '#' },
      { label: 'Facebook Pages', href: '#' },
      { label: 'TikTok Accounts', href: '#' },
    ],
  },
  {
    title: 'OTHER SERVICES',
    links: [
      { label: 'Feedback Score', href: '#' },
      { label: 'Account Health', href: '#' },
      { label: 'Reputation Management', href: '#' },
    ],
  },
  {
    title: 'RESOURCES',
    links: [
      { label: 'Partners', href: '#' },
      { label: 'Our Team', href: '#' },
      { label: 'Reviews', href: '#' },
      { label: 'Blog', href: '#' },
    ],
  },
  {
    title: 'OUR SOCIALS',
    links: [
      { label: '𝕏 Twitter', href: '#' },
      { label: 'LinkedIn', href: '#' },
      { label: 'Instagram', href: '#' },
    ],
  },
]

// ==================== LOGO BRAND (reuse from header) ====================
function FooterLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="footerLogoBg" x1="0" y1="40" x2="40" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#footerLogoBg)" />
        <rect x="1" y="1" width="38" height="38" rx="10" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.15" />
        <polygon points="20,8 30,30 10,30" fill="white" opacity="0.95" />
        <polygon points="24,10 32,32 16,32" fill="white" opacity="0.4" />
      </svg>
      <span className="text-white font-bold text-lg tracking-[0.25em]">ADS360</span>
    </div>
  )
}

// ==================== PLATFORM ICONS ROW WITH SYNCED BEAM ====================
function PlatformIconsRow() {
  const rowRef = useRef<HTMLDivElement>(null)
  const [glowIndex, setGlowIndex] = useState(-1) // -1 = none, 0/1/2 = which icon glows
  const [beamProgress, setBeamProgress] = useState(0) // 0 to 1

  useEffect(() => {
    const CYCLE = 4000 // 4 seconds per cycle
    const PAUSE = 1000 // 1 second pause between cycles
    const TOTAL = CYCLE + PAUSE
    let raf: number
    let start: number | null = null

    const animate = (timestamp: number) => {
      if (!start) start = timestamp
      const elapsed = (timestamp - start) % TOTAL

      if (elapsed < CYCLE) {
        const progress = elapsed / CYCLE
        setBeamProgress(progress)

        // Icon positions: 0 at ~30%, 1 at ~55%, 2 at ~80%
        if (progress >= 0.75) setGlowIndex(2)
        else if (progress >= 0.50) setGlowIndex(1)
        else if (progress >= 0.25) setGlowIndex(0)
        else setGlowIndex(-1)
      } else {
        // Pause phase
        setBeamProgress(0)
        setGlowIndex(-1)
      }

      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  const allPlatforms = [
    ...platformsLeft.map((p, i) => ({ ...p, side: 'left' as const, distIndex: 2 - i })), // Meta=2(far), TikTok=1(mid), Bing=0(close)
    { name: 'ADS360', icon: '/ads360-logo.svg', side: 'center' as const, distIndex: -1 },
    ...platformsRight.map((p, i) => ({ ...p, side: 'right' as const, distIndex: i })), // Google=0(close), FB=1(mid), Snap=2(far)
  ]

  return (
    <div className="relative py-8 sm:py-20 overflow-hidden">
      {/* Center glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/[0.06] rounded-full blur-[80px] transition-opacity duration-200"
        style={{ opacity: beamProgress > 0 && beamProgress < 0.1 ? 0.2 : 0.06 }}
      />

      <div ref={rowRef} className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="relative flex items-center justify-center">
          {/* Static connecting line */}
          <div className="absolute top-1/2 left-0 right-0 h-[1px] -translate-y-1/2">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          </div>

          {/* LEFT beam — travels from center to left edge */}
          <div className="absolute top-1/2 right-1/2 left-[8%] h-[3px] -translate-y-1/2 overflow-hidden">
            <div
              className="absolute top-0 w-[60px] h-full bg-gradient-to-l from-blue-400/90 via-cyan-400/60 to-transparent rounded-full blur-[1px] transition-none"
              style={{
                right: `${beamProgress * 100}%`,
                opacity: beamProgress > 0 && beamProgress < 0.85 ? 1 : 0,
              }}
            />
          </div>

          {/* RIGHT beam — travels from center to right edge */}
          <div className="absolute top-1/2 left-1/2 right-[8%] h-[3px] -translate-y-1/2 overflow-hidden">
            <div
              className="absolute top-0 w-[60px] h-full bg-gradient-to-r from-blue-400/90 via-cyan-400/60 to-transparent rounded-full blur-[1px] transition-none"
              style={{
                left: `${beamProgress * 100}%`,
                opacity: beamProgress > 0 && beamProgress < 0.85 ? 1 : 0,
              }}
            />
          </div>

          <div className="relative flex items-center gap-2 sm:gap-5 md:gap-7">
            {allPlatforms.map((platform) => {
              if (platform.side === 'center') {
                return (
                  <div
                    key="center"
                    className="relative z-10 transition-transform duration-200"
                    style={{ transform: beamProgress > 0 && beamProgress < 0.05 ? 'scale(1.08)' : 'scale(1)' }}
                  >
                    <div className="absolute -inset-[3px] rounded-2xl bg-gradient-to-b from-blue-400/30 via-blue-500/20 to-purple-500/10 blur-[1px]" />
                    {/* Expanding ring */}
                    {beamProgress > 0 && beamProgress < 0.5 && (
                      <div
                        className="absolute -inset-2 rounded-2xl border border-blue-400/20 pointer-events-none"
                        style={{
                          transform: `scale(${1 + beamProgress * 4})`,
                          opacity: Math.max(0, 0.4 - beamProgress),
                        }}
                      />
                    )}
                    <div className="relative flex items-center justify-center w-12 h-12 sm:w-[72px] sm:h-[72px] rounded-xl sm:rounded-2xl border border-blue-400/30 bg-[#0d0d17]">
                      <Image src="/ads360-logo.svg" alt="ADS360" width={24} height={24} className="sm:w-8 sm:h-8" />
                    </div>
                  </div>
                )
              }

              const isGlowing = glowIndex >= 0 && platform.distIndex <= glowIndex
              const iconSize = (platform as any).size || 24

              return (
                <div
                  key={platform.name}
                  className="group relative z-10 flex items-center justify-center w-9 h-9 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-[#0d0d17] transition-all duration-300"
                  style={{
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: isGlowing ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)',
                    boxShadow: isGlowing
                      ? '0 0 25px rgba(59,130,246,0.5), inset 0 0 12px rgba(59,130,246,0.15)'
                      : 'none',
                  }}
                >
                  <Image
                    src={platform.icon}
                    alt={platform.name}
                    width={iconSize}
                    height={iconSize}
                    className="object-contain transition-opacity duration-300"
                    style={{ opacity: isGlowing ? 0.9 : 0.5 }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FooterSection() {
  const [email, setEmail] = useState('')

  return (
    <footer className="relative border-t border-white/[0.06]">
      {/* ===== Platform Icons Row — JS-synced energy beam ===== */}
      <PlatformIconsRow />

      {/* ===== Newsletter + Partner Badges ===== */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          {/* Newsletter Row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-8">
            {/* Left: Text */}
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm sm:text-[17px] mb-1">Subscribe to our newsletter</h3>
              <p className="text-white/35 text-[11px] sm:text-sm leading-relaxed max-w-md">
                Get a summary of what we&apos;ve shipped during the last month, behind the scenes updates, and team picks.
              </p>
            </div>

            {/* Right: Email Input */}
            <div className="flex items-center bg-[#0d0d17] border border-white/[0.08] rounded-lg sm:rounded-xl overflow-hidden w-full lg:w-auto">
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 flex-1">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/25 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent text-white/70 text-xs sm:text-sm placeholder:text-white/25 outline-none w-full min-w-[140px] sm:min-w-[180px]"
                />
              </div>
              <button className="px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-white whitespace-nowrap flex items-center gap-1 border-l border-white/[0.06]">
                Get Access
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Partner Badges + Rating Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-5 sm:mt-8 pt-5 sm:pt-7 border-t border-white/[0.04] gap-4 sm:gap-6">
            {/* Partner Badges */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {[
                { src: '/images/google-partner.avif', alt: 'Google Partner' },
                { src: '/images/meta-partner.avif', alt: 'Meta Business Partner' },
                { src: '/images/tiktok-partner.avif', alt: 'TikTok Agency Partner' },
              ].map((badge) => (
                <div key={badge.alt} className="flex items-center rounded-md sm:rounded-lg border border-white/[0.06] bg-[#0d0d17] overflow-hidden">
                  <Image src={badge.src} alt={badge.alt} width={120} height={40} className="object-contain h-[30px] sm:h-[40px] w-auto" />
                </div>
              ))}
            </div>

            {/* Trustpilot-style Rating */}
            <div className="flex items-center gap-3">
              {/* Green star boxes */}
              <div className="flex items-center gap-[2px]">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-[22px] h-[22px] bg-[#00b67a] rounded-[3px] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                ))}
              </div>
              <span className="text-white font-bold text-sm">5.0</span>

              {/* Divider */}
              <div className="w-[1px] h-5 bg-white/10" />

              {/* Users Love Us badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/[0.06] bg-[#0d0d17]">
                <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                <span className="text-white/50 text-[10px] font-medium leading-tight">Users<br/>Love Us</span>
              </div>

              {/* G2 style badge */}
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-white/[0.06] bg-[#0d0d17]">
                <div className="flex items-center gap-[1px]">
                  {[...Array(4)].map((_, i) => (
                    <svg key={i} className="w-2.5 h-2.5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <svg className="w-2.5 h-2.5 text-orange-400/40" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <span className="text-white/40 text-[10px] font-bold ml-0.5">G2</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Office Addresses ===== */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <h4 className="text-white/50 text-[10px] sm:text-xs font-semibold tracking-[0.15em] uppercase mb-4 sm:mb-6">OUR OFFICES</h4>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {[
              {
                country: 'United States',
                flag: '🇺🇸',
                address: '15442 Ventura Blvd. Ste 201-110, Sherman Oaks, CA 91403',
              },
              {
                country: 'United Kingdom',
                flag: '🇬🇧',
                address: '24-26 Arcadia Avenue, Fin009/8355, London, N3 2JU',
              },
              {
                country: 'Hong Kong',
                flag: '🇭🇰',
                address: 'Flat 2304, 23/F, Ho King Comm Centre, 2-16 Fa Yuen Street, Mong Kok',
              },
              {
                country: 'India',
                flag: '🇮🇳',
                address: '14/9 A Lower Ground Floor, Kalkaji, Opp. Deshbandhu College Gate, New Delhi 110019',
              },
            ].map((office) => (
              <div key={office.country} className="flex gap-2 sm:gap-3">
                <span className="text-sm sm:text-lg mt-0.5 flex-shrink-0">{office.flag}</span>
                <div>
                  <p className="text-white/70 text-[11px] sm:text-sm font-medium mb-0.5">{office.country}</p>
                  <p className="text-white/30 text-[9px] sm:text-xs leading-relaxed">{office.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Footer Links Grid ===== */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 sm:gap-8">
            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="text-white/50 text-[9px] sm:text-xs font-semibold tracking-[0.15em] uppercase mb-2 sm:mb-4">
                  {group.title}
                </h4>
                <ul className="space-y-1.5 sm:space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-white/40 text-[11px] sm:text-sm hover:text-white transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Bottom Bar ===== */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Left: Logo + Description */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4">
              <FooterLogo />
              <p className="text-white/30 text-[10px] sm:text-xs max-w-sm text-center sm:text-left leading-relaxed">
                ADS360 is the leading provider of premium agency ad accounts for Meta, Google, and TikTok. Trusted by 500+ advertisers worldwide.
              </p>
            </div>

            {/* Right: Policies + Payments */}
            <div className="flex flex-col items-center sm:items-end gap-2 sm:gap-3">
              <div className="flex items-center gap-3 sm:gap-4 text-white/30 text-[9px] sm:text-xs">
                <a href="#" className="hover:text-white/60 transition-colors">Purchase Policy</a>
                <a href="#" className="hover:text-white/60 transition-colors">Service Agreement</a>
                <a href="#" className="hover:text-white/60 transition-colors">Privacy Policy</a>
              </div>
              <div className="flex items-center gap-2">
                {/* Visa */}
                <div className="h-6 px-2 rounded bg-white/[0.06] flex items-center justify-center" title="Visa">
                  <svg viewBox="0 0 48 16" className="h-2.5 w-auto">
                    <path d="M19.4 1.2L15.8 14.8H12.6L16.2 1.2H19.4ZM33.8 9.8L35.4 5L36.4 9.8H33.8ZM37.2 14.8H40L37.6 1.2H35C34.2 1.2 33.4 1.6 33.2 2.4L28 14.8H31.4L32 13H36.2L37.2 14.8ZM28.6 10.2C28.6 6.4 23.2 6.2 23.2 4.4C23.2 3.8 23.8 3.2 25 3C25.6 2.9 27.2 2.8 29 3.6L29.6 1.6C28.6 1.2 27.4 0.8 25.8 0.8C22.6 0.8 20.4 2.6 20.4 5C20.4 6.8 22 7.8 23.2 8.4C24.4 9 24.8 9.4 24.8 10C24.8 10.8 23.8 11.2 23 11.2C21.2 11.2 20.2 10.8 19.2 10.2L18.6 12.2C19.6 12.8 21.2 13.2 22.8 13.2C26.2 13.2 28.6 11.4 28.6 10.2ZM12 1.2L7 14.8H3.4L1 3.4C0.8 2.6 0.6 2.4 0 2C-0.2 1.8 0 1.2 0 1.2H5.4C6.2 1.2 6.8 1.8 7 2.6L8.2 9.4L11.6 1.2H12Z" fill="#1A1F71"/>
                  </svg>
                </div>
                {/* Mastercard */}
                <div className="h-6 px-1.5 rounded bg-white/[0.06] flex items-center justify-center" title="Mastercard">
                  <svg viewBox="0 0 32 20" className="h-3 w-auto">
                    <circle cx="11" cy="10" r="8" fill="#EB001B" fillOpacity="0.9"/>
                    <circle cx="21" cy="10" r="8" fill="#F79E1B" fillOpacity="0.9"/>
                    <path d="M16 3.8a8 8 0 010 12.4 8 8 0 000-12.4z" fill="#FF5F00" fillOpacity="0.9"/>
                  </svg>
                </div>
                {/* Bank Transfer */}
                <div className="h-6 px-2 rounded bg-white/[0.06] flex items-center gap-1 justify-center" title="Bank Transfer">
                  <svg viewBox="0 0 16 16" className="h-2.5 w-auto text-white/40" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 1L1 5h14L8 1z"/>
                    <rect x="2" y="13" width="12" height="1.5" rx="0.3"/>
                    <path d="M3.5 5v8M6.5 5v8M9.5 5v8M12.5 5v8"/>
                  </svg>
                  <span className="text-[8px] text-white/35 font-medium">Bank</span>
                </div>
                {/* UPI */}
                <div className="h-6 px-2 rounded bg-white/[0.06] flex items-center gap-1 justify-center" title="UPI">
                  <svg viewBox="0 0 24 20" className="h-2.5 w-auto">
                    <polygon points="0,0 8,10 0,20" fill="#FF9933"/>
                    <polygon points="0,6.67 8,10 0,13.33" fill="white"/>
                    <polygon points="0,13.33 8,10 0,20" fill="#138808"/>
                    <polygon points="8,0 16,10 8,20" fill="#FF9933"/>
                    <polygon points="8,6.67 16,10 8,13.33" fill="white"/>
                    <polygon points="8,13.33 16,10 8,20" fill="#138808"/>
                  </svg>
                  <span className="text-[8px] text-white/40 font-bold tracking-wide">UPI</span>
                </div>
                {/* Crypto - Bitcoin */}
                <div className="h-6 px-2 rounded bg-white/[0.06] flex items-center gap-1 justify-center" title="Crypto">
                  <svg viewBox="0 0 20 20" className="h-3 w-auto" fill="none">
                    <circle cx="10" cy="10" r="9" fill="#F7931A"/>
                    <path d="M13.6 8.8c.2-1.3-.8-2-2.1-2.4l.4-1.7-1-.3-.4 1.7c-.3-.1-.5-.1-.8-.2l.4-1.7-1-.2-.4 1.7c-.2-.1-.4-.1-.7-.2l-1.4-.3-.3 1.1s.8.2.7.2c.4.1.5.3.5.5l-.5 2.1c0 0 .1 0 .1 0l-.1 0-.7 2.9c-.1.1-.2.3-.5.3 0 0-.7-.2-.7-.2L5 13.4l1.3.3c.2.1.5.1.7.2l-.4 1.7 1 .2.4-1.7c.3.1.5.1.8.2l-.4 1.7 1 .3.4-1.7c1.7.3 3 .2 3.5-1.3.4-1.2 0-1.9-.9-2.4.7-.1 1.2-.6 1.3-1.5zm-2.3 3.2c-.3 1.2-2.4.6-3 .4l.5-2.2c.7.2 2.8.5 2.5 1.8zm.3-3.3c-.3 1.1-2 .5-2.6.4l.5-2c.6.1 2.4.4 2.1 1.6z" fill="white"/>
                  </svg>
                  <span className="text-[8px] text-white/35 font-medium">Crypto</span>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-6 pt-4 border-t border-white/[0.04] text-center">
            <p className="text-white/20 text-xs">
              © 2026 ADS360 — All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
