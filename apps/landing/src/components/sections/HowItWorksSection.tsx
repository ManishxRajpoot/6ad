'use client'

import { useState, useEffect, useRef } from 'react'
import { useScrollReveal } from '../shared/useScrollReveal'
import { User, CreditCard, Rocket, ChevronRight } from 'lucide-react'

const steps = [
  {
    num: 1,
    boldTitle: 'Submit Your Business Info',
    desc: "Tell us about your website and business so we can assess if you're the right fit for our premium ad accounts.",
    icon: User,
    cardTitle: 'Submit Business Info',
    cardDesc: 'Tell us about your website and business so we can assess',
  },
  {
    num: 2,
    boldTitle: 'Fund Your Account Easily',
    desc: 'Once approved, your agency account is delivered within 24 hours. Fund via card, crypto, or direct bank transfer.',
    icon: CreditCard,
    cardTitle: 'Fund Your Account',
    cardDesc: 'Choose from card, crypto, or bank transfer to fund instantly',
  },
  {
    num: 3,
    boldTitle: 'Launch Ads with Confidence',
    desc: 'Start running ads immediately—with stable accounts designed for scale and full ban protection.',
    icon: Rocket,
    cardTitle: 'Launch Your Ads',
    cardDesc: 'Run campaigns on stable, ban-resistant agency accounts',
  },
]

