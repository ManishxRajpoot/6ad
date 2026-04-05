'use client'

import { useState, useEffect, useRef } from 'react'

function LogoBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="sm:w-[34px] sm:h-[34px]">
        <defs>
          <linearGradient id="logoIconBg" x1="0" y1="40" x2="40" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#logoIconBg)" />
        {/* Radiant lines */}
        <line x1="20" y1="2" x2="20" y2="9" stroke="white" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
        <line x1="12" y1="5" x2="15" y2="11" stroke="white" strokeWidth="0.8" strokeOpacity="0.2" strokeLinecap="round" />
        <line x1="28" y1="5" x2="25" y2="11" stroke="white" strokeWidth="0.8" strokeOpacity="0.2" strokeLinecap="round" />
        <line x1="8" y1="10" x2="12" y2="14" stroke="white" strokeWidth="0.6" strokeOpacity="0.12" strokeLinecap="round" />
        <line x1="32" y1="10" x2="28" y2="14" stroke="white" strokeWidth="0.6" strokeOpacity="0.12" strokeLinecap="round" />
        {/* Pyramid right face */}
        <path d="M20 10 L33 35 L20 28Z" fill="white" fillOpacity="0.9" strokeLinejoin="round" />
        {/* Pyramid left face */}
        <path d="M20 10 L7 35 L20 28Z" fill="white" fillOpacity="0.5" strokeLinejoin="round" />
        {/* Pyramid bottom face */}
        <path d="M20 28 L7 35 L33 35Z" fill="white" fillOpacity="0.2" strokeLinejoin="round" />
      </svg>
      <span className="text-white font-bold text-[18px] sm:text-[20px] tracking-[0.18em] leading-none">ADS360</span>
    </div>
  )
}

