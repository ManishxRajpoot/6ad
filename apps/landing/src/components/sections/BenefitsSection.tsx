'use client'

import { useRef } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Rocket, Zap, Headphones, TrendingDown, Ban, Shield, RefreshCw, Database } from 'lucide-react'
import { useScrollReveal } from '../shared/useScrollReveal'

// ==================== BENEFITS SECTION ====================
function BenefitsSection() {
  const sectionHead = useScrollReveal()
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 160
    scrollRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  const benefits = [
    { id: 'd2c', title: 'Run Aggressive D2C Claims', desc: 'Unlock explosive growth with bold, high-impact offers designed for direct-to-consumer brands.', color: '#3B82F6', icon: Rocket },
    { id: 'topup', title: 'Instant Top-ups', desc: 'Our API auto-deposits funds into your wallet and ad accounts instantly. Fully automated, available 24/7.', color: '#3B82F6', icon: Zap },
    { id: 'support', title: '24/7 Customer Support', desc: 'Our team is there to help 24/7, ready to answer any of your burning questions.', color: '#3B82F6', icon: Headphones },
    { id: 'cpa', title: "Lower CPA's & CPM's", desc: 'Our whitelisted agency accounts have built up a strong reputation, allowing us to get up to 50% lower CPAs.', color: '#3B82F6', icon: TrendingDown },
    { id: 'noban', title: 'No Bans or Restrictions', desc: 'Run ads with whitelisted accounts that have unlimited spend, instant replacements, and dedicated support.', color: '#3B82F6', icon: Ban },
    { id: 'scale', title: 'Scale Without Limits', desc: 'Unlimited ad spend potential on various advertising platforms, no budget restrictions or caps.', color: '#3B82F6', icon: Rocket },
    { id: 'approved', title: 'Ads Approved in Seconds', desc: 'With direct access to premium agency accounts, your campaigns get approved and start running instantly.', color: '#3B82F6', icon: Shield },
    { id: 'running', title: 'Keep Your Ads Running', desc: 'If your ad account gets disabled, we instantly replace it so your campaigns continue without interruption.', color: '#3B82F6', icon: RefreshCw },
    { id: 'pixel', title: 'Never Lose Your Pixel Data', desc: 'We help you set up a bulletproof account structure so you never lose your pixel or analytics data.', color: '#3B82F6', icon: Database },
  ]

  return (
    <section id="benefits" className="relative pt-6 sm:pt-12 pb-10 sm:pb-14 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating gradient orbs — slow orbit */}
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full blur-[200px] benefits-orb-1" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />
        <div className="absolute top-[40%] right-[10%] w-[400px] h-[400px] rounded-full blur-[180px] benefits-orb-2" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[5%] left-[40%] w-[450px] h-[450px] rounded-full blur-[200px] benefits-orb-3" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)' }} />

        {/* Animated grid lines — horizontal */}
        <div className="absolute inset-0 overflow-hidden opacity-[0.04]">
          <div className="benefits-grid-scan absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
        </div>

        {/* Vertical scan line */}
        <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
          <div className="benefits-grid-scan-v absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent" />
        </div>

        {/* Dot grid — subtle breathing */}
        <div
          className="absolute inset-0 opacity-[0.025] benefits-grid-breathe"
          style={{
            backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Twinkling stars */}
        {[
          { top: '5%', left: '10%', size: 2, delay: '0s' },
          { top: '10%', left: '50%', size: 2, delay: '1.5s' },
          { top: '4%', left: '85%', size: 2.5, delay: '0.5s' },
          { top: '30%', left: '20%', size: 1.5, delay: '2.5s' },
          { top: '50%', left: '75%', size: 2, delay: '3s' },
          { top: '65%', left: '8%', size: 1.5, delay: '1s' },
          { top: '80%', left: '45%', size: 2, delay: '4s' },
          { top: '90%', left: '88%', size: 1.5, delay: '2s' },
        ].map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white services-star-twinkle"
            style={{
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: star.delay,
            }}
          />
        ))}

        {/* Floating particles — slow drift */}
        {[
          { top: '15%', left: '5%', duration: '20s', delay: '0s' },
          { top: '25%', left: '90%', duration: '25s', delay: '5s' },
          { top: '60%', left: '3%', duration: '22s', delay: '3s' },
          { top: '75%', left: '85%', duration: '18s', delay: '8s' },
          { top: '45%', left: '50%', duration: '30s', delay: '2s' },
        ].map((p, i) => (
          <div
            key={`particle-${i}`}
            className="absolute w-1 h-1 rounded-full bg-blue-400/20 benefits-particle"
            style={{
              top: p.top,
              left: p.left,
              animationDuration: p.duration,
              animationDelay: p.delay,
            }}
          />
        ))}

        {/* Rotating ring — large subtle orbit */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] benefits-ring-rotate opacity-[0.04]">
          <div className="absolute inset-0 rounded-full border border-blue-400/40" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-400/60" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
        </div>

        {/* Second smaller ring — counter-rotate */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] benefits-ring-rotate-reverse opacity-[0.03]">
          <div className="absolute inset-0 rounded-full border border-dashed border-cyan-400/30" />
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-300/50" />
        </div>

        {/* Pulse rings from center */}
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2">
          <div className="benefits-pulse-ring absolute w-[200px] h-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-500/10" />
          <div className="benefits-pulse-ring absolute w-[200px] h-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-500/10" style={{ animationDelay: '2s' }} />
          <div className="benefits-pulse-ring absolute w-[200px] h-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-500/10" style={{ animationDelay: '4s' }} />
        </div>

        {/* Meteor streaks */}
        <div className="benefits-meteor absolute top-[10%] right-[5%] w-[100px] h-[1px] bg-gradient-to-l from-blue-400/40 to-transparent rotate-[-35deg]" style={{ animationDelay: '0s' }} />
        <div className="benefits-meteor absolute top-[30%] right-[15%] w-[70px] h-[1px] bg-gradient-to-l from-cyan-400/30 to-transparent rotate-[-35deg]" style={{ animationDelay: '4s' }} />
        <div className="benefits-meteor absolute top-[55%] right-[8%] w-[90px] h-[1px] bg-gradient-to-l from-blue-300/35 to-transparent rotate-[-35deg]" style={{ animationDelay: '8s' }} />
        <div className="benefits-meteor absolute top-[70%] left-[10%] w-[80px] h-[1px] bg-gradient-to-l from-cyan-300/25 to-transparent rotate-[-35deg]" style={{ animationDelay: '6s' }} />

        {/* Glowing connection lines between card areas */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <line x1="20%" y1="45%" x2="50%" y2="35%" stroke="url(#benefitsLineGrad)" strokeWidth="1" className="benefits-line-draw" />
          <line x1="50%" y1="35%" x2="80%" y2="45%" stroke="url(#benefitsLineGrad)" strokeWidth="1" className="benefits-line-draw" style={{ animationDelay: '1.5s' }} />
          <line x1="20%" y1="75%" x2="50%" y2="65%" stroke="url(#benefitsLineGrad)" strokeWidth="1" className="benefits-line-draw" style={{ animationDelay: '3s' }} />
          <line x1="50%" y1="65%" x2="80%" y2="75%" stroke="url(#benefitsLineGrad)" strokeWidth="1" className="benefits-line-draw" style={{ animationDelay: '4.5s' }} />
          <defs>
            <linearGradient id="benefitsLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* CSS Animations - using inline styles since styled-jsx doesn't work in app router */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes benefitsOrbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(40px, -30px) scale(1.1); }
          50% { transform: translate(-20px, -60px) scale(0.95); }
          75% { transform: translate(-50px, -20px) scale(1.05); }
        }
        @keyframes benefitsOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, 40px) scale(1.08); }
          66% { transform: translate(30px, -30px) scale(0.92); }
        }
        @keyframes benefitsOrbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(60px, 20px) scale(1.05); }
          50% { transform: translate(20px, -40px) scale(0.9); }
          80% { transform: translate(-40px, 10px) scale(1.1); }
        }
        .benefits-orb-1 { animation: benefitsOrbFloat1 15s ease-in-out infinite; }
        .benefits-orb-2 { animation: benefitsOrbFloat2 18s ease-in-out infinite; }
        .benefits-orb-3 { animation: benefitsOrbFloat3 22s ease-in-out infinite; }

        @keyframes benefitsGridScan {
          0% { top: -5%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 105%; opacity: 0; }
        }
        .benefits-grid-scan { animation: benefitsGridScan 8s linear infinite; }

        @keyframes benefitsGridScanV {
          0% { left: -5%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 105%; opacity: 0; }
        }
        .benefits-grid-scan-v { animation: benefitsGridScanV 12s linear infinite; }

        @keyframes benefitsGridBreathe {
          0%, 100% { opacity: 0.025; }
          50% { opacity: 0.06; }
        }
        .benefits-grid-breathe { animation: benefitsGridBreathe 6s ease-in-out infinite; }

        @keyframes benefitsParticleDrift {
          0% { transform: translate(0, 0) scale(1); opacity: 0; }
          10% { opacity: 0.6; }
          50% { transform: translate(80px, -120px) scale(1.5); opacity: 0.3; }
          90% { opacity: 0; }
          100% { transform: translate(160px, -240px) scale(0.5); opacity: 0; }
        }
        .benefits-particle { animation: benefitsParticleDrift 20s ease-in-out infinite; }

        @keyframes benefitsRingRotate {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .benefits-ring-rotate { animation: benefitsRingRotate 40s linear infinite; }
        .benefits-ring-rotate-reverse { animation: benefitsRingRotate 30s linear infinite reverse; }

        @keyframes benefitsPulseRing {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
        .benefits-pulse-ring { animation: benefitsPulseRing 6s ease-out infinite; }

        @keyframes benefitsMeteor {
          0% { transform: translateX(0) rotate(-35deg); opacity: 0; }
          5% { opacity: 1; }
          30% { transform: translateX(-300px) rotate(-35deg); opacity: 0; }
          100% { transform: translateX(-300px) rotate(-35deg); opacity: 0; }
        }
        .benefits-meteor { animation: benefitsMeteor 12s ease-in infinite; }

        @keyframes benefitsLineDraw {
          0%, 100% { opacity: 0; stroke-dashoffset: 200; }
          30%, 70% { opacity: 1; stroke-dashoffset: 0; }
        }
        .benefits-line-draw { stroke-dasharray: 200; animation: benefitsLineDraw 8s ease-in-out infinite; }
      `}} />

      <div className="relative z-10 max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Header — futuristic mobile-first design */}
        <div
          ref={sectionHead.ref}
          className={`mb-4 sm:mb-16 transition-all duration-700 ${sectionHead.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Mobile: centered futuristic layout */}
          <div className="lg:hidden text-center relative">
            {/* Glowing badge */}
            <div className="inline-flex items-center gap-2 mb-2 relative">
              <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full" />
              <span className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/[0.06] backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-400 text-[10px] font-bold tracking-[0.25em] uppercase">Benefits</span>
              </span>
            </div>

            {/* Heading with animated gradient */}
            <h2 className="text-white text-[20px] sm:text-4xl font-bold leading-[1.15] mb-2 relative">
              <span className="relative">
                Break Free from
                <br />
                Spending Limits,
                <br />
                Rejections, and{' '}
              </span>
              <span className="relative inline-block">
                <span className="benefits-text-glow bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent bg-[length:200%_auto]">Bans</span>
                {/* Underline glow */}
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent benefits-line-glow" />
              </span>
            </h2>

            {/* Description with glass card */}
            <p className="text-gray-400 text-xs leading-relaxed max-w-xs mx-auto mb-2">
              Scale without limits, get higher ROI, and run multiple campaigns without any risks!
            </p>

            {/* CTA — glowing button */}
            <a
              href="#pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-full relative overflow-hidden group transition-all duration-500"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600/30 via-cyan-500/20 to-blue-600/30 border border-blue-500/25" />
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="absolute -inset-1 rounded-full bg-blue-500/15 blur-lg opacity-0 group-active:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                View Pricing
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            </a>
          </div>

          {/* Desktop: split layout */}
          <div className="hidden lg:flex lg:items-start lg:justify-between gap-8">
            <div className="lg:max-w-lg">
              <div className="inline-flex items-center gap-2 mb-5">
                <span className="w-6 h-[1px] bg-gradient-to-r from-transparent to-blue-500/60" />
                <span className="text-blue-400/80 text-xs font-semibold tracking-[0.2em] uppercase">Benefits</span>
                <span className="w-6 h-[1px] bg-gradient-to-l from-transparent to-blue-500/60" />
              </div>
              <h2 className="text-white text-4xl md:text-[42px] font-bold leading-tight">
                Break Free from Spending Limits, Rejections, and{' '}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">Bans</span>
              </h2>
            </div>
            <div className="lg:max-w-md lg:pt-10">
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-6">
                We work closely with ad platform reps to ensure you, as an entrepreneur, can run your ads smoothly. Scale without limits, get higher ROI, and run multiple campaigns without any risks!
              </p>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white px-5 py-2.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/[0.04] transition-all duration-300 group"
              >
                View Pricing
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </a>
            </div>
          </div>
        </div>

        {/* ===== MOBILE: Touch-swipeable Cards with Arrows ===== */}
        <div className="sm:hidden">
          <div ref={scrollRef} className="overflow-x-auto scrollbar-hide px-4 pb-3 snap-x snap-mandatory" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-2.5" style={{ width: 'max-content' }}>
              {benefits.map((b) => {
                const Icon = b.icon
                return (
                  <div key={b.id} className="w-[150px] flex-shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden snap-start">
                    {/* Mini illustration — render at 350px then scale to fit 150px */}
                    <div className="relative w-full overflow-hidden select-none" style={{ height: '90px', userSelect: 'none', WebkitUserSelect: 'none' }}>
                      <div style={{ width: '350px', height: '210px', transform: 'scale(0.43)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                        <div className="relative w-full h-full">
                          <BenefitIllustration id={b.id} />
                        </div>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="px-2.5 pb-2.5 pt-1.5">
                      <h3 className="text-white text-[10px] font-bold leading-tight">{b.title}</h3>
                      <p className="text-gray-400 text-[8px] mt-0.5 leading-relaxed line-clamp-2">{b.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Arrow buttons */}
          <div className="flex justify-center gap-3 mt-1">
            <button aria-label="Previous benefit" onClick={() => scrollBy('left')} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center active:scale-90 transition-transform">
              <ChevronLeft className="w-4 h-4 text-white/70" />
            </button>
            <button aria-label="Next benefit" onClick={() => scrollBy('right')} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center active:scale-90 transition-transform">
              <ChevronRight className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* ===== DESKTOP: Benefits Grid — 3x3 ===== */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {benefits.map((benefit, idx) => (
            <BenefitCard key={benefit.id} benefit={benefit} index={idx} />
          ))}
        </div>
      </div>
    </section>
  )
}

// CSS-illustrated scene for each benefit card
function BenefitIllustration({ id }: { id: string }) {
  const accent = '#3B82F6'
  const base = (
    <div className="absolute inset-0 rounded-t-2xl overflow-hidden select-none" style={{ background: 'radial-gradient(ellipse at 50% 120%, #0c1a30 0%, #080c18 70%)', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Arc decoration */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[280px] h-[140px] rounded-t-full border border-blue-500/10" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[220px] h-[110px] rounded-t-full border border-blue-500/[0.07]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[160px] h-[80px] rounded-t-full border border-blue-500/[0.05]" />
    </div>
  )

  switch (id) {
    case 'd2c':
      return (
        <div className="relative w-full h-full">
          {base}
          {/* Dot grid overlay */}
          <div className="absolute inset-0 z-[1] opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
          {/* Top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[60px] bg-blue-500/10 rounded-full blur-[40px] z-[1]" />
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
            {/* Headline */}
            <div className="text-center mb-3">
              <div className="text-white font-bold text-lg leading-tight">Lose 5 KG</div>
              <div className="text-blue-400 font-semibold text-sm">in 2 Days</div>
            </div>
            {/* Before → After figures */}
            <div className="flex items-end justify-center gap-4">
              {/* Before figure - curvy woman */}
              <div className="flex flex-col items-center">
                <svg className="w-[56px] h-[85px]" viewBox="0 0 56 85" fill="none">
                  {/* Hair (long, behind body) */}
                  <path d="M16 12c-1 8-2 20 0 28 0 0-2-6 0-14 1-5 2-10 2-14z" fill="#2D3555" />
                  <path d="M40 12c1 8 2 20 0 28 0 0 2-6 0-14-1-5-2-10-2-14z" fill="#2D3555" />
                  {/* Head */}
                  <circle cx="28" cy="12" r="9" fill="#C4A882" />
                  {/* Hair top */}
                  <path d="M19 11c0-7 4-11 9-11s9 4 9 11c0 0-2-6-9-6s-9 6-9 6z" fill="#2D3555" />
                  {/* Hair sides flowing down */}
                  <path d="M19 11c-1 3-2 12-1 22" stroke="#2D3555" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M37 11c1 3 2 12 1 22" stroke="#2D3555" strokeWidth="3.5" strokeLinecap="round" />
                  {/* Neck */}
                  <rect x="25" y="20" width="6" height="4" rx="2" fill="#C4A882" />
                  {/* Dress/top - wider body */}
                  <path d="M14 26c-2 8-3 18-2 28h32c1-10 0-20-2-28-3-3-8-4-14-4s-11 1-14 4z" fill="#8B7FC7" />
                  {/* Chest area subtle shape */}
                  <path d="M20 28c2 2 6 4 8 4s6-2 8-4" stroke="#7B6FB7" strokeWidth="0.8" fill="none" />
                  {/* Belt/waist */}
                  <rect x="16" y="40" width="24" height="2" rx="1" fill="#7B6FB7" />
                  {/* Arms */}
                  <path d="M14 28c-4 4-6 10-5 16" stroke="#C4A882" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M42 28c4 4 6 10 5 16" stroke="#C4A882" strokeWidth="3.5" strokeLinecap="round" />
                  {/* Legs */}
                  <rect x="19" y="54" width="6" height="20" rx="3" fill="#C4A882" />
                  <rect x="31" y="54" width="6" height="20" rx="3" fill="#C4A882" />
                  {/* Shoes/heels */}
                  <path d="M18 73c0 2 2 3 5 3s4-1 4-3" fill="#1E2440" />
                  <path d="M30 73c0 2 2 3 5 3s4-1 4-3" fill="#1E2440" />
                </svg>
                <span className="text-[9px] text-white/40 mt-1 font-medium">Before</span>
              </div>
              {/* Arrow */}
              <div className="flex items-center mb-10">
                <svg className="w-10 h-5" viewBox="0 0 40 20" fill="none">
                  <defs>
                    <linearGradient id="arrowGrad" x1="0" y1="10" x2="40" y2="10"><stop stopColor="#3B82F6" stopOpacity="0.4"/><stop offset="1" stopColor="#3B82F6"/></linearGradient>
                  </defs>
                  <path d="M0 10H32M26 4l8 6-8 6" stroke="url(#arrowGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {/* After figure - slim woman, confident pose */}
              <div className="flex flex-col items-center">
                <svg className="w-[40px] h-[85px]" viewBox="0 0 40 85" fill="none">
                  {/* Hair (long, behind body) */}
                  <path d="M12 12c-1 6-1 16 1 24" stroke="#2D3555" strokeWidth="3" strokeLinecap="round" />
                  <path d="M28 12c1 6 1 16-1 24" stroke="#2D3555" strokeWidth="3" strokeLinecap="round" />
                  {/* Head */}
                  <circle cx="20" cy="12" r="8" fill="#C4A882" />
                  {/* Hair top */}
                  <path d="M12 10c0-6 3.5-10 8-10s8 4 8 10c0 0-2-5-8-5s-8 5-8 5z" fill="#2D3555" />
                  {/* Neck */}
                  <rect x="17.5" y="19" width="5" height="4" rx="2" fill="#C4A882" />
                  {/* Dress/top - slim fitted */}
                  <path d="M12 25c-1 6-1 16 0 24h16c1-8 1-18 0-24-2-2-5-3-8-3s-6 1-8 3z" fill="#9B8FD7" />
                  {/* Waist cinch */}
                  <path d="M13 38c2-1 5-2 7-2s5 1 7 2" stroke="#8B7FC7" strokeWidth="1" fill="none" />
                  {/* Belt */}
                  <rect x="13" y="37" width="14" height="1.5" rx="0.75" fill="#8B7FC7" />
                  {/* Arm down */}
                  <path d="M12 27c-3 3-3 10-2 15" stroke="#C4A882" strokeWidth="3" strokeLinecap="round" />
                  {/* Arm on hip - confident pose */}
                  <path d="M28 27c2 2 4 5 4 8s-2 4-4 4" stroke="#C4A882" strokeWidth="3" strokeLinecap="round" />
                  {/* Legs */}
                  <rect x="14" y="49" width="5" height="22" rx="2.5" fill="#C4A882" />
                  <rect x="22" y="49" width="5" height="22" rx="2.5" fill="#C4A882" />
                  {/* High heels */}
                  <path d="M13 70c0 2 2 3 4.5 3s3.5-1 3.5-3" fill="#1E2440" />
                  <path d="M21 70c0 2 2 3 4.5 3s3.5-1 3.5-3" fill="#1E2440" />
                  <rect x="15" y="73" width="2" height="3" rx="0.5" fill="#1E2440" />
                  <rect x="23" y="73" width="2" height="3" rx="0.5" fill="#1E2440" />
                </svg>
                <span className="text-[9px] text-white/40 mt-1 font-medium">After</span>
              </div>
            </div>
            {/* Bottom glow line */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          </div>
        </div>
      )
    case 'topup':
      return (
        <div className="relative w-full h-full">
          {base}
          {/* Dot grid overlay */}
          <div className="absolute inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-3 py-4">
            {/* Flow: API → System → Wallet → Ad Account */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* API Node */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="3" y="15" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="7" cy="6" r="1" fill="currentColor"/>
                    <circle cx="7" cy="18" r="1" fill="currentColor"/>
                    <path d="M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="text-[7px] sm:text-[8px] text-blue-400/70 font-semibold tracking-wider">API</span>
              </div>

              {/* Animated arrow 1 */}
              <div className="flex items-center w-6 sm:w-8 -mt-3">
                <div className="w-full h-[1.5px] bg-gradient-to-r from-blue-500/60 to-cyan-400/60 relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-cyan-400/80" />
                  <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" style={{ animation: 'topup-flow 2s ease-in-out infinite' }} />
                </div>
              </div>

              {/* System/Processing Node */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border border-cyan-500/25 flex items-center justify-center relative shadow-lg shadow-cyan-500/10">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {/* Spinning ring */}
                  <div className="absolute inset-0 rounded-xl border border-cyan-400/20" style={{ animation: 'spin 8s linear infinite' }} />
                </div>
                <span className="text-[7px] sm:text-[8px] text-cyan-400/70 font-semibold tracking-wider">AUTO</span>
              </div>

              {/* Animated arrow 2 - splits into two */}
              <div className="flex flex-col items-center -mt-3 w-6 sm:w-8">
                {/* Top arrow → Wallet */}
                <div className="w-full h-[1.5px] bg-gradient-to-r from-cyan-400/60 to-green-400/60 relative -rotate-12 -mb-0.5">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-green-400/80" />
                  <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/50" style={{ animation: 'topup-flow 2s ease-in-out infinite 0.5s' }} />
                </div>
                {/* Bottom arrow → Ad Account */}
                <div className="w-full h-[1.5px] bg-gradient-to-r from-cyan-400/60 to-green-400/60 relative rotate-12 -mt-0.5">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-green-400/80" />
                  <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/50" style={{ animation: 'topup-flow 2s ease-in-out infinite 1s' }} />
                </div>
              </div>

              {/* Destination: Wallet + Ad Account stacked */}
              <div className="flex flex-col items-center gap-1.5">
                {/* Wallet */}
                <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1.5 shadow-lg">
                  <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M16 13a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                    <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-white/40 leading-none">Wallet</span>
                    <span className="text-[9px] text-green-300 font-bold leading-tight">+$5,400</span>
                  </div>
                </div>
                {/* Ad Account */}
                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1.5 shadow-lg">
                  <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-white/40 leading-none">Ad Acc</span>
                    <span className="text-[9px] text-blue-300 font-bold leading-tight">+$5,400</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status bar at bottom */}
            <div className="mt-3 flex items-center gap-1.5 bg-[#0d1525] border border-green-500/15 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/50" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              <span className="text-[8px] text-green-400/80 font-medium">Auto-deposit complete • 24/7</span>
            </div>
          </div>
        </div>
      )
    case 'support':
      return (
        <div className="relative w-full h-full">
          {base}
          <div className="relative z-10 flex items-center justify-center h-full">
            {/* Chat mockup */}
            <div className="bg-[#12162a] border border-white/10 rounded-xl p-3 shadow-xl w-[200px]">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                <div className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center text-[8px] text-blue-200">A</div>
                <div>
                  <div className="text-white/80 text-[10px] font-semibold">ADS360 Support</div>
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="text-green-400/80 text-[8px]">Online</span></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="bg-white/5 rounded-lg rounded-tl-none px-2.5 py-1.5 text-[9px] text-white/60 max-w-[85%]">Hi there, how can we help you today?</div>
                <div className="bg-blue-500/15 rounded-lg rounded-tr-none px-2.5 py-1.5 text-[9px] text-white/60 max-w-[85%] ml-auto">How can I add balance?</div>
                <div className="bg-white/5 rounded-lg rounded-tl-none px-2.5 py-1.5 text-[9px] text-white/60 max-w-[85%]">Thank you for reaching out. In order to...</div>
              </div>
            </div>
          </div>
        </div>
      )
    case 'cpa':
      return (
        <div className="relative w-full h-full">
          {base}
          {/* Dot grid overlay */}
          <div className="absolute inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 py-2">
            {/* Dashboard-style metrics panel */}
            <div className="w-full max-w-[240px]">
              {/* Header bar */}
              <div className="flex items-center justify-between mb-1.5 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
                  <span className="text-[7px] text-white/50 font-semibold tracking-wider uppercase">Live Metrics</span>
                </div>
                <div className="bg-green-500/15 border border-green-500/20 rounded-full px-2 py-0.5">
                  <span className="text-[8px] text-green-400 font-bold">-50% Avg</span>
                </div>
              </div>

              {/* Platform rows */}
              {[
                { name: 'Meta', logo: '/fb.png', color: '#0081FB', cpa: '$4.20', cpm: '$2.10', change: '-52%' },
                { name: 'Google', logo: '/google.png', color: '#4285F4', cpa: '$3.80', cpm: '$1.90', change: '-48%' },
                { name: 'TikTok', logo: '/tiktok.png', color: '#ff0050', cpa: '$2.90', cpm: '$1.50', change: '-55%' },
                { name: 'Bing', logo: '/bing.webp', color: '#00A4EF', cpa: '$3.10', cpm: '$1.70', change: '-45%' },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 mb-1">
                  {/* Platform icon */}
                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: `${p.color}10`, border: `1px solid ${p.color}25` }}>
                    <img src={p.logo} alt={p.name} className="w-3.5 h-3.5 object-contain" />
                  </div>
                  {/* Platform name */}
                  <span className="text-[8px] text-white/60 font-medium w-9 shrink-0">{p.name}</span>
                  {/* CPA */}
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-[6px] text-white/25 leading-none">CPA</span>
                    <span className="text-[8px] text-white/80 font-semibold">{p.cpa}</span>
                  </div>
                  {/* CPM */}
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-[6px] text-white/25 leading-none">CPM</span>
                    <span className="text-[8px] text-white/80 font-semibold">{p.cpm}</span>
                  </div>
                  {/* Change % */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <svg className="w-2.5 h-2.5 text-green-400" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M3 4l2-2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span className="text-[8px] text-green-400 font-bold">{p.change}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    case 'noban':
      return (
        <div className="relative w-full h-full">
          {base}
          {/* Dot grid overlay */}
          <div className="absolute inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex items-center justify-center h-full px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Left: FB Ban popup mockup (faded/crossed out) */}
              <div className="relative opacity-60">
                {/* Mini popup card */}
                <div className="bg-white/[0.07] border border-red-500/20 rounded-lg p-2.5 w-[90px]">
                  {/* FB header bar */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-4 h-4 rounded-full bg-[#0081FB]/30 flex items-center justify-center text-[7px] font-bold text-[#0081FB]">f</div>
                    <span className="text-[7px] text-white/40 font-medium">Ad Policy</span>
                  </div>
                  {/* Red lock icon */}
                  <div className="flex justify-center mb-1.5">
                    <svg className="w-8 h-10" viewBox="0 0 32 40" fill="none">
                      {/* Lock shackle */}
                      <path d="M9 16V12a7 7 0 0114 0v4" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
                      {/* Lock body */}
                      <rect x="5" y="16" width="22" height="18" rx="4" fill="#EF4444" opacity="0.9"/>
                      {/* Slash line */}
                      <line x1="12" y1="30" x2="20" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
                    </svg>
                  </div>
                  {/* Ban text */}
                  <div className="text-center">
                    <div className="text-[7px] text-red-400 font-bold leading-tight">Restricted From</div>
                    <div className="text-[7px] text-red-400 font-bold leading-tight">Advertising</div>
                  </div>
                </div>
                {/* Big X overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 90 120" fill="none">
                    <line x1="10" y1="10" x2="80" y2="110" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
                    <line x1="80" y1="10" x2="10" y2="110" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
                  </svg>
                </div>
              </div>

              {/* Arrow transition */}
              <div className="flex flex-col items-center gap-1">
                <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
                  <defs>
                    <linearGradient id="nobanArrow" x1="0" y1="10" x2="32" y2="10"><stop stopColor="#EF4444" stopOpacity="0.5"/><stop offset="1" stopColor="#22C55E"/></linearGradient>
                  </defs>
                  <path d="M0 10H24M20 5l6 5-6 5" stroke="url(#nobanArrow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Right: ADS360 Protected - Account Active */}
              <div className="relative">
                <div className="bg-green-500/[0.07] border border-green-500/20 rounded-lg p-2.5 w-[90px]">
                  {/* ADS360 header */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500/30 flex items-center justify-center text-[7px] font-bold text-blue-400">A</div>
                    <span className="text-[7px] text-white/40 font-medium">ADS360</span>
                  </div>
                  {/* Green shield */}
                  <div className="flex justify-center mb-1.5">
                    <svg className="w-8 h-10" viewBox="0 0 32 40" fill="none">
                      {/* Shield shape */}
                      <path d="M16 2L4 8v10c0 10 8 16 12 18 4-2 12-8 12-18V8L16 2z" fill="#22C55E" opacity="0.2" stroke="#22C55E" strokeWidth="1.5"/>
                      {/* Checkmark */}
                      <path d="M11 20l4 4 6-8" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  {/* Active text */}
                  <div className="text-center">
                    <div className="text-[7px] text-green-400 font-bold leading-tight">Account Active</div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <div className="w-1 h-1 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
                      <span className="text-[6px] text-green-400/60">Protected</span>
                    </div>
                  </div>
                </div>
                {/* Glow behind */}
                <div className="absolute -inset-2 bg-green-500/5 rounded-xl blur-md -z-10" />
              </div>
            </div>
          </div>
        </div>
      )
    case 'scale':
      return (
        <div className="relative w-full h-full">
          {base}
          {/* Dot grid overlay */}
          <div className="absolute inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 py-2">
            {/* Stacked ad account cards scaling up */}
            <div className="w-full max-w-[230px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[8px] text-white/50 font-semibold tracking-wider uppercase">Ad Spend</span>
                <div className="flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/25 rounded-full px-3 py-1 shadow-lg shadow-blue-500/10">
                  <span className="text-[22px] text-blue-400 font-bold leading-none">∞</span>
                  <span className="text-[11px] text-blue-400 font-bold">No Limit</span>
                </div>
              </div>

              {/* Stacked spend bars — growing wider to show scaling */}
              <div className="space-y-1">
                {[
                  { month: 'Jan', amount: '$2,500', width: '25%', logo: '/fb.png', name: 'Meta' },
                  { month: 'Feb', amount: '$8,400', width: '45%', logo: '/google.png', name: 'Google' },
                  { month: 'Mar', amount: '$24,000', width: '65%', logo: '/tiktok.png', name: 'TikTok' },
                  { month: 'Apr', amount: '$58,500', width: '85%', logo: '/fb.png', name: 'Meta' },
                  { month: 'Now', amount: '$142,000', width: '100%', logo: '/bing.webp', name: 'All' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[7px] text-white/30 w-5 shrink-0 text-right">{row.month}</span>
                    <div className="flex-1 relative h-[18px]">
                      <div
                        className="h-full rounded-md flex items-center gap-1.5 px-1.5 transition-all"
                        style={{
                          width: row.width,
                          background: i === 4
                            ? 'linear-gradient(90deg, rgba(59,130,246,0.3), rgba(6,182,212,0.3))'
                            : `rgba(59,130,246,${0.08 + i * 0.05})`,
                          border: i === 4 ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(59,130,246,0.1)',
                        }}
                      >
                        <img src={row.logo} alt={row.name} className="w-3 h-3 object-contain shrink-0" />
                        <span className={`text-[8px] font-semibold whitespace-nowrap ${i === 4 ? 'text-cyan-300' : 'text-white/60'}`}>{row.amount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upward arrow indicator */}
              <div className="flex items-center justify-end mt-1 gap-1">
                <svg className="w-3 h-3 text-cyan-400" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M3 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="text-[9px] text-cyan-400 font-bold">+5,580%</span>
                <span className="text-[7px] text-white/30">growth</span>
              </div>
            </div>
          </div>
        </div>
      )
    case 'approved':
      return (
        <div className="relative w-full h-full">
          {base}
          {/* Dot grid overlay */}
          <div className="absolute inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-3 py-2">
            {/* Facebook Ads Manager style review mockup */}
            <div className="w-full max-w-[230px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[7px] text-white/50 font-semibold tracking-wider uppercase">Ad Review</span>
                <div className="flex items-center gap-1 bg-green-500/15 border border-green-500/20 rounded-full px-2 py-0.5">
                  <svg className="w-2 h-2 text-green-400" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-[7px] text-green-400 font-bold">All Approved</span>
                </div>
              </div>

              {/* Ad rows - submitted → approved flow */}
              {[
                { name: 'Summer Sale', platform: '/fb.png', platName: 'Meta', time: '0.8s' },
                { name: 'Brand Launch', platform: '/google.png', platName: 'Google', time: '1.2s' },
                { name: 'Flash Offer', platform: '/tiktok.png', platName: 'TikTok', time: '0.5s' },
                { name: 'Retarget Pro', platform: '/bing.webp', platName: 'Bing', time: '0.9s' },
              ].map((ad, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 mb-1">
                  {/* Platform logo */}
                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 overflow-hidden bg-white/5">
                    <img src={ad.platform} alt={ad.platName} className="w-3.5 h-3.5 object-contain" />
                  </div>
                  {/* Ad name */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] text-white/70 font-medium block truncate">{ad.name}</span>
                    <span className="text-[6px] text-white/30">{ad.platName}</span>
                  </div>
                  {/* Status: green approved checkmark */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-3.5 h-3.5 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                      <svg className="w-2 h-2 text-green-400" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span className="text-[7px] text-green-400/70 font-medium">{ad.time}</span>
                  </div>
                </div>
              ))}

              {/* Speed indicator */}
              <div className="flex items-center justify-center mt-1 gap-1.5">
                <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[8px] text-blue-400/80 font-semibold">Avg. approval: 0.85s</span>
              </div>
            </div>
          </div>
        </div>
      )
    case 'running':
      return (
        <div className="relative w-full h-full">
          {base}
          {/* Dot grid overlay */}
          <div className="absolute inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-3 py-2">
            <div className="w-full max-w-[230px]">
              {/* Account disabled → instant replacement flow */}
              <div className="space-y-1">
                {/* Disabled account row */}
                <div className="flex items-center gap-2 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-2 py-1.5">
                  <div className="w-5 h-5 rounded-md overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                    <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/fb.webp" alt="Meta" className="w-3.5 h-3.5 object-contain opacity-40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] text-white/40 font-medium line-through">Ad Account #1847</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-[7px] text-red-400 font-medium">Disabled</span>
                  </div>
                </div>

                {/* Arrow down — instant swap */}
                <div className="flex items-center justify-center gap-1.5 py-0.5">
                  <div className="h-4 w-[1px] bg-gradient-to-b from-red-500/30 to-green-500/30" />
                  <svg className="w-3 h-3 text-cyan-400" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-[7px] text-cyan-400 font-bold">Instant Replace</span>
                  <div className="h-4 w-[1px] bg-gradient-to-b from-red-500/30 to-green-500/30" />
                </div>

                {/* New replacement account — active */}
                <div className="flex items-center gap-2 bg-green-500/[0.06] border border-green-500/15 rounded-lg px-2 py-1.5">
                  <div className="w-5 h-5 rounded-md overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                    <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/fb.webp" alt="Meta" className="w-3.5 h-3.5 object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] text-white/70 font-medium">Ad Account #2053</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
                    <span className="text-[7px] text-green-400 font-medium">Active</span>
                  </div>
                </div>

                {/* Campaign status — still running */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 mt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[7px] text-white/40">Campaigns</span>
                    <span className="text-[7px] text-green-400 font-semibold">3/3 Running</span>
                  </div>
                  {/* Mini progress bars */}
                  <div className="flex gap-1 mt-1">
                    {['Summer Sale', 'Flash Deal', 'Retarget'].map((c, i) => (
                      <div key={i} className="flex-1">
                        <div className="h-1 rounded-full bg-green-500/30 overflow-hidden">
                          <div className="h-full bg-green-400/60 rounded-full" style={{ width: `${70 + i * 10}%` }} />
                        </div>
                        <span className="text-[5px] text-white/25 mt-0.5 block truncate">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    case 'pixel':
      return (
        <div className="relative w-full h-full">
          {base}
          {/* Dot grid overlay */}
          <div className="absolute inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-3 py-2">
            <div className="w-full max-w-[230px]">
              {/* Pixel data structure mockup */}
              {/* Central pixel icon with shield */}
              <div className="flex items-center justify-center mb-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  {/* Shield overlay */}
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-green-400" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <span className="text-[8px] text-white/50 font-semibold ml-2">Pixel Protected</span>
              </div>

              {/* Data flow: multiple ad accounts → same pixel */}
              <div className="space-y-1">
                {/* Ad accounts connecting to pixel */}
                {[
                  { name: 'Ad Acc #1', status: 'Disabled', statusColor: 'red', logo: '/fb.png' },
                  { name: 'Ad Acc #2', status: 'Disabled', statusColor: 'red', logo: '/fb.png' },
                  { name: 'Ad Acc #3', status: 'Active', statusColor: 'green', logo: '/fb.png' },
                ].map((acc, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {/* Account */}
                    <div className={`flex items-center gap-1.5 flex-1 rounded-md px-1.5 py-1 border ${acc.statusColor === 'red' ? 'bg-red-500/[0.04] border-red-500/10' : 'bg-green-500/[0.06] border-green-500/15'}`}>
                      <div className="w-4 h-4 rounded overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                        <img src={acc.logo} alt="" className={`w-3 h-3 object-contain ${acc.statusColor === 'red' ? 'opacity-30' : ''}`} />
                      </div>
                      <span className={`text-[7px] font-medium ${acc.statusColor === 'red' ? 'text-white/30 line-through' : 'text-white/70'}`}>{acc.name}</span>
                      <div className={`w-1 h-1 rounded-full ml-auto shrink-0 ${acc.statusColor === 'red' ? 'bg-red-400' : 'bg-green-400'}`} />
                    </div>
                    {/* Arrow to pixel */}
                    <svg className="w-4 h-3 text-blue-400/40 shrink-0" viewBox="0 0 16 12" fill="none"><path d="M0 6h12M9 2l4 4-4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {/* Pixel data badge */}
                    <div className="bg-blue-500/10 border border-blue-500/15 rounded-md px-1.5 py-1 shrink-0">
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-blue-400" />
                        <span className="text-[6px] text-blue-400/80 font-medium">Pixel</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data safe indicator */}
              <div className="mt-1.5 bg-green-500/[0.06] border border-green-500/15 rounded-lg px-2 py-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-green-400" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6l-8-4z" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[7px] text-green-400/80 font-medium">Data Safe</span>
                  </div>
                  <span className="text-[7px] text-white/30">1.2M events saved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    default:
      return <div className="relative w-full h-full">{base}</div>
  }
}

function BenefitCard({ benefit, index }: { benefit: { id: string; title: string; desc: string; color: string }; index: number }) {
  const card = useScrollReveal()

  return (
    <div
      ref={card.ref}
      className={`benefit-card-wrap group relative rounded-2xl transition-all duration-700 hover:-translate-y-2 ${card.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: card.visible ? `${index * 80}ms` : '0ms' }}
    >
      {/* Outer glow on hover */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-blue-500/25 via-cyan-500/10 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[1px] pointer-events-none" />

      {/* Visible gradient border */}
      <div className="absolute inset-0 rounded-2xl p-[1px] overflow-hidden">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.12] via-blue-500/[0.08] to-white/[0.04] group-hover:from-blue-400/40 group-hover:via-cyan-400/20 group-hover:to-blue-500/10 transition-all duration-500" />
        <div className="absolute inset-[1px] rounded-2xl bg-[#0a0e1a]" />
      </div>

      {/* Top edge highlight line */}
      <div className="absolute top-0 inset-x-[15%] h-[1px] bg-gradient-to-r from-transparent via-blue-400/30 to-transparent z-20 group-hover:via-blue-400/60 transition-all duration-500" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Illustration area */}
        <div className="relative w-full h-[190px] rounded-t-2xl overflow-hidden select-none pointer-events-none">
          <BenefitIllustration id={benefit.id} />
          {/* Bottom divider line between illustration and text */}
          <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>

        {/* Text content */}
        <div className="p-5 sm:p-6">
          <h3 className="text-white text-base sm:text-lg font-bold mb-2">{benefit.title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed">{benefit.desc}</p>
        </div>

        {/* Bottom corner glow on hover */}
        <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full blur-[50px] opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none bg-blue-500" />
        {/* Top corner glow on hover */}
        <div className="absolute top-0 left-0 w-24 h-24 rounded-full blur-[40px] opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none bg-cyan-400" />
      </div>
    </div>
  )
}

export default BenefitsSection
