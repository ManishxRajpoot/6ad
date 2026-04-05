'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'

export default function MeetTeamSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setIsVisible(true) },
      { threshold: 0.15 }
    )
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="meet-team" className="relative py-8 sm:py-24 overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="team-glow-wander absolute top-1/3 right-0 w-[500px] h-[500px] bg-blue-600/[0.03] rounded-full blur-[180px]" />
        <div className="team-glow-wander absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-600/[0.03] rounded-full blur-[150px]" style={{animationDelay: '5s'}} />
        {/* DNA helix lines */}
        <div className="absolute left-[3%] top-0 bottom-0 w-[2px] overflow-hidden opacity-[0.15]">
          <div className="team-helix h-[200%]" style={{background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 18px, #3B82F6 18px, #3B82F6 22px, transparent 22px, transparent 38px, #8B5CF6 38px, #8B5CF6 42px)'}} />
        </div>
        <div className="absolute right-[3%] top-0 bottom-0 w-[2px] overflow-hidden opacity-[0.12]">
          <div className="team-helix h-[200%]" style={{animationDelay: '3s', background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 22px, #8B5CF6 22px, #8B5CF6 26px, transparent 26px, transparent 45px, #3B82F6 45px, #3B82F6 49px)'}} />
        </div>
        <div className="absolute left-[8%] top-0 bottom-0 w-[1px] overflow-hidden opacity-[0.08]">
          <div className="team-helix h-[200%]" style={{animationDelay: '6s', animationDuration: '12s', background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 30px, #6366F1 30px, #6366F1 33px)'}} />
        </div>
        <div className="absolute right-[8%] top-0 bottom-0 w-[1px] overflow-hidden opacity-[0.06]">
          <div className="team-helix h-[200%]" style={{animationDelay: '8s', animationDuration: '18s', background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 35px, #6366F1 35px, #6366F1 38px)'}} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* ===== MOBILE: Compact layout ===== */}
        <div className={`sm:hidden transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-4">
            <span className="text-blue-400 text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 block">Built by people who care</span>
            <h2 className="text-lg font-bold text-white">Meet The Team</h2>
          </div>

          {/* Photos row */}
          <div className="relative flex justify-center mb-4">
            <div className="rounded-xl overflow-hidden border border-white/[0.08] shadow-xl w-full max-w-[280px]">
              <div className="aspect-[4/3] bg-white/[0.04]">
                <Image src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/team-main.jpg" alt="ADS360 Team" width={280} height={210} className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="absolute -bottom-3 right-4 z-20 w-[80px] rounded-xl overflow-hidden border-2 border-white/[0.1] shadow-xl bg-dark-900">
              <div className="aspect-[9/16] bg-white/[0.04]">
                <Image src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/team-phone.jpg" alt="ADS360 Team" width={80} height={142} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          <p className="text-white/50 text-[11px] leading-relaxed mt-5 mb-3 text-center px-2">
            We started ADS360 after facing the same problems — unstable accounts, sudden bans, and unreliable providers. We built a system that actually scales.
          </p>
          <div className="text-center">
            <a href="#contact" className="inline-flex items-center gap-1.5 text-white font-semibold text-xs border border-white/20 rounded-full px-4 py-2">
              Meet the Team
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
          </div>
        </div>

        {/* ===== DESKTOP: Original layout ===== */}
        <div className={`hidden sm:block transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-16">
            <span className="text-blue-400 text-sm font-semibold tracking-[0.2em] uppercase mb-4 block">
              Built by people who care
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
              Meet The Team
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <p className="text-white/60 text-lg sm:text-xl leading-relaxed mb-8">
                We started ADS360 after facing the same problems our clients deal with today — unstable ad accounts, sudden bans, and unreliable providers. Instead of accepting it, we built direct relationships, proper infrastructure, and a system that actually scales.
              </p>
              <a href="#contact" className="inline-flex items-center gap-2 text-white font-semibold text-base border border-white/20 rounded-full px-6 py-3 hover:bg-white/[0.06] transition-colors duration-300">
                Meet the ADS360 Team
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-1"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="absolute -top-6 right-0 w-32 h-64 bg-gradient-to-br from-blue-500/20 to-blue-600/5 rounded-xl rotate-12 blur-sm" />
              <div className="absolute bottom-0 left-1/4 w-24 h-48 bg-gradient-to-tr from-blue-500/15 to-purple-500/5 rounded-xl -rotate-12 blur-sm" />
              <div className="relative z-10 rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/30 w-full max-w-[420px]">
                <div className="aspect-[4/3] bg-white/[0.04]">
                  <Image src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/team-main.jpg" alt="ADS360 Team" width={420} height={315} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="absolute -bottom-4 right-4 z-20 w-[160px] rounded-2xl overflow-hidden border-2 border-white/[0.1] shadow-2xl shadow-black/40 bg-dark-900">
                <div className="aspect-[9/16] bg-white/[0.04]">
                  <Image src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/team-phone.jpg" alt="ADS360 Team" width={160} height={284} className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
