'use client'

import { useState, useEffect } from 'react'

// ==================== ADS360 LOGO — PREMIUM MODERN ====================
function LogoBrand() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Icon mark */}
      <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="sm:w-[34px] sm:h-[34px]">
        <defs>
          <linearGradient id="logoIconBg" x1="0" y1="40" x2="40" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="logoTri1" x1="20" y1="30" x2="20" y2="8">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="logoTri2" x1="24" y1="32" x2="24" y2="10">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="white" stopOpacity="0.55" />
          </linearGradient>
          <filter id="logoGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#3b82f6" floodOpacity="0.4" />
          </filter>
        </defs>
        {/* Rounded square bg */}
        <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#logoIconBg)" />
        <rect x="1" y="1" width="38" height="38" rx="10" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.15" />
        {/* Inner shine */}
        <rect x="2" y="2" width="36" height="18" rx="9" fill="white" fillOpacity="0.06" />
        {/* Two overlapping triangles — the ADS360 mark */}
        <path d="M13 30 L20 10 L27 30Z" fill="url(#logoTri1)" filter="url(#logoGlow)" />
        <path d="M17 32 L24 12 L31 32Z" fill="url(#logoTri2)" />
      </svg>
      {/* Wordmark */}
      <span className="text-white font-bold text-[18px] sm:text-[20px] tracking-[0.18em] leading-none">
        ADS360
      </span>
    </div>
  )
}