const agencyItems = [
  {
    name: 'Facebook Agency Ad Accounts',
    desc: 'Get a Meta Agency Ad Account',
    href: '#agency-facebook',
    color: 'rgba(24,119,242,0.15)',
    glow: 'rgba(24,119,242,0.3)',
    border: 'rgba(24,119,242,0.25)',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#1877F2]">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    name: 'Google Agency Ad Accounts',
    desc: 'Get a Google Agency Ad Account',
    href: '#agency-google',
    color: 'rgba(66,133,244,0.12)',
    glow: 'rgba(66,133,244,0.25)',
    border: 'rgba(66,133,244,0.2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    name: 'TikTok Agency Ad Accounts',
    desc: 'Get a TikTok Agency Ad Account',
    href: '#agency-tiktok',
    color: 'rgba(255,255,255,0.07)',
    glow: 'rgba(255,255,255,0.2)',
    border: 'rgba(255,255,255,0.12)',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
      </svg>
    ),
  },
  {
    name: 'Snapchat Agency Ad Accounts',
    desc: 'Get a Snapchat Agency Ad Account',
    href: '#agency-snapchat',
    color: 'rgba(255,252,0,0.08)',
    glow: 'rgba(255,220,0,0.25)',
    border: 'rgba(255,220,0,0.2)',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400">
        <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.136 0 .256.031.375.086.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.794.807l.411-.015h.001z"/>
      </svg>
    ),
  },
  {
    name: 'Bing Agency Ad Accounts',
    desc: 'Get a Bing Agency Ad Account',
    href: '#agency-bing',
    color: 'rgba(0,120,212,0.12)',
    glow: 'rgba(0,120,212,0.3)',
    border: 'rgba(0,120,212,0.22)',
    icon: (
      <img src="/logos/bing.svg" alt="" className="w-5 h-5 object-contain" />
    ),
  },
]

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [agencyOpen, setAgencyOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const agencyRef = useRef<HTMLDivElement>(null)
  const servicesRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeServicesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (agencyRef.current && !agencyRef.current.contains(e.target as Node)) setAgencyOpen(false)
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) setServicesOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      if (closeTimer.current) clearTimeout(closeTimer.current)
      if (closeServicesTimer.current) clearTimeout(closeServicesTimer.current)
    }
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 pt-3 sm:pt-4">
      <div className="max-w-[1140px] mx-auto relative">

        {/* Glow border — opacity only, GPU composited */}
        <div className="header-glow-ring absolute -inset-[1px] rounded-full pointer-events-none"
          style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.25), rgba(34,211,238,0.35), rgba(168,85,247,0.25))' }} />

        {/* Top shine line */}
        <div className="absolute inset-x-[8%] top-0 h-[1px] rounded-full pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }} />

        {/* Glass pill — only backdrop-filter, no transition on it */}
        <div
          className="relative rounded-full flex items-center justify-between px-5 sm:px-8 py-3 sm:py-3.5"
          style={{
            background: scrolled ? 'rgba(8,8,22,0.35)' : 'rgba(10,10,30,0.82)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 4px_50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Moving shine sweep — opacity+transform only */}
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <div className="header-shine-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
          </div>
          {/* Bottom inner glow line */}
          <div className="absolute bottom-0 inset-x-[15%] h-[1px] pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.12), transparent)' }} />

          {/* Logo */}
          <a href="/" className="shrink-0 relative group">
            <LogoBrand />
            {/* logo glow — opacity only */}
            <div className="absolute -inset-3 rounded-full pointer-events-none logo-hover-glow"
              style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)' }} />
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {/* Agency Accounts dropdown */}
            <div
              ref={agencyRef}
              className="relative"
              onMouseEnter={() => {
                if (closeTimer.current) clearTimeout(closeTimer.current)
                setAgencyOpen(true)
              }}
              onMouseLeave={() => {
                closeTimer.current = setTimeout(() => setAgencyOpen(false), 120)
              }}
            >
              <button
                onClick={() => setAgencyOpen(v => !v)}
                className="header-nav-btn relative flex items-center gap-1.5 px-4 xl:px-5 py-2 rounded-full text-[13px] font-medium text-white/50"
              >
                {/* hover bg — opacity only */}
                <span className="header-nav-bg absolute inset-0 rounded-full opacity-0"
                  style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }} />
                {/* underline — transform only */}
                <span className={`absolute bottom-0.5 left-1/2 h-[2px] rounded-full header-nav-line ${agencyOpen ? 'active' : ''}`}
                  style={{ background: 'linear-gradient(90deg, #60a5fa, #22d3ee)' }} />
                <span className="relative">{agencyOpen ? <span className="text-white">Agency Accounts</span> : 'Agency Accounts'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`relative w-3.5 h-3.5 transition-transform duration-200 ${agencyOpen ? 'rotate-180 text-white' : ''}`}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Mega dropdown */}
              <div
                className="fixed w-[900px] rounded-2xl z-[999]"
                style={{
                  top: '72px',
                  left: '50%',
                  transform: agencyOpen
                    ? 'translateX(-50%) translateY(0px)'
                    : 'translateX(-50%) translateY(-10px)',
                  opacity: agencyOpen ? 1 : 0,
                  pointerEvents: agencyOpen ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                  willChange: 'opacity, transform',
                  background: 'linear-gradient(135deg, #09091f 0%, #0b0b22 60%, #08081c 100%)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 0 60px rgba(59,130,246,0.1)',
                }}
              >
                {/* ambient blue glow top-left */}
                <div className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none opacity-30"
                  style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.4), transparent 70%)', transform: 'translate(-30%, -30%)' }} />
                {/* ambient purple glow bottom-right */}
                <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full pointer-events-none opacity-20"
                  style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)', transform: 'translate(30%, 30%)' }} />
                {/* top shine */}
                <div className="absolute inset-x-[8%] top-0 h-[1px] rounded-full pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)' }} />

                <div className="relative p-6">
                  <p className="text-white/25 text-[10.5px] font-semibold tracking-[0.2em] uppercase mb-4">Agency Ad Accounts</p>

                  <div className="grid grid-cols-2 gap-2">
                    {agencyItems.map(item => (
                      <a key={item.name} href={item.href} className="dropdown-card group relative flex items-center gap-4 px-4 py-3.5 rounded-xl overflow-hidden"
                        style={{ border: `1px solid rgba(255,255,255,0.06)`, background: 'rgba(255,255,255,0.02)' }}>
                        {/* hover bg glow */}
                        <span className="dropdown-card-bg absolute inset-0 opacity-0 transition-opacity duration-200 rounded-xl"
                          style={{ background: item.color }} />
                        {/* icon box */}
                        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                          style={{ background: item.color, border: `1px solid ${item.border}` }}>
                          {/* icon glow on hover */}
                          <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            style={{ boxShadow: `0 0 16px ${item.glow}` }} />
                          <div className="relative scale-110">{item.icon}</div>
                        </div>
                        <div className="flex-1 min-w-0 relative">
                          <p className="text-white/75 text-[14px] font-semibold leading-tight group-hover:text-white transition-colors duration-150">{item.name}</p>
                          <p className="text-white/30 text-[12px] mt-0.5 leading-tight group-hover:text-white/45 transition-colors duration-150">{item.desc}</p>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className="relative w-4 h-4 shrink-0 opacity-0 group-hover:opacity-60 transition-all duration-150 translate-x-0 group-hover:translate-x-0.5 text-white">
                          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    ))}
                  </div>

                  <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <p className="text-white/55 text-[13px] font-medium">Need help choosing?</p>
                      <p className="text-white/28 text-[12px] mt-0.5">Message us on Telegram or WhatsApp for real-time support</p>
                    </div>
                    <a href="#contact" className="contact-telegram-btn flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium text-blue-400">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                      Telegram →
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Services dropdown */}
            <div
              ref={servicesRef}
              className="relative"
              onMouseEnter={() => { if (closeServicesTimer.current) clearTimeout(closeServicesTimer.current); setServicesOpen(true) }}
              onMouseLeave={() => { closeServicesTimer.current = setTimeout(() => setServicesOpen(false), 120) }}
            >
              <button
                onClick={() => setServicesOpen(v => !v)}
                className="header-nav-btn relative flex items-center gap-1.5 px-4 xl:px-5 py-2 rounded-full text-[13px] font-medium text-white/50"
              >
                <span className="header-nav-bg absolute inset-0 rounded-full opacity-0"
                  style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }} />
                <span className={`absolute bottom-0.5 left-1/2 h-[2px] rounded-full header-nav-line ${servicesOpen ? 'active' : ''}`}
                  style={{ background: 'linear-gradient(90deg, #60a5fa, #22d3ee)' }} />
                <span className="relative">{servicesOpen ? <span className="text-white">Other Services</span> : 'Other Services'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`relative w-3.5 h-3.5 transition-transform duration-200 ${servicesOpen ? 'rotate-180 text-white' : ''}`}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Services mega dropdown — fixed centered */}
              <div
                className="fixed w-[900px] rounded-2xl z-[999]"
                style={{
                  top: '72px',
                  left: '50%',
                  transform: servicesOpen
                    ? 'translateX(-50%) translateY(0px)'
                    : 'translateX(-50%) translateY(-10px)',
                  opacity: servicesOpen ? 1 : 0,
                  pointerEvents: servicesOpen ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                  willChange: 'opacity, transform',
                  background: 'linear-gradient(135deg, #09091f 0%, #0b0b22 60%, #08081c 100%)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 0 60px rgba(139,92,246,0.08)',
                }}
              >
                {/* ambient glows */}
                <div className="absolute top-0 right-0 w-52 h-52 rounded-full pointer-events-none opacity-25"
                  style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)', transform: 'translate(20%, -30%)' }} />
                <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full pointer-events-none opacity-20"
                  style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.5), transparent 70%)', transform: 'translate(-20%, 30%)' }} />
                <div className="absolute inset-x-[8%] top-0 h-[1px] rounded-full pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)' }} />

                <div className="relative p-6 grid grid-cols-2 gap-5">
                  {/* Col 1 — Assets */}
                  <div>
                    <p className="text-white/25 text-[10.5px] font-semibold tracking-[0.18em] uppercase mb-3">Assets</p>
                    <div className="flex flex-col gap-1">
                      {[
                        { name: 'Facebook Accounts', desc: 'Aged, verified profiles for stability & scale', color: 'rgba(24,119,242,0.12)', border: 'rgba(24,119,242,0.22)', img: '/logos/facebook.svg', big: false, href: '/shop?category=facebook-profiles' },
                        { name: 'Business Managers', desc: 'Clean BMs with proper structure', color: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.18)', img: 'https://res.cloudinary.com/dtjuzz6fm/image/upload/v1767810129/ecomblack/categories/fyws0sahqsrsrknky7tm.png', big: true, href: '/shop?category=business-managers' },
                        { name: 'Facebook Pages', desc: 'Niche-aligned pages to boost credibility', color: 'rgba(24,119,242,0.08)', border: 'rgba(24,119,242,0.15)', img: 'https://res.cloudinary.com/dtjuzz6fm/image/upload/v1767810707/ecomblack/categories/xywxlbbtxujkkgvcoley.png', big: true, href: '/shop?category=facebook-pages' },
                        { name: 'TikTok Accounts', desc: 'Get the most out of TikTok ads', color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', img: '/logos/tiktok.svg', big: false, href: '/shop?category=tiktok-profiles' },
                      ].map(item => (
                        <a key={item.name} href={item.href} className="dropdown-card group relative flex items-center gap-3 px-3 py-2.5 rounded-xl overflow-hidden"
                          style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}>
                          <span className="dropdown-card-bg absolute inset-0 opacity-0 transition-opacity duration-200 rounded-xl" style={{ background: item.color }} />
                          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                            style={{ background: item.color, border: `1px solid ${item.border}` }}>
                            <img src={item.img} alt="" className={item.big ? 'w-6 h-6' : 'w-4 h-4'} />
                          </div>
                          <div className="relative">
                            <p className="text-white/75 text-[13px] font-semibold leading-tight group-hover:text-white transition-colors duration-150">{item.name}</p>
                            <p className="text-white/28 text-[11px] mt-0.5 leading-tight group-hover:text-white/40 transition-colors duration-150">{item.desc}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Col 2 — Other Services */}
                  <div>
                    <p className="text-white/25 text-[10.5px] font-semibold tracking-[0.18em] uppercase mb-3">Other Services</p>
                    <div className="flex flex-col gap-1">
                      {[
                        { name: 'FB Feedback Score Boost', desc: 'Diagnose, recover & grow page feedback', color: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', img: '/logos/fb-feedback.svg', href: '/shop' },
                        { name: 'Account Health Assessment', desc: 'Full compliance audit + action plan', color: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)', img: '/logos/account-health.svg', href: '/shop' },
                      ].map(item => (
                        <a key={item.name} href={item.href} className="dropdown-card group relative flex items-center gap-3 px-3 py-2.5 rounded-xl overflow-hidden"
                          style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}>
                          <span className="dropdown-card-bg absolute inset-0 opacity-0 transition-opacity duration-200 rounded-xl" style={{ background: item.color }} />
                          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: item.color, border: `1px solid ${item.border}` }}>
                            <img src={item.img} alt="" className="w-6 h-6" />
                          </div>
                          <div className="relative">
                            <p className="text-white/75 text-[13px] font-semibold leading-tight group-hover:text-white transition-colors duration-150">{item.name}</p>
                            <p className="text-white/28 text-[11px] mt-0.5 leading-tight group-hover:text-white/40 transition-colors duration-150">{item.desc}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="mx-6 mb-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <p className="text-white/55 text-[13px] font-medium">Need help choosing?</p>
                    <p className="text-white/28 text-[12px] mt-0.5">Message us on Telegram or WhatsApp for real-time support</p>
                  </div>
                  <a href="#contact" className="contact-telegram-btn flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium text-blue-400">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                    Telegram →
                  </a>
                </div>
              </div>
            </div>

            {/* Regular nav links */}
            {[{ name: 'Shop', href: '/shop' }, { name: 'Pricing', href: '#pricing' }, { name: 'Blog', href: '/blog' }, { name: 'About Us', href: '#about' }].map(link => (
              <a key={link.name} href={link.href} className="header-nav-btn relative px-4 xl:px-5 py-2 rounded-full text-[13px] font-medium text-white/50">
                <span className="header-nav-bg absolute inset-0 rounded-full opacity-0"
                  style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }} />
                <span className="header-nav-line absolute bottom-0.5 left-1/2 h-[2px] rounded-full"
                  style={{ background: 'linear-gradient(90deg, #60a5fa, #22d3ee)' }} />
                <span className="relative">{link.name}</span>
              </a>
            ))}
          </nav>

          {/* CTA Button */}
          <a href="#contact" className="hidden lg:inline-flex items-center px-6 py-2.5 rounded-full text-[13px] font-semibold text-white relative overflow-hidden header-cta-btn"
            style={{ border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)' }}>
            {/* shimmer sweep — transform only, GPU */}
            <span className="cta-shimmer absolute inset-0"
              style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.13) 50%, transparent 65%)' }} />
            <span className="relative">Contact</span>
          </a>

          {/* Mobile */}
          <MobileMenuButton />
        </div>
      </div>
    </header>
  )
}

