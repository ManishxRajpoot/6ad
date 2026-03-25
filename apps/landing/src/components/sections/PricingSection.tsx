'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useScrollReveal } from '../shared/useScrollReveal'

const mainPlatforms = ['Facebook', 'Tiktok', 'Google', 'Bing', 'Snapchat'] as const
const fbSubTypes = ['Whitehat', 'Blackhat'] as const

const platformLogos: Record<string, string> = {
  Facebook: '/logos/facebook.svg',
  Tiktok: '/logos/tiktok.svg',
  Google: '/logos/google.svg',
  Bing: '/logos/bing.svg',
  Snapchat: '/logos/snapchat.svg',
}

function PlatformIcon({ name }: { name: string }) {
  const src = platformLogos[name]
  if (!src) return <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/10 shrink-0" />
  return <img src={src} alt={name} className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 rounded-sm" />
}

// Facebook plans (4 cards)
const fbPlans = [
  {
    name: 'Starter',
    price: 30,
    blackhatPrice: 50,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: false,
    highlighted: false,
    features: [
      'Invoice Ad Account',
      'Unlimited Domains',
      '5 Pages',
      '1 Free Replacement',
    ],
    bonuses: [
      { text: 'Meta Rep 24/7 access', value: '$1,000' },
      { text: 'Bulletproof Meta Asset Setup PDF', value: '$500' },
      { text: 'Premium Partner Software Bundle', value: '$1,136' },
    ],
    coreFeatures: [
      'Platinum HIVA Accounts',
      'No Bans & Restrictions',
      'Ad Account Issued in 5 Minutes',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
      '24/7 Customer Support',
    ],
  },
  {
    name: 'Pro',
    price: 50,
    blackhatPrice: 80,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: 'Most Popular',
    bestValue: false,
    highlighted: true,
    features: [
      'Invoice Ad Account',
      'Unlimited Domains',
      '5 Pages',
      '2 Free Replacements',
    ],
    bonuses: [
      { text: 'Meta Rep 24/7 access', value: '$1,000' },
      { text: 'Bulletproof Meta Asset Setup PDF', value: '$500' },
      { text: 'Premium Partner Software Bundle', value: '$1,136' },
    ],
    coreFeatures: [
      'Platinum HIVA Accounts',
      'No Bans & Restrictions',
      'Ad Account Issued in 5 Minutes',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
      '24/7 Customer Support',
    ],
  },
  {
    name: 'Business',
    price: 30,
    blackhatPrice: 50,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: false,
    highlighted: false,
    features: [
      'Invoice Ad Account',
      'Unlimited Domains',
      'Unlimited Pages',
      'No Free Replacement',
    ],
    bonuses: [
      { text: 'Meta Rep 24/7 access', value: '$1,000' },
      { text: 'Bulletproof Meta Asset Setup PDF', value: '$500' },
      { text: 'Dedicated Account Manager', value: '$500' },
      { text: 'Premium Partner Software Bundle', value: '$1,136' },
    ],
    coreFeatures: [
      'Platinum HIVA Accounts',
      'No Bans & Restrictions',
      'Ad Account Issued in 5 Minutes',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
      '24/7 Customer Support',
    ],
  },
  {
    name: 'Enterprise',
    price: 50,
    blackhatPrice: 80,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: true,
    highlighted: false,
    features: [
      'Invoice Ad Account',
      'Unlimited Domains',
      'Unlimited Pages',
      '1 Free Replacement',
    ],
    bonuses: [
      { text: 'Meta Rep 24/7 access', value: '$1,000' },
      { text: 'Bulletproof Meta Asset Setup PDF', value: '$500' },
      { text: 'Dedicated Account Manager', value: '$500' },
      { text: 'Premium Partner Software Bundle', value: '$1,136' },
    ],
    coreFeatures: [
      'Platinum HIVA Accounts',
      'No Bans & Restrictions',
      'Ad Account Issued in 5 Minutes',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
      '24/7 Customer Support',
    ],
  },
]

