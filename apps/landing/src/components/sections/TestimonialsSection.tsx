'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const testimonials = [
  {
    title: 'Never losing millions to bans again',
    quote: "I've tried at least five providers before. None of them lasted more than a few weeks. With ADS360, it's the first time I've had both stable accounts and actual support. Even Meta reps answer now. Total game-changer.",
    name: 'Prashant S.',
    role: 'Founder, ScaleUp Media',
    avatar: '/prashant-sachan.png',
    rating: 5.0,
  },
  {
    title: 'We are literally getting paid to use this service',
    quote: "For us the whole service is now free of charge, we are now spending $300k/month which means $3k in cashback. The account service runs me $1k/month, so after cashback we are pocketing $2k. Feels like I'm being paid to use accounts that don't die.",
    name: 'Vedang P.',
    role: 'CEO, VedComm Digital',
    avatar: '/vedang-patel.png',
    rating: 5.0,
  },
  {
    title: 'Running D2C offers without fear now',
    quote: "Before paying, they actually answered every question I had. Account was live in under 2 hours. Been running 7 months without any issues. Only regret is not joining earlier.",
    name: 'Nikhil K.',
    role: '$180k/month ad spend',
    avatar: '/nikhil-kumar.jpg',
    rating: 5.0,
  },
  {
    title: "Didn't think these accounts would last... they do",
    quote: "I was always wondering why these accounts don't get banned too, what is the reason. The answer: real Meta reps backing them. I've been running for months now without any major issues. Whenever something occurred, the team always supported.",
    name: 'Rohit M.',
    role: 'Director, Adwise Agency',
    avatar: '/rohit-mehta.jpg',
    rating: 5.0,
  },
  {
    title: 'From testing to $20k/day in 2 weeks',
    quote: "Scaling used to be our biggest headache. With ADS360, we went from test campaigns to $20k/day in under 2 weeks. Instant approvals + no spend caps is the real deal.",
    name: 'Arjun T.',
    role: 'Co-founder, BrandScale India',
    avatar: '/arjun-thakur.jpg',
    rating: 5.0,
  },
  {
    title: 'Pixel PTSD is finally over',
    quote: "We lost our pixel data to bans so many times, it nearly shut down our store. With ADS360 accounts, the same pixel has been safe for over a year. That alone makes the switch worth it.",
    name: 'Vikram D.',
    role: 'Founder, DropShip Bharat',
    avatar: '/vikram-desai.jpg',
    rating: 5.0,
  },
]

/* Trustpilot-style green star block */
function TrustStars({ count = 5, size = 16 }: { count?: number; size?: number }) {
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-center"
          style={{ width: size, height: size, backgroundColor: '#00b67a' }}
        >
          <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 12 12" fill="none">
            <path d="M6 0.5L7.5 4.2H11.5L8.2 6.6L9.5 10.5L6 8L2.5 10.5L3.8 6.6L0.5 4.2H4.5L6 0.5Z" fill="white" />
          </svg>
        </div>
      ))}
    </div>
  )
}

