'use client'

import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useScrollReveal } from '../shared/useScrollReveal'
import { useRef } from 'react'

export default function ServicesSection() {
  const sectionHead = useScrollReveal()
  const mobileScrollRef = useRef<HTMLDivElement>(null)

  const scrollMobile = (dir: 'left' | 'right') => {
    const el = mobileScrollRef.current
    if (!el) return
    const cardWidth = 155 // card width + gap
    el.scrollBy({ left: dir === 'right' ? cardWidth : -cardWidth, behavior: 'smooth' })
  }

  const services = [
    {
      name: 'Meta',
      platform: 'Meta Agency Accounts',
      desc: 'Unlock the full potential of your brand with premium Meta Advertising, reaching billions across Facebook, Instagram, Messenger, and WhatsApp. Benefit from whitelisted accounts for higher trust and faster scaling.',
      ringColor: '#0081FB',
      iconColor: '#0081FB',
      icon: <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/meta-logo.webp" alt="Meta" className="w-full h-full object-contain" />,
    },
    {
      name: 'Google',
      platform: 'Google Agency Accounts',
      desc: 'Tap into the power of Google\'s vast network with whitelisted Google ad accounts that deliver higher approval rates, wider reach, and better conversions across Search, YouTube, Display, and Shopping campaigns.',
      ringColor: '#4285F4',
      iconColor: '#4285F4',
      icon: <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/google-logo.webp" alt="Google" className="w-full h-full object-contain" />,
    },
    {
      name: 'TikTok',
      platform: 'TikTok Agency Accounts',
      desc: 'Engage the fastest-growing audience with TikTok\'s high-impact ad formats through our TikTok agency ad accounts. Our whitelisted accounts help you run compliant, scalable campaigns with higher reach and engagement from day one.',
      ringColor: '#ff0050',
      iconColor: '#ff0050',
      icon: <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/tiktok-logo.webp" alt="TikTok" className="w-full h-full object-contain" />,
    },
    {
      name: 'Snapchat',
      platform: 'Snapchat Agency Accounts',
      desc: 'Reach Gen-Z and millennial audiences with Snapchat\'s immersive ad formats. Our agency accounts offer higher trust scores, faster approvals, and premium placement across Snap\'s advertising ecosystem.',
      ringColor: '#FFFC00',
      iconColor: '#FFFC00',
      icon: <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/snapchat.webp" alt="Snapchat" className="w-full h-full object-contain" />,
    },
    {
      name: 'Bing',
      platform: 'Bing Agency Accounts',
      desc: 'Capture high-intent audiences across Bing, Outlook, and the Microsoft Advertising network. Our whitelisted agency accounts deliver faster approvals, higher spend limits, and premium support.',
      ringColor: '#00897B',
      iconColor: '#00BFA5',
      icon: <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/bing-logo.webp" alt="Bing" className="w-full h-full object-contain" />,
    },
  ]

  return (
    <section id="services" className="relative pt-6 sm:pt-16 pb-2 sm:pb-8 overflow-hidden px-0">
      {/* Space Background — orbits centered on header area */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Nebula glow behind header */}
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/[0.06] rounded-full blur-[120px]" />

        {/* Static twinkling stars — reduced for performance */}
        {[
          { top: '8%', left: '12%', size: 2, delay: '0s' },
          { top: '15%', left: '45%', size: 2.5, delay: '1.2s' },
          { top: '6%', left: '82%', size: 2, delay: '0.5s' },
          { top: '30%', left: '25%', size: 1.5, delay: '2s' },
          { top: '45%', left: '68%', size: 2, delay: '3s' },
          { top: '60%', left: '10%', size: 1.5, delay: '1.5s' },
          { top: '75%', left: '55%', size: 2, delay: '3.5s' },
          { top: '85%', left: '90%', size: 1.5, delay: '0.8s' },
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

        {/* Single orbital ring — lightweight */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] services-orbit">
          <div className="absolute inset-0 rounded-full border border-blue-400/[0.06]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-400/50 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]" />
        </div>

        {/* Floating particles — reduced */}
        <div className="absolute bottom-0 left-[20%] w-1.5 h-1.5 bg-blue-400/30 rounded-full services-float-up" />
        <div className="absolute bottom-0 left-[50%] w-1 h-1 bg-cyan-400/25 rounded-full services-float-up" style={{ animationDelay: '4s', animationDuration: '13s' }} />
        <div className="absolute bottom-0 left-[80%] w-1.5 h-1.5 bg-blue-300/25 rounded-full services-float-up" style={{ animationDelay: '7s', animationDuration: '12s' }} />
      </div>

      <div className="relative z-10">
        {/* Section Header */}
        <div
          ref={sectionHead.ref}
          className={`text-center mb-6 sm:mb-14 px-4 transition-all duration-700 ${sectionHead.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-6">
            <span className="w-4 sm:w-6 h-[1px] bg-gradient-to-r from-transparent to-cyan-500/60" />
            <span className="text-cyan-400/80 text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase">Our Services</span>
            <span className="w-4 sm:w-6 h-[1px] bg-gradient-to-l from-transparent to-cyan-500/60" />
          </div>
          <h2 className="text-white text-xl sm:text-4xl md:text-5xl font-bold leading-tight mb-1 sm:mb-4">
            Scale Your Ads with{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Agency Accounts
            </span>
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm md:text-base max-w-xl mx-auto">
            Premium agency ad accounts across all major platforms. Live in 1 hour, unlimited spend.
          </p>
        </div>

        {/* ===== MOBILE: Touch scroll + arrows ===== */}
        <div className="sm:hidden pb-2">
          <div ref={mobileScrollRef} className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 snap-x snap-mandatory scroll-smooth">
            {services.map((service, idx) => (
              <div key={service.name} className="w-[145px] flex-shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center snap-start">
                <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2 p-2" style={{ background: `${service.ringColor}12`, border: `1px solid ${service.ringColor}25` }}>
                  {service.icon}
                </div>
                <h3 className="text-white text-[11px] font-bold leading-tight">{service.name} Agency</h3>
                <p className="text-gray-400 text-[9px] mt-1 line-clamp-2 leading-relaxed">{service.desc}</p>
                <a href="#contact" className="inline-flex items-center gap-1 mt-2 text-[9px] font-semibold px-2.5 py-1 rounded-md" style={{ color: service.ringColor, background: `${service.ringColor}10`, border: `1px solid ${service.ringColor}20` }}>
                  Start <ArrowRight className="w-2.5 h-2.5" />
                </a>
              </div>
            ))}
          </div>
          {/* Arrow buttons */}
          <div className="flex justify-center gap-3 mt-3">
            <button aria-label="Previous service" onClick={() => scrollMobile('left')} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button aria-label="Next service" onClick={() => scrollMobile('right')} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===== DESKTOP: Continuous smooth infinite scroll ===== */}
        <div className="hidden sm:block overflow-hidden w-full group/carousel">
          <div
            className="flex gap-5 pl-10 lg:pl-16 service-marquee hover:[animation-play-state:paused]"
          >
          {/* Duplicate cards for seamless loop */}
          {[...services, ...services].map((service, idx) => (
            <div
              key={`${service.name}-${idx}`}
              className="flex-shrink-0 w-[320px] md:w-[360px]"
            >
              <div className="group relative rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 h-full">
                {/* Card border glow */}
                <div className="absolute inset-0 rounded-2xl p-[1px] overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-2xl opacity-30 group-hover:opacity-60 transition-opacity duration-500"
                    style={{ background: `linear-gradient(135deg, ${service.ringColor}40, transparent 50%, ${service.ringColor}20)` }}
                  />
                  <div className="absolute inset-[1px] rounded-2xl bg-[#0a0e1a]" />
                </div>

                <div className="relative z-10 flex flex-col h-full">
                  {/* Icon Area — full width, no padding */}
                  <div className="relative w-full aspect-[16/10] sm:aspect-[16/10] flex items-center justify-center overflow-hidden rounded-t-2xl"
                    style={{ background: 'linear-gradient(180deg, #080c18 0%, #040608 100%)' }}
                  >
                    {/* Top edge glow line */}
                    <div className="absolute top-0 inset-x-[15%] h-[1px] z-20"
                      style={{ background: `linear-gradient(90deg, transparent, ${service.ringColor}50, transparent)` }}
                    />

                    {/* Cross-hair lines (horizontal + vertical) */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-0 right-0 h-[1px] opacity-[0.03]"
                        style={{ background: `linear-gradient(90deg, transparent, ${service.ringColor}, transparent)` }}
                      />
                      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] opacity-[0.03]"
                        style={{ background: `linear-gradient(180deg, transparent, ${service.ringColor}, transparent)` }}
                      />
                    </div>

                    {/* Dot grid pattern */}
                    <div className="absolute inset-0 opacity-[0.05]"
                      style={{
                        backgroundImage: 'radial-gradient(circle, white 0.8px, transparent 0.8px)',
                        backgroundSize: '20px 20px',
                      }}
                    />

                    {/* Concentric rings — outer to inner, increasing opacity */}
                    {[160, 130, 100].map((size, i) => (
                      <div
                        key={i}
                        className="absolute rounded-full transition-all duration-700 group-hover:scale-110"
                        style={{
                          width: `${size}px`,
                          height: `${size}px`,
                          border: `1px solid ${service.ringColor}${i === 0 ? '0a' : i === 1 ? '15' : '22'}`,
                        }}
                      />
                    ))}

                    {/* Pulsing ring on hover */}
                    <div
                      className="absolute w-[100px] h-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 service-ring-pulse"
                      style={{
                        border: `1px solid ${service.ringColor}30`,
                      }}
                    />

                    {/* Soft color bloom */}
                    <div
                      className="absolute w-40 h-40 rounded-full blur-[60px] opacity-[0.08] group-hover:opacity-[0.18] transition-opacity duration-700"
                      style={{ background: service.ringColor }}
                    />

                    {/* Icon container — glass circle */}
                    <div
                      className="relative w-[60px] h-[60px] sm:w-[76px] sm:h-[76px] rounded-full flex items-center justify-center z-10 transition-all duration-500 group-hover:scale-110"
                      style={{
                        background: `radial-gradient(circle at 30% 30%, ${service.ringColor}12, #080c18 70%)`,
                        border: `1.5px solid ${service.ringColor}25`,
                        boxShadow: `0 0 35px ${service.ringColor}12, 0 0 15px ${service.ringColor}08`,
                      }}
                    >
                      <div className="w-[40px] h-[40px] sm:w-[52px] sm:h-[52px]">
                        {service.icon}
                      </div>
                    </div>

                    {/* Bottom vignette fade */}
                    <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#0a0e1a] to-transparent pointer-events-none" />
                  </div>

                  {/* Text content with padding */}
                  <div className="px-3 sm:px-6 md:px-8 pt-3 sm:pt-5">
                  {/* Title */}
                  <h3 className="text-white text-sm sm:text-xl md:text-2xl font-bold mb-1 sm:mb-3">
                    {service.platform}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 text-[10px] sm:text-sm leading-relaxed mb-2 sm:mb-6 flex-grow">
                    {service.desc}
                  </p>

                  {/* CTA Button */}
                  <a
                    href="#contact"
                    className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-semibold transition-all duration-300 group/btn w-fit"
                    style={{
                      background: `linear-gradient(135deg, ${service.ringColor}15, ${service.ringColor}08)`,
                      border: `1px solid ${service.ringColor}30`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${service.ringColor}25, ${service.ringColor}15)`
                      e.currentTarget.style.borderColor = `${service.ringColor}50`
                      e.currentTarget.style.boxShadow = `0 0 20px ${service.ringColor}20`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${service.ringColor}15, ${service.ringColor}08)`
                      e.currentTarget.style.borderColor = `${service.ringColor}30`
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <span className="text-white/90">Get Started</span>
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-white/70 group-hover/btn:translate-x-1 transition-transform duration-300" />
                  </a>
                  </div>{/* close padding div */}
                </div>

                {/* Holographic sweep */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.015] to-transparent header-shine-sweep" />
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>

        {/* Edge fade overlays */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#060818] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#060818] to-transparent z-10" />
      </div>
    </section>
  )
}