// ==================== HEADER — FUTURISTIC GLOSSY ====================
function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [activeLink, setActiveLink] = useState('')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'About Us', href: '#about' },
    { name: 'Features', href: '#features' },
    { name: 'Services', href: '#services' },
    { name: 'Analytics', href: '#analytics' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Help Center', href: '#faq' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 pt-3 sm:pt-4">
      {/* Outer glow aura */}
      <div className={`max-w-[1140px] mx-auto relative transition-all duration-700 ${scrolled ? 'pt-0' : 'pt-0'}`}>
        {/* Animated gradient border glow — the futuristic ring */}
        <div className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-blue-500/20 via-cyan-400/30 to-purple-500/20 opacity-60 blur-[1px] pointer-events-none header-border-glow" />
        {/* Top glossy shine — holographic reflection */}
        <div className="absolute inset-x-[10%] top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full pointer-events-none" />
        {/* Secondary top shine — wider, softer */}
        <div className="absolute inset-x-[5%] top-[1px] h-[1px] bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent rounded-full pointer-events-none" />

        {/* Main glass container */}
        <div className={`relative rounded-full transition-all duration-700 ease-out ${
          scrolled
            ? 'bg-[#080816]/30 backdrop-blur-[28px] shadow-[0_8px_60px_rgba(0,0,0,0.3),0_0_30px_rgba(59,130,246,0.04),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(255,255,255,0.02)]'
            : 'bg-[#0a0a1e]/80 backdrop-blur-[16px] shadow-[0_4px_60px_rgba(0,0,0,0.5),0_0_30px_rgba(59,130,246,0.06),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.02)]'
        }`}>
          {/* Moving holographic shine across the header */}
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent header-shine-sweep" />
          </div>
          {/* Bottom inner reflection */}
          <div className="absolute bottom-0 inset-x-[15%] h-[1px] bg-gradient-to-r from-transparent via-blue-400/10 to-transparent pointer-events-none" />

          <div className="relative flex items-center justify-between px-5 sm:px-8 py-3 sm:py-3.5">
            {/* Logo */}
            <a href="/" className="flex items-center shrink-0 group relative">
              <LogoBrand />
              {/* Logo glow on hover */}
              <div className="absolute -inset-3 bg-blue-500/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </a>

            {/* Desktop Nav — futuristic hover effects */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {navLinks.map(link => (
                <a
                  key={link.name}
                  href={link.href}
                  onMouseEnter={() => setActiveLink(link.name)}
                  onMouseLeave={() => setActiveLink('')}
                  className="relative text-white/50 hover:text-white text-[13px] font-medium tracking-wide transition-all duration-300 px-4 xl:px-5 py-2 rounded-full group"
                >
                  {/* Hover background glow */}
                  <span className={`absolute inset-0 rounded-full transition-all duration-300 ${
                    activeLink === link.name
                      ? 'bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_15px_rgba(59,130,246,0.1)]'
                      : 'bg-transparent'
                  }`} />
                  {/* Bottom indicator line */}
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-300 ${
                    activeLink === link.name ? 'w-5 opacity-100' : 'w-0 opacity-0'
                  }`} />
                  <span className="relative">{link.name}</span>
                </a>
              ))}
            </nav>

            {/* CTA Button — glowing neon border */}
            <a
              href="#contact"
              className="hidden lg:inline-flex items-center px-6 py-2.5 rounded-full text-[13px] font-semibold tracking-wide transition-all duration-500 relative overflow-hidden group"
            >
              {/* Animated gradient border */}
              <span className="absolute inset-0 rounded-full p-[1px] overflow-hidden">
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/60 via-cyan-400/60 to-blue-500/60 cta-border-rotate" />
                <span className="absolute inset-[1px] rounded-full bg-[#0a0a1e]/90 backdrop-blur-sm" />
              </span>
              {/* Hover fill glow */}
              <span className="absolute inset-[1px] rounded-full bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-all duration-500" />
              {/* Outer glow on hover */}
              <span className="absolute -inset-1 rounded-full bg-blue-500/0 group-hover:bg-blue-500/10 blur-xl transition-all duration-500 pointer-events-none" />
              <span className="relative text-white/90 group-hover:text-white transition-colors duration-300">Contact Sales</span>
            </a>

            {/* Mobile menu button */}
            <MobileMenuButton navLinks={navLinks} />
          </div>
        </div>
      </div>
    </header>
  )
}

function MobileMenuButton({ navLinks }: { navLinks: { name: string; href: string }[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="text-white/70 hover:text-white p-2.5 rounded-full hover:bg-white/[0.06] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200 relative w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
      >
        <span className={`block w-[18px] h-[1.5px] bg-current transition-all duration-300 ${open ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
        <span className={`block w-[18px] h-[1.5px] bg-current transition-all duration-300 ${open ? 'opacity-0 scale-0' : ''}`} />
        <span className={`block w-[18px] h-[1.5px] bg-current transition-all duration-300 ${open ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
      </button>

      {/* Mobile dropdown — futuristic glass panel */}
      <div className={`absolute top-full left-4 right-4 mt-3 rounded-2xl overflow-hidden transition-all duration-300 ${
        open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-3 pointer-events-none'
      }`}>
        <div className="relative">
          {/* Border glow */}
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-white/10 via-blue-500/10 to-transparent pointer-events-none" />
          <div className="relative bg-[#080816]/95 backdrop-blur-[16px] border border-white/[0.06] rounded-2xl py-2 shadow-[0_20px_80px_rgba(0,0,0,0.7),0_0_30px_rgba(59,130,246,0.08)]">
            {/* Top shine */}
            <div className="absolute inset-x-[10%] top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            {navLinks.map(link => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-6 py-3.5 text-white/50 hover:text-white text-sm font-medium hover:bg-white/[0.05] transition-all duration-200"
              >
                {link.name}
              </a>
            ))}
            <div className="px-4 pt-2 pb-3">
              <a
                href="#contact"
                className="block text-center text-white/90 px-5 py-3 rounded-full text-sm font-semibold transition-all duration-300 relative overflow-hidden"
              >
                <span className="absolute inset-0 rounded-full p-[1px]">
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/50 via-cyan-400/50 to-blue-500/50" />
                  <span className="absolute inset-[1px] rounded-full bg-[#0a0a1e]/90" />
                </span>
                <span className="relative">Contact Sales</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Header
