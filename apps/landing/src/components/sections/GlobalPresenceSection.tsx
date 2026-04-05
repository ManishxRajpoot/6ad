'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'

export default function GlobalPresenceSection() {
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
    <section ref={sectionRef} id="global-presence" className="relative py-8 sm:py-24 overflow-hidden">
      {/* Edge-based animations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Wandering glow orbs on edges */}
        <div className="team-glow-wander absolute top-[10%] left-[-8%] w-[350px] h-[350px] bg-blue-600/[0.06] rounded-full blur-[120px]" />
        <div className="team-glow-wander absolute bottom-[10%] right-[-8%] w-[300px] h-[300px] bg-cyan-600/[0.05] rounded-full blur-[100px]" style={{animationDelay: '7s'}} />
        {/* Vertical scan lines on edges */}
        <div className="absolute left-[2%] top-0 bottom-0 w-[2px] overflow-hidden opacity-[0.15]">
          <div className="benefits-grid-scan absolute left-0 right-0 h-[60px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent" />
        </div>
        <div className="absolute right-[2%] top-0 bottom-0 w-[2px] overflow-hidden opacity-[0.15]">
          <div className="benefits-grid-scan absolute left-0 right-0 h-[60px] bg-gradient-to-b from-transparent via-blue-400 to-transparent" style={{animationDelay: '4s'}} />
        </div>
        {/* Corner brackets */}
        <div className="absolute top-5 left-5 w-14 h-14 border-l-2 border-t-2 border-blue-400/15 rounded-tl-md" />
        <div className="absolute top-5 right-5 w-14 h-14 border-r-2 border-t-2 border-blue-400/15 rounded-tr-md" />
        <div className="absolute bottom-5 left-5 w-14 h-14 border-l-2 border-b-2 border-blue-400/15 rounded-bl-md" />
        <div className="absolute bottom-5 right-5 w-14 h-14 border-r-2 border-b-2 border-blue-400/15 rounded-br-md" />
      </div>
      <div className="relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-5 sm:mb-14 transition-all duration-700 max-w-6xl mx-auto px-4 sm:px-6 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="text-blue-400 text-[10px] sm:text-sm font-semibold tracking-[0.2em] uppercase mb-2 sm:mb-4 block">
            Global Presence
          </span>
          <h2 className="text-lg sm:text-3xl md:text-4xl font-bold text-white leading-tight mb-2 sm:mb-4">
            Trusted by Agencies Worldwide
          </h2>
          <p className="text-white/40 text-xs sm:text-base max-w-lg mx-auto leading-relaxed">
            Powering ad accounts for agencies across the globe with reliable, scalable infrastructure.
          </p>
        </div>

        {/* Map Container */}
        <div className={`relative w-full transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div
            className="relative w-[95%] sm:w-[60%] mx-auto aspect-[2/1]"
            style={{
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 85%)',
              maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 85%)',
            }}
          >
            <Image
              src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/location-pins.webp"
              alt="Office locations worldwide"
              fill
              className="object-contain"
              priority={false}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