function MobileMenuButton() {
  const [open, setOpen] = useState(false)
  const [agencyOpen, setAgencyOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)

  const otherServicesItems = [
    { name: 'Facebook Accounts', href: '#' },
    { name: 'Business Managers', href: '#' },
    { name: 'Facebook Pages', href: '#' },
    { name: 'TikTok Accounts', href: '#' },
    { name: 'FB Feedback Score Boost', href: '#' },
    { name: 'Account Health Assessment', href: '#' },
  ]

  const navLinks = [
    { name: 'Shop', href: '/shop' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Blog', href: '/blog' },
    { name: 'About Us', href: '#about' },
  ]

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="text-white/70 hover:text-white p-2.5 rounded-full hover:bg-white/[0.06] transition-colors duration-150 relative w-10 h-10 flex flex-col items-center justify-center gap-[5px]"
        aria-label="Menu"
      >
        <span className={`block w-[18px] h-[1.5px] bg-current transition-transform duration-200 ${open ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
        <span className={`block w-[18px] h-[1.5px] bg-current transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-[18px] h-[1.5px] bg-current transition-transform duration-200 ${open ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
      </button>

      <div
        className="absolute top-full left-4 right-4 mt-3 rounded-2xl z-50"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(-8px)',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          willChange: 'opacity, transform',
          background: '#08081e',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 70px rgba(0,0,0,0.7)',
        }}
      >
        <div className="absolute inset-x-[10%] top-0 h-[1px] pointer-events-none rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
        <div className="py-2">
          <button
            onClick={() => setAgencyOpen(!agencyOpen)}
            className="w-full flex items-center justify-between px-6 py-3.5 text-white/50 hover:text-white text-sm font-medium hover:bg-white/[0.05] transition-colors duration-150"
          >
            Agency Accounts
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`w-4 h-4 transition-transform duration-200 ${agencyOpen ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ maxHeight: agencyOpen ? '400px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
            {agencyItems.map(item => (
              <a key={item.name} href={item.href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 pl-7 pr-5 py-2.5 text-white/40 hover:text-white/80 text-sm hover:bg-white/[0.04] transition-colors duration-150">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {item.icon}
                </div>
                {item.name}
              </a>
            ))}
          </div>
          <button
            onClick={() => setServicesOpen(!servicesOpen)}
            className="w-full flex items-center justify-between px-6 py-3.5 text-white/50 hover:text-white text-sm font-medium hover:bg-white/[0.05] transition-colors duration-150"
          >
            Other Services
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`w-4 h-4 transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ maxHeight: servicesOpen ? '400px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
            {otherServicesItems.map(item => (
              <a key={item.name} href={item.href} onClick={() => setOpen(false)}
                className="block pl-10 pr-5 py-2.5 text-white/40 hover:text-white/80 text-sm hover:bg-white/[0.04] transition-colors duration-150">
                {item.name}
              </a>
            ))}
          </div>
          {navLinks.map(link => (
            <a key={link.name} href={link.href} onClick={() => setOpen(false)}
              className="block px-6 py-3.5 text-white/50 hover:text-white text-sm font-medium hover:bg-white/[0.05] transition-colors duration-150">
              {link.name}
            </a>
          ))}
          <div className="px-4 pt-2 pb-3">
            <a href="#contact"
              className="block text-center text-white/90 hover:text-white px-5 py-3 rounded-full text-sm font-semibold transition-colors duration-150 relative overflow-hidden">
              <span className="absolute inset-0 rounded-full p-[1px] overflow-hidden pointer-events-none">
                <span className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.5), rgba(34,211,238,0.5), rgba(59,130,246,0.5))' }} />
                <span className="absolute inset-[1px] rounded-full" style={{ background: '#0a0a1e' }} />
              </span>
              <span className="relative">Contact</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Header