// TikTok plans (3 cards — Gold / Platinum / Diamond)
const tiktokPlans = [
  {
    name: 'Gold',
    price: 30,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: false,
    highlighted: false,
    features: [
      '4% Ad Spend Fee',
      'Up to $6k/month in spend',
      'Top-up with Crypto/Bank transfer',
    ],
    bonuses: [
      { text: 'TikTok Rep 24/7 access', value: '$1,000' },
      { text: 'Premium Partner Software Bundle', value: '$1,136' },
    ],
    coreFeatures: [
      'No Bans or Restrictions',
      'Unlimited Number of Ad Accounts',
      'Ad Account Issued in Less Than 24h',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
    ],
  },
  {
    name: 'Platinum',
    price: 50,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: true,
    highlighted: true,
    features: [
      '3% Ad Spend Fee',
      'Unlimited Daily Spend',
      'Top-up with Crypto/Bank transfer',
    ],
    bonuses: [
      { text: 'TikTok Rep 24/7 access', value: '$1,000' },
      { text: 'TikTok Ad Asset Setup Guide', value: '$500' },
      { text: 'Dedicated Account Manager', value: '$500' },
      { text: 'All-Inclusive Partner Tool Bundle', value: '$1,286' },
    ],
    coreFeatures: [
      'Includes Cashback + Extra Bonuses',
      'No Bans or Restrictions',
      'Unlimited Number of Ad Accounts',
      'Ad Account Issued in Less Than 24h',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
    ],
  },
  {
    name: 'Diamond',
    price: 80,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: false,
    highlighted: false,
    features: [
      '2.5% Ad Spend Fee',
      'Unlimited Daily Spend',
      'Top-up with Crypto/Bank transfer',
    ],
    bonuses: [
      { text: 'TikTok Rep 24/7 access', value: '$1,000' },
      { text: 'Premium Partner Software Bundle', value: '$1,136' },
    ],
    coreFeatures: [
      'No Bans or Restrictions',
      'Unlimited Number of Ad Accounts',
      'Ad Account Issued in Less Than 24h',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
    ],
  },
]

// Google plans (same structure as TikTok, Google branding)
const googlePlans = [
  {
    name: 'Gold',
    price: 30,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: false,
    highlighted: false,
    features: [
      '4% Ad Spend Fee',
      'Up to $6k/month in spend',
      'Top-up with Crypto/Bank transfer',
    ],
    bonuses: [
      { text: 'Google Rep 24/7 access', value: '$1,000' },
      { text: 'Premium Partner Software Bundle', value: '$1,136' },
    ],
    coreFeatures: [
      'No Bans or Restrictions',
      'Unlimited Number of Ad Accounts',
      'Ad Account Issued in Less Than 24h',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
    ],
  },
  {
    name: 'Platinum',
    price: 50,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: true,
    highlighted: true,
    features: [
      '3% Ad Spend Fee',
      'Unlimited Daily Spend',
      'Top-up with Crypto/Bank transfer',
    ],
    bonuses: [
      { text: 'Google Rep 24/7 access', value: '$1,000' },
      { text: 'Google Ad Asset Setup Guide', value: '$500' },
      { text: 'Dedicated Account Manager', value: '$500' },
      { text: 'All-Inclusive Partner Tool Bundle', value: '$1,286' },
    ],
    coreFeatures: [
      'Includes Cashback + Extra Bonuses',
      'No Bans or Restrictions',
      'Unlimited Number of Ad Accounts',
      'Ad Account Issued in Less Than 24h',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
    ],
  },
  {
    name: 'Diamond',
    price: 80,
    priceLabel: 'ONE-TIME OPENING FEE',
    badge: null,
    bestValue: false,
    highlighted: false,
    features: [
      '2.5% Ad Spend Fee',
      'Unlimited Daily Spend',
      'Top-up with Crypto/Bank transfer',
    ],
    bonuses: [
      { text: 'Google Rep 24/7 access', value: '$1,000' },
      { text: 'Premium Partner Software Bundle', value: '$1,136' },
    ],
    coreFeatures: [
      'No Bans or Restrictions',
      'Unlimited Number of Ad Accounts',
      'Ad Account Issued in Less Than 24h',
      'Up to 50% Lower CPAs',
      '8x Higher Ad Approval Rates',
    ],
  },
]

// Bing — single plan card
const bingPlan = {
  price: 30,
  priceLabel: 'ONE-TIME OPENING FEE',
  spendFee: '4% of Ad Spend',
  features: [
    '4% of Ad Spend',
    'Unlimited Daily Spend',
    'No Bans or Restrictions',
    'Unlimited Number of Ad Accounts',
    'Up to 50% Lower CPAs',
    '8x Higher Ad Approval Rates',
    'Top-Up with Crypto / Bank Transfer',
  ],
  bonuses: [
    { text: 'Premium Partner Software Bundle', value: '$1,136' },
  ],
}

