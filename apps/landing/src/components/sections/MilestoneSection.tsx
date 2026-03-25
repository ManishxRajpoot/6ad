'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'

const leaders = [
  { name: 'Vish••••', spend: '$3,732,000', rank: 3, cardHeight: 220, topOffset: 80 },
  { name: 'Kar••••', spend: '$9,685,100', rank: 1, cardHeight: 300, topOffset: 0 },
  { name: 'Raj••••', spend: '$8,301,000', rank: 2, cardHeight: 260, topOffset: 40 },
]

/* ── 3D Medal Coin — metallic circle with logo-icon-white.svg centered ── */
function MedalCoin({ type, size = 90 }: { type: 'gold' | 'silver' | 'steel'; size?: number }) {
  const id = `medal-${type}-${size}`
  const logoSize = Math.round(size * 0.38)

  const palette = {
    gold: {
      outerRim: '#96700a',
      body1: '#e8b800', body2: '#c99a00', body3: '#a67c00',
      inner1: '#ffd52e', inner2: '#e8b800', inner3: '#b8920a',
      shine: '#fff5b0',
      shadow: 'rgba(120,90,0,0.6)',
      rimLight: '#ffe066',
    },
    silver: {
      outerRim: '#6b6b6b',
      body1: '#d4d4d4', body2: '#b0b0b0', body3: '#8a8a8a',
      inner1: '#e8e8e8', inner2: '#c8c8c8', inner3: '#9a9a9a',
      shine: '#ffffff',
      shadow: 'rgba(60,60,60,0.5)',
      rimLight: '#e0e0e0',
    },
    steel: {
      outerRim: '#5a7a9a',
      body1: '#9dc2e0', body2: '#7ca8c8', body3: '#5e8aab',
      inner1: '#b8d8f0', inner2: '#90bcd8', inner3: '#6a9abe',
      shine: '#dceef8',
      shadow: 'rgba(40,70,100,0.5)',
      rimLight: '#c0dae8',
    },
  }

  const c = palette[type]

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Ambient glow */}
      <div
        className="absolute rounded-full blur-xl"
        style={{
          inset: '-15%',
          background: type === 'gold'
            ? 'radial-gradient(circle, rgba(255,200,0,0.25) 0%, transparent 70%)'
            : type === 'silver'
            ? 'radial-gradient(circle, rgba(200,200,200,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(100,170,220,0.2) 0%, transparent 70%)',
        }}
      />

      <svg width={size} height={size} viewBox="0 0 120 120" fill="none" className="relative">
        <defs>
          <radialGradient id={`${id}-body`} cx="0.38" cy="0.32" r="0.65">
            <stop offset="0%" stopColor={c.body1} />
            <stop offset="50%" stopColor={c.body2} />
            <stop offset="100%" stopColor={c.body3} />
          </radialGradient>
          <radialGradient id={`${id}-inner`} cx="0.4" cy="0.35" r="0.58">
            <stop offset="0%" stopColor={c.inner1} />
            <stop offset="55%" stopColor={c.inner2} />
            <stop offset="100%" stopColor={c.inner3} />
          </radialGradient>
          <radialGradient id={`${id}-shine`} cx="0.45" cy="0.2" r="0.5">
            <stop offset="0%" stopColor={c.shine} stopOpacity="0.5" />
            <stop offset="100%" stopColor={c.shine} stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-shadow`} x="-20%" y="-10%" width="140%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={c.shadow} floodOpacity="0.7" />
          </filter>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.rimLight} />
            <stop offset="50%" stopColor={c.outerRim} />
            <stop offset="100%" stopColor={c.outerRim} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Outer coin body */}
        <circle cx="60" cy="60" r="54" fill={`url(#${id}-body)`} filter={`url(#${id}-shadow)`} />
        {/* Rim */}
        <circle cx="60" cy="60" r="54" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="3" />
        {/* Groove */}
        <circle cx="60" cy="60" r="50" fill="none" stroke={c.outerRim} strokeWidth="1" opacity="0.5" />
        {/* Inner face */}
        <circle cx="60" cy="60" r="44" fill={`url(#${id}-inner)`} />
        <circle cx="60" cy="60" r="44" fill="none" stroke={c.rimLight} strokeWidth="0.8" opacity="0.25" />
        <circle cx="60" cy="60" r="43" fill="none" stroke={c.outerRim} strokeWidth="0.5" opacity="0.3" />

        {/* Top shine */}
        <ellipse cx="52" cy="38" rx="20" ry="12" fill={`url(#${id}-shine)`} />
      </svg>

      {/* Logo image overlay — positioned absolutely in center of coin */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.45 }}>
        <Image
          src="/logo-icon-white.svg"
          alt=""
          width={logoSize}
          height={logoSize}
          className="pointer-events-none select-none"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
        />
      </div>
    </div>
  )
}