export default function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  const scrollBy = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir === 'right' ? 240 : -240, behavior: 'smooth' })
  }

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setIsVisible(true) }, { threshold: 0.1 })
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="testimonials" className="relative pt-10 sm:pt-14 pb-10 sm:pb-14 overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-green-600/[0.02] rounded-full blur-[200px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/[0.02] rounded-full blur-[200px]" />
        {/* Floating quote marks */}
        <div className="test-quote-float absolute top-[15%] left-[8%] text-[100px] font-serif text-white/[0.08] leading-none select-none">&ldquo;</div>
        <div className="test-quote-float absolute top-[55%] right-[8%] text-[80px] font-serif text-white/[0.06] leading-none select-none" style={{animationDelay: '4s'}}>&rdquo;</div>
        <div className="test-quote-float absolute bottom-[15%] left-[15%] text-[70px] font-serif text-white/[0.06] leading-none select-none" style={{animationDelay: '7s'}}>&ldquo;</div>
        <div className="test-quote-float absolute top-[35%] right-[25%] text-[60px] font-serif text-white/[0.05] leading-none select-none" style={{animationDelay: '2s'}}>&rdquo;</div>
        {/* Shimmer line */}
        <div className="absolute top-[40%] left-0 right-0 h-[1px] overflow-hidden opacity-[0.12]">
          <div className="test-shimmer w-1/4 h-full bg-gradient-to-r from-transparent via-white to-transparent" />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* ===== MOBILE Header ===== */}
        <div className={`sm:hidden text-center mb-5 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="text-dark-900 text-[10px] font-semibold tracking-wide border border-white/[0.15] rounded-full px-3 py-1 bg-white inline-block mb-3">
            Testimonials
          </span>
          <h2 className="text-lg font-bold text-white leading-tight">What Our Clients Say</h2>
          <div className="inline-flex items-center gap-2 mt-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5">
            <span className="text-white/70 text-xs font-semibold">4.8/5</span>
            <TrustStars count={5} size={12} />
          </div>
        </div>

        {/* ===== MOBILE: Horizontal scroll cards with arrows ===== */}
        <div className="sm:hidden">
          <div ref={scrollRef} className="overflow-x-auto scrollbar-hide -mx-4 px-4 snap-x snap-mandatory pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-2.5" style={{ width: 'max-content' }}>
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className={`w-[220px] flex-shrink-0 snap-start bg-[#1a1d23] border border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{ transitionDelay: `${200 + i * 80}ms` }}
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrustStars count={5} size={11} />
                      <span className="text-white/50 text-[9px] font-medium">{t.rating.toFixed(1)}</span>
                    </div>
                    <h3 className="text-white font-bold text-[11px] mb-1.5 leading-snug">{t.title}</h3>
                    <p className="text-white/45 text-[9px] leading-relaxed line-clamp-4">&ldquo;{t.quote}&rdquo;</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/[0.06]">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-white/[0.08] flex-shrink-0">
                      <Image src={t.avatar} alt={t.name} width={28} height={28} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-white text-[10px] font-semibold">{t.name}</p>
                      <p className="text-white/40 text-[8px]">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-3 mt-2">
            <button aria-label="Previous testimonial" onClick={() => scrollBy('left')} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center active:scale-90 transition-transform">
              <ChevronLeft className="w-4 h-4 text-white/70" />
            </button>
            <button aria-label="Next testimonial" onClick={() => scrollBy('right')} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center active:scale-90 transition-transform">
              <ChevronRight className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* ===== DESKTOP Header ===== */}
        <div className={`hidden sm:block text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="text-dark-900 text-[13px] font-semibold tracking-wide border border-white/[0.15] rounded-full px-5 py-2 bg-white inline-block mb-4">
            Testimonials
          </span>
          <div className="flex items-center justify-center">
            <div className="relative">
              <Image src="/690cf0bb31f0417409ced5c9_testimonial_left.svg" alt="" width={80} height={80} className="absolute -left-14 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none select-none" />
              <Image src="/690cf0bb5c926070fe3addb5_testimonial_right.svg" alt="" width={80} height={80} className="absolute -right-14 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none select-none" />
              <h2 className="relative z-10 text-3xl md:text-4xl font-bold text-white leading-tight">What Our Clients Say</h2>
            </div>
          </div>
          <p className="text-white/40 text-[15px] mt-5 max-w-lg mx-auto leading-relaxed">
            See Testimonials from hundreds of entrepreneurs who already made the switch
          </p>
          <div className="inline-flex items-center gap-2.5 mt-6 bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-2.5">
            <span className="text-white/70 text-[15px] font-semibold">4.8/5</span>
            <TrustStars count={5} size={18} />
            <span className="text-white/40 text-[15px] font-medium">Rating</span>
          </div>
        </div>

        {/* ===== DESKTOP: 3x2 Grid ===== */}
        <div className="hidden sm:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className={`bg-[#1a1d23] border border-white/[0.08] rounded-2xl p-8 flex flex-col justify-between hover:border-white/[0.14] transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <TrustStars count={5} size={20} />
                  <span className="text-white/60 text-[15px] font-medium">{t.rating.toFixed(1)}</span>
                </div>
                <h3 className="text-white font-bold text-lg mb-3 leading-snug">{t.title}</h3>
                <p className="text-white/50 text-[15px] leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              </div>
              <div className="flex items-center gap-3.5 mt-8">
                <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-white/[0.08] flex-shrink-0">
                  <Image src={t.avatar} alt={t.name} width={52} height={52} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-white text-base font-semibold">{t.name}</p>
                  <p className="text-white/45 text-sm">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