// Snapchat — single plan card
const snapchatPlan = {
  price: 30,
  priceLabel: 'ONE-TIME OPENING FEE',
  spendFee: '4% of Ad Spend',
  features: [
    '4% of Ad Spend',
    'Unlimited Daily Spend',
    'No Bans or Restrictions',
    'Unlimited Number of Ad Accounts',
    'Up to 50% Lower CPAs',
    '8x Higher Ad Approval Rates',
    'Top-Up with Crypto / Bank Transfer',
  ],
  bonuses: [
    { text: 'Premium Partner Software Bundle', value: '$1,136' },
  ],
}

function CheckIcon({ color = 'blue' }: { color?: 'blue' | 'cyan' }) {
  return (
    <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 shrink-0 ${color === 'cyan' ? 'text-cyan-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3L12.5 5" />
    </svg>
  )
}

export default function PricingSection() {
  const [activePlatform, setActivePlatform] = useState('Facebook')
  const [fbSub, setFbSub] = useState<'Whitehat' | 'Blackhat'>('Whitehat')
  const heading = useScrollReveal()
  const cardsReveal = useScrollReveal()
  const bottom = useScrollReveal()
  const priceScrollRef = useRef<HTMLDivElement>(null)

  const scrollPriceBy = (dir: 'left' | 'right') => {
    if (!priceScrollRef.current) return
    const amount = 200
    priceScrollRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  const isFb = activePlatform === 'Facebook'
  const isTiktok = activePlatform === 'Tiktok'

  const isGoogle = activePlatform === 'Google'
  const isBing = activePlatform === 'Bing'
  const isSnapchat = activePlatform === 'Snapchat'
  const isSingleCard = isBing || isSnapchat

  // Select the right plan set based on platform
  const activePlans = isTiktok ? tiktokPlans : isGoogle ? googlePlans : fbPlans

  // Get price for a plan based on active platform/sub
  const getPrice = (plan: typeof fbPlans[0] | typeof tiktokPlans[0]) => {
    if (isFb && fbSub === 'Blackhat' && 'blackhatPrice' in plan) return (plan as typeof fbPlans[0]).blackhatPrice
    return plan.price
  }

  // Apple bubble sliding indicator
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLElement | null>>({})
  const [bubble, setBubble] = useState({ left: 0, width: 0, ready: false })

  useEffect(() => {
    // Small delay so DOM has updated (for Whitehat/Blackhat appearing/disappearing)
    const timer = setTimeout(() => {
      const container = containerRef.current
      // For Facebook, measure the whole fb-group wrapper; for others, measure the button
      const activeEl = activePlatform === 'Facebook'
        ? tabRefs.current['fb-group']
        : tabRefs.current[activePlatform]
      if (!container || !activeEl) return
      const cRect = container.getBoundingClientRect()
      const tRect = activeEl.getBoundingClientRect()
      setBubble({
        left: tRect.left - cRect.left,
        width: tRect.width,
        ready: true,
      })
    }, 20)

    const update = () => {
      const container = containerRef.current
      const activeEl = activePlatform === 'Facebook'
        ? tabRefs.current['fb-group']
        : tabRefs.current[activePlatform]
      if (!container || !activeEl) return
      const cRect = container.getBoundingClientRect()
      const tRect = activeEl.getBoundingClientRect()
      setBubble({
        left: tRect.left - cRect.left,
        width: tRect.width,
        ready: true,
      })
    }
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', update)
    }
  }, [activePlatform, fbSub])

  return (
    <section id="pricing" className="relative pt-6 sm:pt-16 pb-6 sm:pb-14 overflow-hidden">
      {/* BG */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-blue-600/[0.03] rounded-full blur-[200px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-600/[0.02] rounded-full blur-[150px]" />
        {/* Radar sweep */}
        <div className="absolute top-[30%] left-1/2 w-[700px] h-[700px] pricing-radar opacity-[0.12]">
          <div className="absolute top-1/2 left-1/2 w-1/2 h-[2px] origin-left bg-gradient-to-r from-blue-400/80 to-transparent" style={{transform: 'translateY(-50%)'}} />
        </div>
        {/* Ripple rings */}
        {[0, 1.2, 2.4].map((delay, i) => (
          <div key={i} className="pricing-ripple absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] rounded-full border-2 border-blue-400/15" style={{animationDelay: `${delay}s`}} />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div
          ref={heading.ref}
          className={`text-center mb-5 sm:mb-14 transition-all duration-700 ${heading.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-red-500/[0.08] border border-red-500/15 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 mb-2 sm:mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-400 text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.15em]">Limited Spots Available</span>
          </div>
          <h2 className="text-lg sm:text-3xl md:text-4xl lg:text-[44px] font-bold text-white leading-tight mb-1 sm:mb-4">
            Get Your Agency Account Today!
          </h2>
          <p className="text-[10px] sm:text-base max-w-2xl mx-auto leading-relaxed">
            <span className="text-red-400 font-semibold">Only 8/20 Spots left</span>
            <span className="text-gray-500"> | We only open access a few times per year to maintain the highest quality accounts & provide hands-on support.</span>
          </p>

          {/* Trust avatars */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 sm:mt-5">
            <div className="flex -space-x-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/20 border-2 border-[#0a0a1a] flex items-center justify-center">
                  <span className="text-[6px] sm:text-[8px] text-blue-300">👤</span>
                </div>
              ))}
            </div>
            <span className="text-gray-400 text-[10px] sm:text-xs">Trusted by <span className="text-white font-semibold">1,700+</span> Companies</span>
          </div>
        </div>

        {/* ===== MOBILE: D4 Neon Grid + Toggle Switch ===== */}
        <div className="sm:hidden mb-5 px-0">
          <div className="relative rounded-xl border border-white/[0.06] bg-[#060a18] p-1.5 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/10 to-transparent" />
            <div className="grid grid-cols-5 gap-0.5">
              {mainPlatforms.map(name => {
                const isActive = activePlatform === name
                return (
                  <button key={name} onClick={() => setActivePlatform(name)} className="relative flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all duration-300">
                    {isActive && <div className="absolute inset-0 rounded-lg overflow-hidden">
                      <div className="absolute inset-0 bg-blue-500/[0.08]" />
                      <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-blue-400/40" />
                    </div>}
                    <img src={platformLogos[name] || ''} alt={name} className="w-5 h-5 rounded-sm relative z-10" />
                    <span className={`text-[7px] font-bold relative z-10 ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>{name === 'Facebook' ? 'Meta' : name}</span>
                  </button>
                )
              })}
            </div>
            {/* Whitehat/Blackhat toggle — only for Facebook */}
            <div className={`grid transition-all duration-300 ${isFb ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="mt-1 pt-1.5 border-t border-white/[0.04]">
                  <div className="relative flex rounded-lg bg-white/[0.03] border border-white/[0.05] p-0.5">
                    <div className="absolute top-0.5 bottom-0.5 rounded-md bg-blue-500/15 border border-blue-400/25 transition-all duration-300" style={{ left: fbSub === 'Whitehat' ? '2px' : '50%', width: 'calc(50% - 4px)' }} />
                    {fbSubTypes.map(sub => (
                      <button key={sub} onClick={() => setFbSub(sub)} className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-bold transition-colors ${fbSub === sub ? 'text-white' : 'text-gray-500'}`}>
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== DESKTOP: Platform tabs — Apple bubble selector ===== */}
        <div className="hidden sm:flex justify-center mb-14">
          <div
            ref={containerRef}
            className="relative inline-flex items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-1.5 gap-0.5"
          >
            {/* Sliding bubble */}
            <div
              className="absolute top-1.5 bottom-1.5 rounded-xl pointer-events-none"
              style={{
                left: bubble.left,
                width: bubble.width,
                opacity: bubble.ready ? 1 : 0,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.08) 100%)',
                border: '1px solid rgba(59,130,246,0.2)',
                boxShadow: '0 0 20px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
                transition: 'left 0.4s cubic-bezier(0.32, 0.72, 0, 1), width 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            />

            {mainPlatforms.map((name) => (
              name === 'Facebook' ? (
                <div
                  key={name}
                  ref={(el) => { tabRefs.current['fb-group'] = el }}
                  className="relative z-10 flex items-center"
                >
                  <button
                    onClick={() => setActivePlatform('Facebook')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-300 whitespace-nowrap ${
                      isFb ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <PlatformIcon name="Facebook" />
                    <span>Facebook</span>
                  </button>
                  {isFb && fbSubTypes.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setFbSub(sub)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-colors duration-200 whitespace-nowrap animate-[fadeIn_0.25s_ease]"
                      style={{
                        color: fbSub === sub ? '#fff' : '#6b7280',
                        fontWeight: fbSub === sub ? 500 : 400,
                      }}
                    >
                      <div className={`w-2 h-2 rounded-full border transition-all duration-200 ${
                        fbSub === sub ? 'bg-blue-400 border-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.4)]' : 'border-gray-600 bg-transparent'
                      }`} />
                      <span>{sub}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  key={name}
                  ref={(el) => { tabRefs.current[name] = el }}
                  onClick={() => setActivePlatform(name)}
                  className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-300 whitespace-nowrap ${
                    activePlatform === name ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <PlatformIcon name={name} />
                  <span>{name}</span>
                </button>
              )
            ))}
          </div>
        </div>

        {/* Scroll reveal trigger for cards */}
        <div ref={cardsReveal.ref} />

        {/* Pricing cards */}
        {isSingleCard ? (() => {
          const singlePlan = isBing ? bingPlan : snapchatPlan
          return (
          <>
          {/* ===== MOBILE: Single Plan Card ===== */}
          <div
            className={`sm:hidden transition-all duration-700 delay-200 ${cardsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          >
            <div className="rounded-xl border border-blue-500/20 bg-[#060a18] overflow-hidden">
              <div className="h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-xs font-bold">{activePlatform}</span>
                  <span className="text-[7px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">Limited Spots</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-white text-xl font-bold">${singlePlan.price}</span>
                  <span className="text-gray-500 text-[8px]">{singlePlan.priceLabel}</span>
                  <span className="text-gray-400 text-[8px] bg-white/[0.06] px-1.5 py-0.5 rounded ml-1">+ {singlePlan.spendFee}</span>
                </div>
                <div className="space-y-1.5 mb-3 mt-3">
                  {singlePlan.features.map((f: string, j: number) => (
                    <div key={j} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 12 12" className="w-2 h-2 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M3 6l2.5 2.5L9 4"/></svg>
                      </div>
                      <span className="text-gray-300 text-[9px]">{f}</span>
                    </div>
                  ))}
                </div>
                {/* Bonuses */}
                <div className="rounded-lg bg-blue-500/[0.06] border border-blue-500/10 p-2.5 mb-3">
                  <p className="text-[8px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Bonuses:</p>
                  {singlePlan.bonuses.map((b: { text: string; value: string }, j: number) => (
                    <div key={j} className="flex items-center gap-1.5 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 12 12" className="w-1.5 h-1.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M3 6l2.5 2.5L9 4"/></svg>
                      </div>
                      <span className="text-gray-400 text-[8px]">{b.text} <span className="text-cyan-400 font-bold">({b.value})</span></span>
                    </div>
                  ))}
                </div>
                <a href="#contact" className="block text-center py-2 rounded-lg text-[10px] font-bold bg-blue-500/20 text-white border border-blue-500/30">
                  Check Availability →
                </a>
              </div>
            </div>
          </div>

          {/* ===== DESKTOP: Single Plan Card ===== */}
          <div
            className={`hidden sm:block max-w-3xl mx-auto transition-all duration-700 delay-200 ${cardsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
          >
            <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#0c0c20]">
              <div className="relative px-7 sm:px-10 pt-8 pb-7" style={{ background: 'linear-gradient(135deg, #1a1145 0%, #0f1a3a 50%, #0c1530 100%)' }}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-[60px] font-black text-white leading-none">${singlePlan.price}</span>
                      <span className="text-gray-400 text-[11px] font-medium tracking-wide">{singlePlan.priceLabel}</span>
                      <span className="bg-white/[0.08] border border-white/[0.12] text-gray-200 text-[12px] font-medium px-3 py-1 rounded-md">+ {singlePlan.spendFee}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <div className="w-[7px] h-[7px] rounded-full bg-blue-400" />
                      <span className="text-blue-300 text-[13px] font-medium">Limited Spots Available</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/[0.05] border border-white/[0.08] px-5 py-4 sm:max-w-[260px]">
                    <p className="text-[13px] text-gray-300 leading-[1.6]">
                      <span className="text-white font-bold">Lock-In Guarantee:</span> Stay on legacy pricing and save <span className="text-white font-bold">$200–$400</span> as we raise rates for new clients.
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-10 pt-6 pb-5 border-b border-white/[0.06]">
                <a href="#contact" className="flex items-center justify-center gap-2 w-full py-3.5 rounded-lg bg-blue-500/15 border border-blue-400/20 text-white text-[14px] font-semibold hover:bg-blue-500/25 transition-all duration-300">
                  Check Availability
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                </a>
                <div className="flex items-center justify-center gap-2 mt-4">
                  {['Visa', 'MC', 'Amex', 'Pay', 'Crypto', '₿'].map((icon, j) => (
                    <div key={j} className="w-10 h-6 rounded bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <span className="text-[7px] text-gray-500 font-bold">{icon}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-10 py-7 border-b border-white/[0.06]">
                <div className="space-y-4">
                  {singlePlan.features.map((f: string, j: number) => (
                    <div key={j} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded bg-blue-500/15 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3L12.5 5" /></svg>
                      </div>
                      <span className="text-white text-[15px]">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-10 py-6">
                <div className="rounded-xl px-5 py-5 bg-gradient-to-r from-blue-600/[0.08] to-cyan-600/[0.05] border border-blue-500/[0.12]">
                  <p className="text-[12px] text-gray-400 font-medium mb-3">Bonuses Include:</p>
                  <div className="space-y-3">
                    {singlePlan.bonuses.map((b: { text: string; value: string }, j: number) => (
                      <div key={j} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3L12.5 5" /></svg>
                        </div>
                        <span className="text-gray-200 text-[14px]">
                          {b.text} <span className="text-cyan-400 font-semibold">({b.value} value)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
          )
        })() : (
        <>
        {/* ===== MOBILE: Horizontal Scroll Cards with Arrows ===== */}
        <div className={`sm:hidden transition-all duration-700 delay-200 ${cardsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div
            ref={priceScrollRef}
            className="overflow-x-auto scrollbar-hide -mx-4 px-4 snap-x snap-mandatory"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-2.5 pb-2" style={{ width: 'max-content' }}>
              {activePlans.map((plan, i) => (
                <div key={i} className={`w-[200px] flex-shrink-0 rounded-xl border overflow-hidden snap-start ${plan.highlighted ? 'border-blue-500/30 bg-blue-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                  {plan.highlighted && <div className="h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-xs font-bold">{plan.name}</span>
                      {plan.badge && <span className="text-[7px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{plan.badge}</span>}
                      {plan.bestValue && <span className="text-[7px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Best Value</span>}
                    </div>
                    <div className="flex items-baseline gap-0.5 mb-3">
                      <span className="text-white text-xl font-bold">${getPrice(plan)}</span>
                      <span className="text-gray-500 text-[8px]">{plan.priceLabel}</span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {plan.features.map((f: string, j: number) => (
                        <div key={j} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 12 12" className="w-2 h-2 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M3 6l2.5 2.5L9 4"/></svg>
                          </div>
                          <span className="text-gray-400 text-[9px]">{f}</span>
                        </div>
                      ))}
                    </div>
                    <a href="#contact" className={`block text-center py-2 rounded-lg text-[10px] font-bold ${plan.highlighted ? 'bg-blue-500/20 text-white border border-blue-500/30' : 'bg-white/[0.04] text-gray-300 border border-white/[0.06]'}`}>
                      Get Started →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Arrow buttons */}
          <div className="flex justify-center gap-3 mt-2">
            <button onClick={() => scrollPriceBy('left')} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center active:scale-90 transition-transform">
              <ChevronLeft className="w-4 h-4 text-white/70" />
            </button>
            <button onClick={() => scrollPriceBy('right')} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center active:scale-90 transition-transform">
              <ChevronRight className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* ===== DESKTOP: Grid Cards ===== */}
        <div
          className={`hidden sm:grid sm:grid-cols-2 ${activePlans.length === 3 ? 'lg:grid-cols-3 max-w-5xl mx-auto' : 'lg:grid-cols-4'} gap-4 sm:gap-5 transition-all duration-700 delay-200 ${cardsReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          {activePlans.map((plan, i) => (
            <div
              key={i}
              className="relative group"
              style={{
                opacity: cardsReveal.visible ? 1 : 0,
                transform: cardsReveal.visible ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 100}ms, transform 0.5s ease ${i * 100}ms`,
              }}
            >
              {/* Badge above card */}
              {(plan.badge || plan.bestValue) && (
                <div className="flex items-center justify-center gap-2 mb-2">
                  {plan.badge && (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      {plan.badge}
                    </span>
                  )}
                  {plan.bestValue && (
                    <span className="inline-flex items-center bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full">
                      Best Value
                    </span>
                  )}
                </div>
              )}
              {/* No badge spacer */}
              {!plan.badge && !plan.bestValue && <div className="h-[26px] mb-2" />}

              {/* Card */}
              <div
                className={`relative rounded-2xl p-[1px] h-full ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-blue-500/40 via-cyan-500/20 to-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.1)]'
                    : 'bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-white/[0.02]'
                }`}
              >
                <div className={`rounded-2xl h-full p-5 sm:p-6 flex flex-col ${
                  plan.highlighted ? 'bg-[#060618]/95' : 'bg-[#0a0a1e]/95'
                }`}>

                  {/* Plan name & price */}
                  <div className="mb-5">
                    <h3 className={`text-lg font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-200'}`}>
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-white transition-all duration-300">
                        ${getPrice(plan)}
                      </span>
                      <span className="text-gray-500 text-[10px] font-medium">{plan.priceLabel}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <a
                    href="#contact"
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 mb-5 ${
                      plan.highlighted
                        ? 'bg-blue-500/15 backdrop-blur-sm border border-blue-400/25 text-white hover:bg-blue-500/25 hover:border-blue-400/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                        : 'bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] text-gray-300 hover:bg-white/[0.08] hover:border-white/15'
                    }`}
                  >
                    Get Started
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                  </a>

                  {/* Plan features */}
                  <div className={`rounded-xl p-4 mb-4 ${
                    plan.highlighted
                      ? 'bg-gradient-to-br from-blue-500/[0.08] to-cyan-500/[0.04] border border-blue-500/10'
                      : 'bg-white/[0.02] border border-white/[0.04]'
                  }`}>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-3">What you get:</p>
                    <ul className="space-y-2.5">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <CheckIcon color={plan.highlighted ? 'cyan' : 'blue'} />
                          <span className="text-gray-300 text-xs leading-relaxed">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bonuses */}
                  <div className={`rounded-xl p-4 mb-4 ${
                    plan.highlighted
                      ? 'bg-gradient-to-br from-cyan-500/[0.06] to-blue-500/[0.03] border border-cyan-500/10'
                      : 'bg-white/[0.015] border border-white/[0.04]'
                  }`}>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-3">Bonuses Include:</p>
                    <ul className="space-y-2">
                      {plan.bonuses.map((b, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <CheckIcon color={plan.highlighted ? 'cyan' : 'blue'} />
                          <span className="text-gray-300 text-[11px] leading-relaxed">
                            {b.text}{' '}
                            <span className={`font-bold ${plan.highlighted ? 'text-cyan-400' : 'text-blue-400'}`}>({b.value} value)</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Core features */}
                  <div className="mt-auto">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-3">Core features:</p>
                    <ul className="space-y-2.5">
                      {plan.coreFeatures.map((f, j) => (
                        <li key={j} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${plan.highlighted ? 'bg-cyan-400/60' : 'bg-blue-400/40'}`} />
                          <span className="text-gray-400 text-xs leading-relaxed">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
        )}

        {/* Bottom bar */}
        <div
          ref={bottom.ref}
          className={`transition-all duration-700 delay-300 ${bottom.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* CTA bar */}
          <div className="mt-6 sm:mt-20 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/[0.06] px-3 sm:px-6 py-2.5 sm:py-4">
            <p className="text-gray-400 text-[10px] sm:text-sm text-center sm:text-left">
              Not sure where to start? <span className="text-white font-semibold">Speak to one of our experts</span>
            </p>
            <a
              href="#contact"
              className="inline-flex items-center gap-1.5 bg-blue-500/15 border border-blue-400/20 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full text-[10px] sm:text-sm font-semibold text-white transition-all duration-300"
            >
              Telegram
              <svg viewBox="0 0 16 16" className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
            </a>
          </div>

          {/* Trust badges */}
          <div className="mt-3 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-10">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-gray-500 text-xs sm:text-lg">✓</span>
              <span className="text-gray-400 text-[9px] sm:text-sm">No long-term commitments</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-gray-500 text-xs sm:text-lg">✓</span>
              <span className="text-gray-400 text-[9px] sm:text-sm">Cancel at any time</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-red-400 text-[8px] sm:text-sm">●</span>
              <span className="text-gray-400 text-[9px] sm:text-sm">Limited Spots Available</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
