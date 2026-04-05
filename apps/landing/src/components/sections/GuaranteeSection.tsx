'use client'

import Image from 'next/image'
import { useScrollReveal } from '../shared/useScrollReveal'

export default function GuaranteeSection() {
  const heading = useScrollReveal()
  const card = useScrollReveal()

  return (
    <section id="guarantees" className="relative pt-4 sm:pt-8 pb-6 sm:pb-16 overflow-hidden">
      {/* Subtle background glow + shield animation */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-amber-600/[0.03] rounded-full blur-[120px]" />
        {/* Shield silhouette pulsing */}
        <div className="guarantee-shield absolute top-1/2 left-1/2 w-[300px] h-[350px]">
          <svg viewBox="0 0 100 120" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 5 L90 25 L90 65 C90 85 70 105 50 115 C30 105 10 85 10 65 L10 25 Z" stroke="#F59E0B" strokeWidth="0.5" fill="none" opacity="0.15" />
            <path d="M50 15 L80 30 L80 60 C80 78 65 95 50 103 C35 95 20 78 20 60 L20 30 Z" stroke="#F59E0B" strokeWidth="0.3" fill="none" opacity="0.1" />
          </svg>
        </div>
        {/* Hex grid pattern */}
        <div className="guarantee-hex absolute inset-0" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='52' viewBox='0 0 60 52' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23F59E0B' stroke-width='0.5'/%3E%3C/svg%3E")`, backgroundSize: '60px 52px'}} />
        {/* Corner accents */}
        <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-amber-400/20 rounded-tl-lg" />
        <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-amber-400/20 rounded-tr-lg" />
        <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-amber-400/20 rounded-bl-lg" />
        <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-amber-400/20 rounded-br-lg" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Heading */}
        <div
          ref={heading.ref}
          className={`text-center mb-3 sm:mb-8 transition-all duration-700 ${heading.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h2 className="text-lg sm:text-3xl md:text-4xl lg:text-[42px] font-bold text-white">
            All Packages Come with Guarantees
          </h2>
        </div>

        {/* Guarantee Card Image */}
        <div
          ref={card.ref}
          className={`transition-all duration-700 delay-200 ${card.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <div className="relative group">
            {/* Glow effect behind card */}
            <div className="absolute -inset-2 sm:-inset-4 bg-amber-500/[0.03] rounded-2xl sm:rounded-3xl blur-2xl group-hover:bg-amber-500/[0.05] transition-all duration-700" />

            {/* Card image — using img tag for reliable loading */}
            <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
              <img
                src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/guarantee-card.webp"
                alt="ADS360 Guarantee - Account Replacement, Ad Spend Refund, and Locked Rate guarantees with 100% satisfaction promise"
                className="w-full h-auto"
                loading="eager"
              />

              {/* Subtle shine overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