export default function MilestoneSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setIsVisible(true) }, { threshold: 0.1 })
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="milestone" className="relative pt-12 sm:pt-16 pb-14 sm:pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-transparent" />
      {/* Trophy glow + sparkles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="milestone-trophy-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/[0.08] rounded-full" />
        {/* Sparkle particles */}
        {[
          {t:'20%',l:'10%',d:'0s'},{t:'25%',l:'85%',d:'1s'},{t:'45%',l:'5%',d:'2s'},
          {t:'55%',l:'90%',d:'1.5s'},{t:'70%',l:'45%',d:'3s'},{t:'35%',l:'55%',d:'4s'},
          {t:'15%',l:'50%',d:'2.5s'},{t:'65%',l:'20%',d:'3.5s'},{t:'80%',l:'75%',d:'0.5s'},
        ].map((s, i) => (
          <div key={i} className="milestone-sparkle absolute w-1.5 h-1.5 bg-amber-400/60 rounded-full" style={{top:s.t,left:s.l,animationDelay:s.d}} />
        ))}
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* ===== MOBILE: Design A — Compact Horizontal Podium ===== */}
        <div className={`sm:hidden bg-[#0d1228] border border-white/[0.06] rounded-2xl p-5 overflow-hidden transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="text-blue-400 text-xs font-semibold tracking-wide">ADS360 Milestone Club</span>
          <h2 className="text-xl font-bold text-white mt-2 leading-tight">Get Rewarded for Your Ad Spend</h2>
          <p className="text-white/40 text-xs mt-2 leading-relaxed">
            Join our Milestone Program and earn exclusive trophies, curated mystery gifts, and leaderboard status.
          </p>
          <a href="#pricing" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/[0.07] border border-white/[0.12] rounded-lg text-white text-xs font-medium">
            See Leaders
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>

          {/* Mini podium */}
          <div className="flex items-end justify-center gap-3 mt-6 pb-2">
            {leaders.map((leader, i) => {
              const medalType = leader.rank === 1 ? 'gold' : leader.rank === 2 ? 'silver' : 'steel' as const
              const heights: Record<number, number> = { 1: 120, 2: 100, 3: 80 }
              const medalSizes: Record<number, number> = { 1: 60, 2: 52, 3: 45 }
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                  style={{ transitionDelay: `${300 + i * 200}ms` }}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <Image src="/logo-icon.svg" alt="" width={12} height={12} className="rounded-[3px]" />
                    <span className="text-white text-[9px] font-bold">{leader.name}</span>
                    <svg className="w-3 h-3 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812z" clipRule="evenodd" /></svg>
                  </div>
                  <p className="text-white/30 text-[8px]">Total Ad Spend:</p>
                  <p className="text-white font-bold text-[11px] mb-1.5">{leader.spend}</p>
                  <div className="rounded-xl relative overflow-hidden flex items-center justify-center" style={{
                    width: 90, height: heights[leader.rank] || 80,
                    background: 'linear-gradient(175deg, #4a8be0 0%, #3b7ad4 25%, #2d6ac8 50%, #6ea8e8 85%, #c8ddf4 100%)',
                    boxShadow: '0 6px 24px rgba(37,99,235,0.15)',
                  }}>
                    <div className="absolute inset-0 rounded-xl border border-white/[0.12]" />
                    <MedalCoin type={medalType} size={medalSizes[leader.rank] || 45} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ===== DESKTOP: Original layout ===== */}
        <div className={`hidden sm:block bg-[#0d1228] border border-white/[0.06] rounded-2xl pl-10 lg:pl-14 pr-10 lg:pr-14 pt-10 lg:pt-14 pb-0 overflow-hidden transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="grid lg:grid-cols-[1fr,1.1fr] gap-8 lg:gap-12 items-center">

            {/* Left content */}
            <div className={`transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <span className="text-blue-400 text-sm font-semibold tracking-wide">ADS360 Milestone Club</span>

              <h2 className="text-[40px] font-bold text-white mt-4 leading-[1.15]">
                Get Rewarded for Your<br />Ad Spend
              </h2>

              <p className="text-white/40 text-[15px] mt-5 leading-relaxed max-w-[420px]">
                Join our Milestone Program and earn exclusive trophies, curated mystery gifts, and leaderboard status as you scale your monthly ad spend.
              </p>

              <div className="flex flex-wrap gap-3 mt-10">
                <a
                  href="#pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.07] border border-white/[0.12] rounded-lg text-white text-sm font-medium hover:bg-white/[0.12] transition-all duration-200 group"
                >
                  See This Month&apos;s Leaders
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a
                  href="#contact"
                  className="inline-flex items-center px-6 py-3 bg-transparent border border-white/[0.08] rounded-lg text-white/50 text-sm font-medium hover:bg-white/[0.05] hover:text-white/70 transition-all duration-200"
                >
                  How to Claim
                </a>
              </div>
            </div>

            {/* Right - Trophy podium */}
            <div className="flex items-end justify-center gap-5 min-h-[460px] relative pt-8 -mb-1">
              {leaders.map((leader, i) => {
                const medalType = leader.rank === 1 ? 'gold' : leader.rank === 2 ? 'silver' : 'steel' as const
                const medalSize = leader.rank === 1 ? 110 : leader.rank === 2 ? 95 : 85

                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}
                    style={{
                      marginTop: `${leader.topOffset}px`,
                      transitionDelay: `${300 + i * 200}ms`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Image src="/logo-icon.svg" alt="" width={18} height={18} className="rounded-[5px]" />
                      <span className="text-white text-sm font-bold tracking-wide">{leader.name}</span>
                      <svg className="w-[16px] h-[16px] text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-white/35 text-[11px] tracking-wide">Total Ad Spend:</p>
                    <p className="text-white font-bold text-lg mb-3">{leader.spend}</p>
                    <div
                      className="w-[155px] rounded-[20px] relative overflow-hidden flex items-center justify-center"
                      style={{
                        height: `${leader.cardHeight}px`,
                        background: 'linear-gradient(175deg, #4a8be0 0%, #3b7ad4 25%, #2d6ac8 50%, #6ea8e8 85%, #c8ddf4 100%)',
                        boxShadow: '0 10px 40px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.15)',
                      }}
                    >
                      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" preserveAspectRatio="none">
                        <defs>
                          <pattern id={`stripes-${i}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                            <line x1="0" y1="0" x2="0" y2="6" stroke="white" strokeWidth="0.8" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill={`url(#stripes-${i})`} />
                      </svg>
                      <div className="absolute -top-10 -left-10 w-36 h-36 bg-white/[0.05] rounded-full blur-2xl" />
                      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-white/[0.06] to-transparent" />
                      <div className="absolute inset-0 rounded-[20px] border border-white/[0.12]" />
                      <MedalCoin type={medalType} size={medalSize} />
                    </div>
                  </div>
                )
              })}

              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <svg width="100" height="40" viewBox="0 0 100 40" fill="none" className="opacity-10">
                  <path d="M45 36C40 27 28 22 20 24C28 26 38 30 45 36Z" fill="white" />
                  <path d="M42 30C37 22 26 18 18 20C26 22 35 26 42 30Z" fill="white" />
                  <path d="M40 24C36 17 26 14 20 16C26 18 34 21 40 24Z" fill="white" />
                  <path d="M55 36C60 27 72 22 80 24C72 26 62 30 55 36Z" fill="white" />
                  <path d="M58 30C63 22 74 18 82 20C74 22 65 26 58 30Z" fill="white" />
                  <path d="M60 24C64 17 74 14 80 16C74 18 66 21 60 24Z" fill="white" />
                  <line x1="50" y1="38" x2="50" y2="12" stroke="white" strokeWidth="0.8" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