// Mini illustrations for mobile accordion
function HiwMobileIllustration({ step }: { step: number }) {
  if (step === 0) return (
    <div className="bg-[#0d1225]/90 rounded-lg border border-white/[0.08] overflow-hidden select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400/60" /><div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" /><div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" /></div>
        <span className="text-[7px] text-gray-500">New Application</span>
        <div className="flex items-center gap-0.5"><div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" /><span className="text-[6px] text-blue-400/70">Draft</span></div>
      </div>
      <div className="p-2 space-y-1.5">
        {[{ l: 'Company Name', v: 'Acme Digital Ltd', d: true }, { l: 'Website', v: 'acmedigital.com', d: true }, { l: 'Platform', v: 'Meta (Facebook)', d: false }, { l: 'Budget', v: '$10,000 - $25,000', d: false }].map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-white/[0.03] rounded px-2 py-1.5 border-l-[1.5px]" style={{ borderColor: f.d ? '#3B82F6' : 'rgba(255,255,255,0.06)' }}>
            <div className="flex-1"><div className="text-[6px] text-blue-400/50 uppercase tracking-wider">{f.l}</div><div className="text-white/70 text-[8px] font-medium">{f.v}</div></div>
            {f.d && <div className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center"><svg viewBox="0 0 12 12" className="w-2 h-2 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6l2.5 2.5L9 4"/></svg></div>}
          </div>
        ))}
        <div className="bg-gradient-to-r from-blue-600/80 to-blue-500/80 rounded px-2 py-1.5 text-center"><span className="text-white text-[7px] font-semibold">Submit Application &rarr;</span></div>
      </div>
    </div>
  )
  if (step === 1) return (
    <div className="bg-[#0d1225]/90 rounded-lg border border-white/[0.08] overflow-hidden select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400/60" /><div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" /><div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" /></div>
        <span className="text-[7px] text-gray-500">Wallet</span>
        <div className="flex items-center gap-0.5"><div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[6px] text-emerald-400/70">Connected</span></div>
      </div>
      <div className="p-2 space-y-1.5">
        <div className="rounded-lg p-2.5" style={{ background: 'linear-gradient(135deg, #064e3b, #059669)' }}>
          <div className="text-emerald-200/60 text-[6px] uppercase tracking-wider mb-1">Available Balance</div>
          <div className="text-white text-lg font-bold">$12,450</div>
          <div className="flex items-center justify-between mt-1"><span className="text-emerald-200/40 text-[7px]">**** 4291</span><span className="text-emerald-200 text-[7px] bg-white/10 rounded-full px-1.5 py-0.5 font-semibold">+$2,500</span></div>
        </div>
        {[{ m: 'Visa ****8193', a: '+$5,000' }, { m: 'USDT (TRC20)', a: '+$3,500' }].map((tx, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-white/[0.03] rounded px-2 py-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500/10 flex items-center justify-center"><svg viewBox="0 0 10 10" className="w-2 h-2 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 5l2 2 4-4"/></svg></div>
            <span className="text-[8px] text-gray-400 flex-1">{tx.m}</span><span className="text-emerald-400 text-[8px] font-semibold">{tx.a}</span>
          </div>
        ))}
        <div className="bg-gradient-to-r from-emerald-600/80 to-teal-500/80 rounded px-2 py-1.5 text-center"><span className="text-white text-[7px] font-semibold">Add Funds +</span></div>
      </div>
    </div>
  )
  return (
    <div className="bg-[#0d1225]/90 rounded-lg border border-white/[0.08] overflow-hidden select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400/60" /><div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" /><div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" /></div>
        <span className="text-[7px] text-gray-500">Dashboard</span>
        <div className="flex items-center gap-0.5"><div className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" /><span className="text-[6px] text-purple-400/70">Live</span></div>
      </div>
      <div className="p-2 space-y-1.5">
        <div className="grid grid-cols-3 gap-1">
          {[{ l: 'Spend', v: '$8,240', c: 'text-blue-400' }, { l: 'ROAS', v: '4.2x', c: 'text-emerald-400' }, { l: 'Conv.', v: '1,847', c: 'text-purple-400' }].map((s, i) => (
            <div key={i} className="bg-white/[0.03] rounded p-1.5 text-center"><div className="text-[6px] text-gray-500">{s.l}</div><div className={`text-[10px] font-bold ${s.c}`}>{s.v}</div></div>
          ))}
        </div>
        <div className="bg-white/[0.02] rounded p-2">
          <div className="flex items-end gap-[3px] h-[30px] justify-center">
            {[40, 55, 35, 70, 60, 85, 75, 90, 80, 95].map((h, i) => (
              <div key={i} className="w-[8px] rounded-t" style={{ height: `${h}%`, background: 'linear-gradient(to top, #8B5CF6, #3B82F6)', opacity: 0.6 + i * 0.04 }} />
            ))}
          </div>
        </div>
        {[{ n: 'Summer Sale', s: '$3,400' }, { n: 'Retargeting', s: '$2,100' }].map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-white/[0.03] rounded px-2 py-1.5">
            <div className="flex-1"><div className="text-white/70 text-[8px] font-medium">{c.n}</div><div className="text-emerald-400 text-[6px]">● Active</div></div>
            <span className="text-purple-400 text-[8px] font-semibold">{c.s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HowItWorksSection() {
  const heading = useScrollReveal()
  const [activeStep, setActiveStep] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const activeStepRef = useRef(0)
  const lockedRef = useRef(false)        // currently locked on screen
  const cooldownRef = useRef(false)
  const completedDownRef = useRef(false) // completed scrolling down (past step 3)
  const completedUpRef = useRef(false)   // completed scrolling up (past step 1)
  const snapPendingRef = useRef(false)

  useEffect(() => { activeStepRef.current = activeStep }, [activeStep])

  const ActiveIcon = steps[activeStep].icon

  // Detect section entering viewport — snap & lock (DESKTOP ONLY)
  useEffect(() => {
    const isMobile = window.innerWidth < 1024
    if (isMobile) return // No scroll hijacking on mobile

    const el = sectionRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !lockedRef.current && !snapPendingRef.current) {
          const rect = entry.boundingClientRect
          const comingFromBelow = rect.top > 0
          const comingFromAbove = rect.bottom < window.innerHeight

          const headerOffset = 80
          const snapTo = () => {
            const elTop = el.getBoundingClientRect().top + window.scrollY
            window.scrollTo({ top: elTop - headerOffset, behavior: 'smooth' })
          }

          if (comingFromBelow && !completedDownRef.current) {
            snapPendingRef.current = true
            setActiveStep(0)
            activeStepRef.current = 0
            snapTo()
            setTimeout(() => {
              lockedRef.current = true
              snapPendingRef.current = false
            }, 500)
          } else if (comingFromAbove && !completedUpRef.current) {
            snapPendingRef.current = true
            setActiveStep(steps.length - 1)
            activeStepRef.current = steps.length - 1
            snapTo()
            setTimeout(() => {
              lockedRef.current = true
              snapPendingRef.current = false
            }, 500)
          }
        }

        if (!entry.isIntersecting) {
          lockedRef.current = false
          const rect = entry.boundingClientRect
          if (rect.top > window.innerHeight * 0.5) {
            completedDownRef.current = false
            completedUpRef.current = false
          } else if (rect.bottom < 0) {
            completedDownRef.current = false
            completedUpRef.current = false
          }
        }
      },
      { threshold: [0.15] }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Scroll hijack — DESKTOP ONLY
  useEffect(() => {
    const isMobile = window.innerWidth < 1024
    if (isMobile) return // No scroll hijacking on mobile

    const handleWheel = (e: WheelEvent) => {
      if (snapPendingRef.current) { e.preventDefault(); return }
      if (!lockedRef.current) return
      if (cooldownRef.current) { e.preventDefault(); return }

      e.preventDefault()

      const current = activeStepRef.current

      if (e.deltaY > 0) {
        if (current < steps.length - 1) {
          cooldownRef.current = true
          const next = current + 1
          activeStepRef.current = next
          setActiveStep(next)
          setTimeout(() => { cooldownRef.current = false }, 800)
        } else {
          lockedRef.current = false
          completedDownRef.current = true
        }
      } else if (e.deltaY < 0) {
        if (current > 0) {
          cooldownRef.current = true
          const prev = current - 1
          activeStepRef.current = prev
          setActiveStep(prev)
          setTimeout(() => { cooldownRef.current = false }, 800)
        } else {
          lockedRef.current = false
          completedUpRef.current = true
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return (
    <section ref={sectionRef} id="process" className="relative py-10 sm:py-14 overflow-hidden">
      {/* BG glow + circuit animation */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/[0.06] rounded-full blur-[180px]" />
        {/* Vertical circuit lines on edges + corner nodes */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Left edge vertical lines */}
          <line x1="3%" y1="5%" x2="3%" y2="95%" stroke="#3B82F6" strokeWidth="1.5" className="hiw-circuit" opacity="0.2" />
          <line x1="5%" y1="10%" x2="5%" y2="90%" stroke="#06B6D4" strokeWidth="1" className="hiw-circuit" opacity="0.12" style={{animationDelay: '3s'}} />
          {/* Right edge vertical lines */}
          <line x1="97%" y1="5%" x2="97%" y2="95%" stroke="#3B82F6" strokeWidth="1.5" className="hiw-circuit" opacity="0.2" style={{animationDelay: '5s'}} />
          <line x1="95%" y1="10%" x2="95%" y2="90%" stroke="#06B6D4" strokeWidth="1" className="hiw-circuit" opacity="0.12" style={{animationDelay: '7s'}} />
          {/* Corner nodes */}
          <circle cx="3%" cy="15%" className="hiw-node" fill="#3B82F6" r="3" opacity="0.5" />
          <circle cx="3%" cy="50%" className="hiw-node" fill="#06B6D4" r="3" opacity="0.4" style={{animationDelay: '1s'}} />
          <circle cx="3%" cy="85%" className="hiw-node" fill="#3B82F6" r="3" opacity="0.5" style={{animationDelay: '2s'}} />
          <circle cx="97%" cy="15%" className="hiw-node" fill="#3B82F6" r="3" opacity="0.5" style={{animationDelay: '1.5s'}} />
          <circle cx="97%" cy="50%" className="hiw-node" fill="#06B6D4" r="3" opacity="0.4" style={{animationDelay: '2.5s'}} />
          <circle cx="97%" cy="85%" className="hiw-node" fill="#3B82F6" r="3" opacity="0.5" style={{animationDelay: '0.5s'}} />
          {/* Horizontal connecting lines at corners only */}
          <line x1="3%" y1="15%" x2="12%" y2="15%" stroke="#3B82F6" strokeWidth="1" className="hiw-circuit" opacity="0.1" style={{animationDelay: '2s'}} />
          <line x1="88%" y1="15%" x2="97%" y2="15%" stroke="#3B82F6" strokeWidth="1" className="hiw-circuit" opacity="0.1" style={{animationDelay: '4s'}} />
          <line x1="3%" y1="85%" x2="12%" y2="85%" stroke="#3B82F6" strokeWidth="1" className="hiw-circuit" opacity="0.1" style={{animationDelay: '6s'}} />
          <line x1="88%" y1="85%" x2="97%" y2="85%" stroke="#3B82F6" strokeWidth="1" className="hiw-circuit" opacity="0.1" style={{animationDelay: '8s'}} />
        </svg>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div
          ref={heading.ref}
          className={`text-center mb-5 sm:mb-14 transition-all duration-700 ${heading.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <span className="text-blue-400 text-[10px] sm:text-sm font-semibold uppercase tracking-[0.2em] mb-2 sm:mb-4 block">
            HOW IT WORKS
          </span>
          <h2 className="text-lg sm:text-3xl md:text-4xl lg:text-[42px] font-bold text-white leading-tight mb-1 sm:mb-4">
            Get your Agency Ad Accounts in 3 Simple Steps
          </h2>
          <p className="text-gray-500 text-xs sm:text-base max-w-xl mx-auto leading-relaxed">
            Getting started is fast, simple, and designed to keep your campaigns running smoothly—no stress, no bans.
          </p>
        </div>

        {/* ===== MOBILE: All steps expanded ===== */}
        <div className="lg:hidden space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon
            const colors = ['#3B82F6', '#10B981', '#8B5CF6']
            const color = colors[i]
            return (
              <div key={i} className="rounded-xl border border-white/[0.12] bg-white/[0.03] overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}20`, border: `1.5px solid ${color}40` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>{`Step ${step.num}`}</span>
                      <h3 className="text-xs font-bold text-white">{step.boldTitle}</h3>
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <p className="text-gray-500 text-[10px] leading-relaxed mb-2 pl-11">{step.desc}</p>
                  <HiwMobileIllustration step={i} />
                </div>
              </div>
            )
          })}
        </div>

        {/* ===== DESKTOP: Steps + Card ===== */}
        <div className="hidden lg:grid lg:grid-cols-[5fr_7fr] gap-8 lg:gap-10 items-center">
          {/* Left — Steps timeline */}
          <div className="relative">
            <div className="absolute left-[6px] top-0 bottom-0 w-[2px] bg-white/[0.04] rounded-full" />
            <div
              className="absolute left-[6px] top-0 w-[2px] bg-gradient-to-b from-blue-500 to-blue-400 rounded-full transition-all duration-500"
              style={{ height: `${((activeStep + 1) / steps.length) * 100}%` }}
            />

            <div className="space-y-8 sm:space-y-10">
              {steps.map((step, i) => (
                <div key={i} className="relative pl-10 sm:pl-12">
                  {/* Dot */}
                  <div className={`absolute left-0 top-1 w-[14px] h-[14px] rounded-full transition-all duration-500 border-2 ${
                    activeStep === i
                      ? 'bg-blue-400 border-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.6)] scale-110'
                      : activeStep > i
                        ? 'bg-blue-500/50 border-blue-500/50'
                        : 'bg-dark-800 border-white/10'
                  }`}>
                    {activeStep === i && (
                      <div className="absolute -inset-2 rounded-full border border-blue-400/20 animate-ping" style={{ animationDuration: '2.5s' }} />
                    )}
                  </div>

                  <div className={`transition-all duration-500 ${activeStep === i ? 'opacity-100' : 'opacity-40'}`}>
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                      <span className="text-gray-500 font-normal">Step {step.num}: </span>
                      <span className={activeStep === i ? 'text-white' : 'text-gray-300'}>{step.boldTitle}</span>
                    </h3>
                    <p className={`text-sm leading-relaxed max-w-md transition-colors duration-500 ${
                      activeStep === i ? 'text-gray-400' : 'text-gray-600'
                    }`}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Card (half screen) */}
          <div className="flex justify-center">
            <div className="w-full relative">
              <div className="rounded-2xl overflow-hidden bg-transparent">
                <div className="rounded-2xl overflow-hidden bg-[#0c0c20]/40 backdrop-blur-[20px]">
                  <div className={`h-[3px] transition-all duration-700 ${
                    activeStep === 0 ? 'bg-gradient-to-r from-blue-600/40 via-blue-500/60 to-cyan-500/40'
                    : activeStep === 1 ? 'bg-gradient-to-r from-emerald-600/40 via-green-500/60 to-teal-500/40'
                    : 'bg-gradient-to-r from-purple-600/40 via-violet-500/60 to-blue-500/40'
                  }`} />

                  <div className="p-4 sm:p-6 text-center relative min-h-[520px] select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                    {/* Step 1 — Professional Onboarding UI */}
                    <div className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center transition-all duration-500 ${
                      activeStep === 0 ? 'opacity-100 translate-y-0 scale-100' : activeStep > 0 ? 'opacity-0 -translate-y-4 scale-95 pointer-events-none' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                    }`}>
                      <div className="w-full max-w-[400px] mb-5">
                        {/* App window chrome */}
                        <div className="bg-[#0d1225]/90 rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-blue-900/20">
                          {/* Title bar */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                            </div>
                            <div className="text-[10px] text-gray-500 font-medium">New Application</div>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                              <span className="text-[9px] text-blue-400/70">Draft</span>
                            </div>
                          </div>
                          {/* Form content */}
                          <div className="p-4 space-y-2.5">
                            {/* Field 1 */}
                            <div className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3.5 py-2.5 border-l-2 border-blue-400">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <svg viewBox="0 0 20 20" className="w-4 h-4 text-blue-400" fill="currentColor"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm4 1a1 1 0 00-1 1v.01a1 1 0 001 1h4a1 1 0 001-1V6a1 1 0 00-1-1H8z"/></svg>
                              </div>
                              <div className="flex-1 text-left">
                                <div className="text-[9px] text-blue-400/50 uppercase tracking-wider font-medium">Company Name</div>
                                <div className="text-white/80 text-[13px] font-medium">Acme Digital Ltd</div>
                              </div>
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <svg viewBox="0 0 12 12" className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6l2.5 2.5L9 4"/></svg>
                              </div>
                            </div>
                            {/* Field 2 */}
                            <div className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3.5 py-2.5 border-l-2 border-blue-400/60">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <svg viewBox="0 0 20 20" className="w-4 h-4 text-blue-400/80" fill="currentColor"><path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4z" clipRule="evenodd"/></svg>
                              </div>
                              <div className="flex-1 text-left">
                                <div className="text-[9px] text-blue-400/50 uppercase tracking-wider font-medium">Website</div>
                                <div className="text-white/80 text-[13px] font-medium">acmedigital.com</div>
                              </div>
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <svg viewBox="0 0 12 12" className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6l2.5 2.5L9 4"/></svg>
                              </div>
                            </div>
                            {/* Field 3 */}
                            <div className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3.5 py-2.5 border-l-2 border-white/[0.06]">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <svg viewBox="0 0 20 20" className="w-4 h-4 text-blue-400/60" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-4 2a1 1 0 10-2 0v4a1 1 0 102 0V9zM7 12a1 1 0 10-2 0v1a1 1 0 102 0v-1z"/></svg>
                              </div>
                              <div className="flex-1 text-left">
                                <div className="text-[9px] text-blue-400/50 uppercase tracking-wider font-medium">Platform</div>
                                <div className="text-white/60 text-[13px]">Meta (Facebook & Instagram)</div>
                              </div>
                              <svg viewBox="0 0 12 12" className="w-3 h-3 text-gray-500"><path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            </div>
                            {/* Field 4 */}
                            <div className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3.5 py-2.5 border-l-2 border-white/[0.06]">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <svg viewBox="0 0 20 20" className="w-4 h-4 text-blue-400/60" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 5H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
                              </div>
                              <div className="flex-1 text-left">
                                <div className="text-[9px] text-blue-400/50 uppercase tracking-wider font-medium">Monthly Budget</div>
                                <div className="text-white/60 text-[13px]">$10,000 - $25,000</div>
                              </div>
                              <svg viewBox="0 0 12 12" className="w-3 h-3 text-gray-500"><path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            </div>
                            {/* Submit button */}
                            <div className="pt-1">
                              <div className="bg-gradient-to-r from-blue-600/80 to-blue-500/80 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                                <span className="text-white text-xs font-semibold tracking-wide">Submit Application</span>
                                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-white/80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        {steps.map((_, j) => (
                          <div key={j} className={`h-1 rounded-full transition-all duration-500 ${j === 0 ? 'w-6 bg-blue-400' : 'w-1.5 bg-white/10'}`} />
                        ))}
                      </div>
                      <h4 className="text-white font-semibold text-base mb-1">Submit & Get Onboarded</h4>
                      <p className="text-gray-500 text-xs leading-relaxed">Fill in your business details and get verified in minutes</p>
                    </div>

                    {/* Step 2 — Professional Wallet UI */}
                    <div className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center transition-all duration-500 ${
                      activeStep === 1 ? 'opacity-100 translate-y-0 scale-100' : activeStep > 1 ? 'opacity-0 -translate-y-4 scale-95 pointer-events-none' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                    }`}>
                      <div className="w-full max-w-[400px] mb-5">
                        <div className="bg-[#0d1225]/90 rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-emerald-900/20">
                          {/* Title bar */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                            </div>
                            <div className="text-[10px] text-gray-500 font-medium">Wallet</div>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-[9px] text-emerald-400/70">Connected</span>
                            </div>
                          </div>
                          {/* Wallet card */}
                          <div className="p-4 space-y-3">
                            <div className="relative rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 30%, #047857 60%, #059669 100%)' }}>
                              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                              <div className="relative px-5 py-4">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="text-emerald-200/60 text-[10px] uppercase tracking-widest font-medium">Available Balance</div>
                                  <img src="/logo-icon.svg" alt="" className="w-6 h-6 rounded-md opacity-60" />
                                </div>
                                <div className="text-white text-3xl font-bold tracking-tight mb-3">$12,450.00</div>
                                <div className="flex items-center justify-between">
                                  <div className="text-emerald-200/50 text-[10px] tracking-wider font-mono">**** **** **** 4291</div>
                                  <div className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-0.5">
                                    <svg viewBox="0 0 8 8" className="w-2 h-2 text-emerald-300" fill="currentColor"><path d="M4 1v6M4 1L2 3m2-2l2 2"/></svg>
                                    <span className="text-emerald-200 text-[9px] font-semibold">+$2,500</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Recent transactions */}
                            <div className="space-y-1.5">
                              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-medium px-1">Recent Deposits</div>
                              {[
                                { method: 'Visa ****8193', amount: '+$5,000', time: '2 min ago', color: 'text-blue-400' },
                                { method: 'USDT (TRC20)', amount: '+$3,500', time: '1 hour ago', color: 'text-orange-400' },
                                { method: 'Bank Transfer', amount: '+$3,950', time: '3 hours ago', color: 'text-gray-400' },
                              ].map((tx, i) => (
                                <div key={i} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3 py-2">
                                  <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 5l2 2 4-4"/></svg>
                                  </div>
                                  <div className="flex-1 text-left">
                                    <div className={`text-[11px] font-medium ${tx.color}`}>{tx.method}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-emerald-400 text-[11px] font-semibold">{tx.amount}</div>
                                    <div className="text-gray-600 text-[8px]">{tx.time}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Deposit button */}
                            <div className="bg-gradient-to-r from-emerald-600/80 to-teal-500/80 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                              <span className="text-white text-xs font-semibold tracking-wide">Add Funds</span>
                              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-white/80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        {steps.map((_, j) => (
                          <div key={j} className={`h-1 rounded-full transition-all duration-500 ${j === 1 ? 'w-6 bg-emerald-400' : 'w-1.5 bg-white/10'}`} />
                        ))}
                      </div>
                      <h4 className="text-white font-semibold text-base mb-1">Fund Your Account</h4>
                      <p className="text-gray-500 text-xs leading-relaxed">Card, crypto, or bank transfer — instant top-ups 24/7</p>
                    </div>

                    {/* Step 3 — Professional Analytics Dashboard */}
                    <div className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center transition-all duration-500 ${
                      activeStep === 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                    }`}>
                      <div className="w-full max-w-[400px] mb-5">
                        <div className="bg-[#0d1225]/90 rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-purple-900/20">
                          {/* Title bar */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                            </div>
                            <div className="text-[10px] text-gray-500 font-medium">Campaign Dashboard</div>
                            <div className="flex items-center gap-1 bg-emerald-500/15 rounded-full px-2 py-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-[9px] text-emerald-400 font-semibold">LIVE</span>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            {/* Metrics row */}
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: 'Impressions', value: '124.5K', trend: '+18%', color: 'purple' },
                                { label: 'Clicks', value: '8,947', trend: '+24%', color: 'purple' },
                                { label: 'Conv. Rate', value: '7.5%', trend: '+12%', color: 'emerald' },
                              ].map((m, i) => (
                                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5 text-center">
                                  <div className="text-gray-500 text-[8px] uppercase tracking-wider mb-1">{m.label}</div>
                                  <div className={`text-sm font-bold ${m.color === 'emerald' ? 'text-emerald-400' : 'text-white'}`}>{m.value}</div>
                                  <div className="flex items-center justify-center gap-0.5 mt-1">
                                    <svg viewBox="0 0 8 8" className="w-2 h-2 text-emerald-400" fill="currentColor"><path d="M4 1v6M4 1L2 3m2-2l2 2"/></svg>
                                    <span className="text-emerald-400 text-[8px] font-semibold">{m.trend}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Area chart */}
                            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-medium">Performance (7 days)</span>
                                <div className="flex items-center gap-1 bg-purple-500/10 rounded-full px-2 py-0.5">
                                  <span className="text-purple-400 text-[9px] font-bold">+23% ROI</span>
                                </div>
                              </div>
                              <svg viewBox="0 0 320 80" className="w-full h-[60px]" fill="none">
                                <defs>
                                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                                  </linearGradient>
                                </defs>
                                {/* Grid lines */}
                                <line x1="0" y1="20" x2="320" y2="20" stroke="white" strokeOpacity="0.03" />
                                <line x1="0" y1="40" x2="320" y2="40" stroke="white" strokeOpacity="0.03" />
                                <line x1="0" y1="60" x2="320" y2="60" stroke="white" strokeOpacity="0.03" />
                                {/* Area fill */}
                                <path d="M0 65 Q40 55 80 48 Q120 35 160 30 Q200 22 240 15 Q280 12 320 8 L320 80 L0 80Z" fill="url(#chartGrad)" />
                                {/* Line */}
                                <path d="M0 65 Q40 55 80 48 Q120 35 160 30 Q200 22 240 15 Q280 12 320 8" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
                                {/* Dots */}
                                <circle cx="80" cy="48" r="3" fill="#8B5CF6" />
                                <circle cx="160" cy="30" r="3" fill="#8B5CF6" />
                                <circle cx="240" cy="15" r="3" fill="#8B5CF6" />
                                <circle cx="320" cy="8" r="3.5" fill="#8B5CF6" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
                              </svg>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[8px] text-gray-600">Mon</span>
                                <span className="text-[8px] text-gray-600">Wed</span>
                                <span className="text-[8px] text-gray-600">Fri</span>
                                <span className="text-[8px] text-purple-400 font-semibold">Today</span>
                              </div>
                            </div>
                            {/* Revenue bar */}
                            <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/15 rounded-lg px-4 py-2.5">
                              <div className="flex-1">
                                <div className="text-[9px] text-purple-400/60 uppercase tracking-wider">Total Revenue</div>
                                <div className="text-white text-lg font-bold">$48,290</div>
                              </div>
                              <div className="bg-gradient-to-r from-purple-600/80 to-violet-500/80 rounded-lg px-3 py-1.5 shadow-lg shadow-purple-500/20">
                                <span className="text-white text-[10px] font-semibold">Scale Up</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-3">
                        {steps.map((_, j) => (
                          <div key={j} className={`h-1 rounded-full transition-all duration-500 ${j === 2 ? 'w-6 bg-purple-400' : 'w-1.5 bg-white/10'}`} />
                        ))}
                      </div>
                      <h4 className="text-white font-semibold text-base mb-1">Launch & Scale</h4>
                      <p className="text-gray-500 text-xs leading-relaxed">Run campaigns on ban-resistant accounts with no limits</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`absolute -inset-10 rounded-3xl blur-[60px] -z-10 transition-colors duration-700 ${
                activeStep === 0 ? 'bg-blue-600/[0.04]' : activeStep === 1 ? 'bg-emerald-600/[0.04]' : 'bg-purple-600/[0.04]'
              }`} />
            </div>
          </div>

          {/* Mobile card */}
          <div className="lg:hidden">
            <div className="w-full max-w-[380px] mx-auto">
              <div className="rounded-2xl p-[1px] bg-gradient-to-b from-white/[0.08] to-white/[0.02]">
                <div className="rounded-2xl overflow-hidden bg-[#0c0c20]/80 backdrop-blur-[20px] border border-white/[0.04]">
                  <div className="h-[4px] bg-gradient-to-r from-blue-600/40 via-blue-500/60 to-cyan-500/40" />
                  <div className="p-8 text-center">
                    <div className="relative w-16 h-16 mx-auto mb-5">
                      <div className="absolute inset-0 rounded-full border border-blue-500/20" />
                      <div className="absolute inset-2 rounded-full bg-blue-500/[0.08] flex items-center justify-center">
                        <ActiveIcon className="w-7 h-7 text-blue-400/70" strokeWidth={1.5} />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      {steps.map((_, i) => (
                        <div key={i} className={`h-1 rounded-full transition-all duration-400 ${activeStep === i ? 'w-6 bg-blue-400' : 'w-1.5 bg-white/10'}`} />
                      ))}
                    </div>
                    <h4 className="text-white font-semibold text-lg mb-2">{steps[activeStep].cardTitle}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">{steps[activeStep].cardDesc}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
