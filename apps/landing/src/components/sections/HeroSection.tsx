'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { useScrollReveal } from '../shared/useScrollReveal'

// ==================== STARLIGHT HEADLINER (Rolls-Royce style) ====================
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isVisibleRef = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let isScrolling = false
    let scrollTimer: ReturnType<typeof setTimeout>

    // Pause heavy rendering while scrolling
    const onScroll = () => {
      isScrolling = true
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => { isScrolling = false }, 150)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // Only animate when hero section is visible
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting },
      { threshold: 0 }
    )
    observer.observe(canvas)

    type Star = {
      x: number; y: number; baseSize: number; maxOpacity: number
      twinkleSpeed: number; twinkleOffset: number; isTwinkler: boolean
      r: number; g: number; b: number
    }
    let stars: Star[] = []

    type ShootingStar = {
      x: number; y: number; vx: number; vy: number
      size: number; life: number; maxLife: number; tailLength: number
    }
    const shootingStars: ShootingStar[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initStars()
    }

    const initStars = () => {
      const area = canvas.width * canvas.height
      const isMobile = canvas.width < 768
      const count = Math.floor(area / (isMobile ? 20000 : 8000)) // fewer stars on mobile
      stars = Array.from({ length: count }, () => {
        const sizeRoll = Math.random()
        let baseSize: number
        if (sizeRoll < 0.7) baseSize = Math.random() * 0.5 + 0.2
        else if (sizeRoll < 0.95) baseSize = Math.random() * 0.7 + 0.5
        else baseSize = Math.random() * 0.8 + 0.8

        const colorRoll = Math.random()
        let r: number, g: number, b: number
        if (colorRoll < 0.5) { r = 255; g = 255; b = 255 }
        else if (colorRoll < 0.7) { r = 220; g = 230; b = 255 }
        else if (colorRoll < 0.85) { r = 255; g = 245; b = 220 }
        else { r = 200; g = 210; b = 255 }

        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          baseSize,
          maxOpacity: Math.random() * 0.5 + 0.15,
          twinkleSpeed: Math.random() * 0.008 + 0.003,
          twinkleOffset: Math.random() * Math.PI * 2,
          isTwinkler: Math.random() > 0.6, // fewer twinklers (40% instead of 50%)
          r, g, b,
        }
      })
    }

    // Pre-render static stars to offscreen canvas (draw once, reuse)
    let staticCanvas: HTMLCanvasElement | null = null
    const renderStaticStars = () => {
      staticCanvas = document.createElement('canvas')
      staticCanvas.width = canvas.width
      staticCanvas.height = canvas.height
      const sCtx = staticCanvas.getContext('2d')!
      for (const star of stars) {
        if (star.isTwinkler) continue
        sCtx.beginPath()
        sCtx.arc(star.x, star.y, star.baseSize, 0, Math.PI * 2)
        sCtx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${star.maxOpacity * 0.7})`
        sCtx.fill()
      }
    }

    let time = 0
    const animate = () => {
      // Stop animation loop completely when not visible
      if (!isVisibleRef.current) {
        animId = requestAnimationFrame(animate)
        return
      }

      time += 1

      // While scrolling, skip rendering entirely
      if (isScrolling) {
        animId = requestAnimationFrame(animate)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw static stars from cached canvas
      if (staticCanvas && staticCanvas.width > 0 && staticCanvas.height > 0) ctx.drawImage(staticCanvas, 0, 0)

      // Only animate twinkling stars (skip static ones)
      for (const star of stars) {
        if (!star.isTwinkler) continue
        const wave = Math.sin(time * star.twinkleSpeed + star.twinkleOffset)
        const factor = 0.15 + 0.85 * ((wave + 1) / 2)
        const currentOpacity = star.maxOpacity * factor

        ctx.beginPath()
        ctx.arc(star.x, star.y, star.baseSize, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${currentOpacity})`
        ctx.fill()
      }

      // Shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]
        s.x += s.vx
        s.y += s.vy
        s.life -= 1

        const progress = 1 - s.life / s.maxLife
        let alpha: number
        if (progress < 0.1) alpha = progress / 0.1
        else if (progress > 0.8) alpha = (1 - progress) / 0.2
        else alpha = 1
        alpha *= 0.9

        const tailX = s.x - s.vx * s.tailLength
        const tailY = s.y - s.vy * s.tailLength
        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(1, `rgba(255,255,255,${alpha})`)

        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(s.x, s.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = s.size
        ctx.lineCap = 'round'
        ctx.stroke()

        if (s.life <= 0 || s.x > canvas.width + 50 || s.y > canvas.height + 50 || s.x < -50) {
          shootingStars.splice(i, 1)
        }
      }

      // Spawn shooting stars — focused on left & right sides (slower on mobile)
      const isMob = canvas.width < 768
      if (Math.random() < (isMob ? 0.03 : 0.08) && shootingStars.length < (isMob ? 2 : 6)) {
        const side = Math.random() < 0.5 ? 'left' : 'right'
        let startX: number, startY: number, angle: number

        if (side === 'left') {
          // Left side — falls diagonally to the right
          startX = Math.random() * canvas.width * 0.3
          startY = -10 - Math.random() * 50
          angle = Math.PI / 5 + Math.random() * 0.3
        } else {
          // Right side — falls diagonally to the left
          startX = canvas.width * 0.7 + Math.random() * canvas.width * 0.3
          startY = -10 - Math.random() * 50
          angle = Math.PI - (Math.PI / 5 + Math.random() * 0.3)
        }

        const speed = Math.random() * 3 + 5
        shootingStars.push({
          x: startX, y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 1.5 + 0.5,
          life: Math.floor(Math.random() * 50 + 35),
          maxLife: Math.floor(Math.random() * 50 + 35),
          tailLength: Math.random() * 12 + 8,
        })
      }

      animId = requestAnimationFrame(animate)
    }

    resize()
    renderStaticStars()
    animate()
    window.addEventListener('resize', () => { resize(); renderStaticStars() })
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[1]"
    />
  )
}

// ==================== HERO VIDEO (click-to-play — no eager YouTube load) ====================
function HeroVideo({ videoId = 'QlQAMHzRwiM' }: { videoId?: string }) {
  const playerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return

    // Load YouTube IFrame API only when user clicks play
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScript = document.getElementsByTagName('script')[0]
    firstScript.parentNode?.insertBefore(tag, firstScript)

    let player: any

    function createPlayer() {
      // @ts-ignore
      player = new window.YT.Player(playerRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 0,
          controls: 1,
          showinfo: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => { e.target.unMute(); e.target.setVolume(100); e.target.playVideo() },
          onStateChange: (e: any) => {
            if (e.data === 0) {
              setPlaying(false)
              e.target.destroy()
            }
          },
        },
      })
    }

    // @ts-ignore
    if (window.YT && window.YT.Player) {
      createPlayer()
    } else {
      // @ts-ignore
      window.onYouTubeIframeAPIReady = createPlayer
    }

    return () => {
      if (player && player.destroy) player.destroy()
    }
  }, [playing])

  if (!playing) {
    return (
      <button
        onClick={() => setPlaying(true)}
        className="absolute inset-0 w-full h-full z-10 group/play cursor-pointer"
      >
        <img
          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
          onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/0.jpg` }}
          alt="Video thumbnail"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/play:bg-black/30 transition-colors duration-300">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover/play:scale-110 transition-transform duration-300">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>
    )
  }

  return <div ref={playerRef} className="absolute inset-0 w-full h-full" />
}

// ==================== HERO IMAGE (Browser Mockup) ====================
function HeroImage({ src }: { src: string }) {
  return (
    <div className="absolute inset-0 w-full h-full flex flex-col bg-[#0c1120]">
      {/* Browser chrome bar */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#151d2e] border-b border-white/[0.06] shrink-0">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#febc2e]" />
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#28c840]" />
        </div>
        {/* URL bar */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-[#0c1120] border border-white/[0.06] max-w-[280px] sm:max-w-sm w-full">
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[9px] sm:text-[11px] text-white/60 truncate">vip.ads360.ai/dashboard</span>
          </div>
        </div>
        {/* Right side dots */}
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <div className="w-1 h-1 rounded-full bg-white/20" />
        </div>
      </div>
      {/* Screenshot */}
      <div className="flex-1 overflow-hidden relative">
        <img
          src={src}
          alt="ADS360 Dashboard"
          fetchPriority="high"
          className="w-full h-full object-cover object-top"
        />
        {/* Bottom fade to blend into page */}
        <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-24 bg-gradient-to-t from-[#0c1120] to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

function extractHeroYouTubeId(url?: string): string | null {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

// ==================== HERO SECTION ====================
function HeroSection() {
  const badge = useScrollReveal()
  const heading = useScrollReveal()
  const sub = useScrollReveal()
  const video = useScrollReveal()
  const cta = useScrollReveal()
  const proof = useScrollReveal()

  // Daily rotating headline from API
  const [heroText, setHeroText] = useState({ headline: 'UNSTOPPABLE ADS\nUNSTOPPABLE BUSINESS', subtitle: 'Real agency ad accounts, live in 1 hour — no stress, no bans.' })
  const [heroMedia, setHeroMedia] = useState<{ mode: 'video' | 'image'; videoUrl: string; imageUrl: string }>({ mode: 'image', videoUrl: '', imageUrl: 'https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/hero-dashboard.webp' })
  useEffect(() => {
    const API = typeof window !== 'undefined' && (window.location.hostname.endsWith('6ad.in') || window.location.hostname.endsWith('ads360.ai'))
      ? 'https://api.6ad.in' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001')
    fetch(`${API}/cms/headlines/today`).then(r => r.json()).then(d => {
      if (d.headline) setHeroText({ headline: d.headline, subtitle: d.subtitle })
    }).catch(() => {})
    // Fetch hero media config
    fetch(`${API}/cms/sections/hero-media`).then(r => r.json()).then(d => {
      if (d.section?.data) setHeroMedia(d.section.data)
    }).catch(() => {})
  }, [])

  return (
    <section className="relative min-h-0 sm:min-h-screen flex flex-col items-center justify-start sm:justify-center text-center px-4 pt-24 sm:pt-32 pb-2 sm:pb-10 overflow-hidden">
      {/* Star Field */}
      <StarField />

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Main blue glow - center */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-blue-600/[0.14] rounded-full blur-[180px]" />
        {/* Cyan glow - right */}
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-cyan-600/[0.08] rounded-full blur-[150px]" />
        {/* Indigo glow - left */}
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-indigo-600/[0.08] rounded-full blur-[140px]" />
        {/* Bottom blue band */}
        <div className="absolute bottom-0 left-0 right-0 h-[300px] bg-gradient-to-t from-blue-900/[0.15] to-transparent" />
        {/* Sky aurora / lightning streaks */}
        <div className="absolute top-[10%] left-[15%] w-[2px] h-[200px] bg-gradient-to-b from-blue-400/30 via-cyan-400/10 to-transparent rotate-[15deg] blur-[2px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-[5%] right-[20%] w-[1.5px] h-[180px] bg-gradient-to-b from-sky-400/25 via-blue-400/8 to-transparent -rotate-[10deg] blur-[2px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-[15%] left-[55%] w-[1px] h-[150px] bg-gradient-to-b from-cyan-300/20 via-blue-500/5 to-transparent rotate-[5deg] blur-[1.5px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-[8%] right-[40%] w-[1px] h-[120px] bg-gradient-to-b from-blue-300/15 via-indigo-400/5 to-transparent -rotate-[8deg] blur-[1px] animate-pulse" style={{ animationDuration: '7s', animationDelay: '3s' }} />
      </div>

      {/* Floating 3D space elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* 3D Satellite — top right */}
        <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/satellite.webp" alt="" loading="lazy" className="absolute top-[12%] right-[8%] w-16 sm:w-24 opacity-30 hero-float-1 hidden sm:block drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" style={{ filter: 'saturate(0.3) brightness(0.8) sepia(0.5) hue-rotate(190deg)' }} />
        {/* 3D Rocket — left side */}
        <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/rocket.webp" alt="" loading="lazy" className="absolute top-[50%] left-[4%] w-14 sm:w-20 opacity-25 hero-float-2 hidden sm:block drop-shadow-[0_0_12px_rgba(59,130,246,0.25)]" style={{ filter: 'saturate(0.3) brightness(0.8) sepia(0.5) hue-rotate(190deg)' }} />
        {/* 3D Planet — bottom right */}
        <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/planet.webp" alt="" loading="lazy" className="absolute bottom-[12%] right-[5%] w-20 sm:w-28 opacity-20 hero-float-3 hidden sm:block drop-shadow-[0_0_20px_rgba(59,130,246,0.2)]" />
        {/* 3D Star — left top area */}
        <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/astronaut.webp" alt="" loading="lazy" className="absolute top-[30%] left-[10%] w-10 sm:w-14 opacity-20 hero-float-3 hidden lg:block drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" style={{ animationDelay: '1.5s', filter: 'saturate(0.3) brightness(0.8) sepia(0.5) hue-rotate(190deg)' }} />
        {/* Small satellite — right middle */}
        <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/satellite.webp" alt="" loading="lazy" className="absolute top-[65%] right-[12%] w-8 sm:w-12 opacity-15 hero-float-1 hidden lg:block" style={{ animationDelay: '3s', filter: 'saturate(0.3) brightness(0.8) sepia(0.5) hue-rotate(190deg)' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto w-full">
        {/* Badge — visible immediately for LCP */}
        <div
          ref={badge.ref}
          className="opacity-100"
        >
          <div className="inline-flex items-center gap-2 sm:gap-2.5 glass rounded-full px-3 sm:px-5 py-1 sm:py-2 mb-2 sm:mb-4">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-gray-400 text-xs sm:text-sm tracking-wide">ADS360 – Real Agency Ad Account</span>
          </div>
        </div>

        {/* Heading — visible immediately for LCP */}
        <div
          ref={heading.ref}
          className="opacity-100"
        >
          <h1 className="text-white text-[18px] sm:text-[36px] md:text-[42px] lg:text-[46px] font-normal leading-[1.25] sm:leading-[1.4] mb-1.5 sm:mb-3 tracking-[0.06em] sm:tracking-[0.08em] drop-shadow-[0_0_40px_rgba(59,130,246,0.15)]" style={{ fontFamily: 'var(--font-pixel)' }}>
            {heroText.headline.split('\n').map((line, i) => (
              <span key={i}>{line}{i < heroText.headline.split('\n').length - 1 && <br />}</span>
            ))}
          </h1>
        </div>

        {/* Subtext — visible immediately for LCP */}
        <div
          ref={sub.ref}
          className="opacity-100"
        >
          <p className="text-gray-300 text-[11px] sm:text-base md:text-lg max-w-2xl mx-auto mb-3 sm:mb-6 leading-relaxed sm:whitespace-nowrap">
            {heroText.subtitle}
          </p>
        </div>

        {/* Video Container with Ambilight Effect — NO opacity-0 start, must be visible for LCP */}
        <div
          ref={video.ref}
          className="opacity-100"
        >
          <div className="w-full mx-auto mb-5 sm:mb-6 relative">
            {/* AMBILIGHT — premium glow behind frame */}
            <div className="absolute -inset-3 sm:-inset-6 z-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-blue-500/15 blur-[25px] sm:blur-[40px] scale-[1.02]" />
              <div className="absolute top-0 left-1/4 w-1/2 h-1/3 bg-cyan-400/10 blur-[30px] sm:blur-[50px]" />
              <div className="absolute bottom-0 right-1/4 w-1/2 h-1/3 bg-indigo-500/10 blur-[30px] sm:blur-[50px]" />
            </div>

            {/* Main frame — glass border */}
            <div className="relative z-10 rounded-2xl p-[1px] bg-gradient-to-b from-white/[0.15] to-white/[0.04]" style={{ boxShadow: '0 0 40px rgba(59,130,246,0.08), 0 20px 60px rgba(0,0,0,0.3)' }}>
              <div className="rounded-2xl overflow-hidden">
                <div className="relative aspect-video bg-dark-800 rounded-2xl overflow-hidden">
                  {heroMedia?.mode === 'image' && heroMedia.imageUrl ? (
                    <HeroImage src={heroMedia.imageUrl} />
                  ) : (
                    <HeroVideo videoId={extractHeroYouTubeId(heroMedia?.videoUrl) || 'QlQAMHzRwiM'} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA + Social Proof Row */}
        <div
          ref={cta.ref}
          className="opacity-100"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-5 mb-3 sm:mb-8">
            {/* CTA Button — large with shimmer animation */}
            <a
              href="#contact"
              className="relative group/cta inline-flex items-center gap-2 sm:gap-3 rounded-full px-5 py-2.5 sm:px-7 sm:py-4 text-white font-semibold text-sm sm:text-base overflow-hidden"
            >
              {/* Shimmer sweep */}
              <span className="cta-shimmer absolute inset-0 z-10"
                style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)' }} />
              {/* Background + border */}
              <span className="absolute inset-0 rounded-full"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(139,92,246,0.2) 100%)', border: '1px solid rgba(255,255,255,0.18)' }} />
              {/* Hover fill */}
              <span className="absolute inset-0 rounded-full opacity-0 group-hover/cta:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(139,92,246,0.35) 100%)' }} />
              {/* Outer glow */}
              <span className="absolute inset-0 rounded-full opacity-0 group-hover/cta:opacity-100 transition-opacity duration-300 blur-lg -z-10"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.5), rgba(139,92,246,0.4))' }} />
              {/* Icon box */}
              <span className="relative z-20 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center group-hover/cta:bg-white/20 transition-colors duration-300">
                <ArrowRight className="w-4 h-4 text-white" />
              </span>
              <span className="relative z-20">Get Ad Account in 5mins</span>
            </a>

            {/* Social Proof — futuristic */}
            <div
              ref={proof.ref}
              className="relative inline-flex items-center gap-2 sm:gap-3 rounded-full px-3 sm:px-5 py-2 sm:py-3 overflow-hidden opacity-100"
            >
              {/* Border glow */}
              <span className="absolute inset-0 rounded-full p-[1px] overflow-hidden">
                <span className="absolute inset-0 rounded-full bg-gradient-to-r from-white/10 via-cyan-400/20 to-white/10" />
                <span className="absolute inset-[1px] rounded-full bg-[#0a0a1e]/85 backdrop-blur-sm" />
              </span>
              {/* Holographic shine */}
              <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent header-shine-sweep" />
              </span>
              <div className="relative flex -space-x-2">
                {['/arjun-thakur.webp', '/nikhil-kumar.webp', '/rohit-mehta.webp', '/vikram-desai.webp'].map((src, i) => (
                  <img key={i} src={src} alt="Client" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-[#0a0a1e] object-cover shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                ))}
              </div>
              <div className="relative flex items-center gap-1.5">
                <span className="text-white font-bold text-xs sm:text-sm drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">450+</span>
                <span className="text-gray-400 text-[10px] sm:text-xs tracking-wide">Satisfied clients</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-2 sm:h-10" />

      {/* Logo Marquee — merged into hero, futuristic */}
      <div className="relative overflow-hidden py-2 sm:py-8" style={{ width: 'calc(100% + 2rem)', marginLeft: '-1rem', marginRight: '-1rem' }}>
        {/* Top line glow */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-48 bg-gradient-to-r from-[#0a0a1a] via-[#0a0a1a]/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-48 bg-gradient-to-l from-[#0a0a1a] via-[#0a0a1a]/80 to-transparent z-10 pointer-events-none" />
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(3)].flatMap((_, setIdx) =>
            [
              { name: 'The Souled Store', src: '/images/clients/souledstore.svg' },
              { name: 'Snitch', src: '/images/clients/snitch.webp' },
              { name: 'AdsPower', src: '/images/clients/adspower.svg' },
              { name: 'Adil Qadri', src: '/images/clients/adilqadri.webp' },
              { name: 'Bummer', src: '/images/clients/bummer.svg' },
              { name: 'GoDesi', src: '/images/clients/godesi.svg' },
              { name: 'Dolphin Anty', src: '/images/clients/dolphin-anty.svg' },
              { name: 'The Manga Store', src: '/images/clients/mangastore.webp' },
            ].map((logo, i) => (
              <div key={`${setIdx}-${i}`} className="flex items-center mx-5 sm:mx-12 shrink-0 group">
                <img
                  src={logo.src}
                  alt={logo.name}
                  className="h-4 sm:h-7 w-auto object-contain opacity-40 group-hover:opacity-80 transition-opacity duration-300 brightness-0 invert"
                />
              </div>
            ))
          )}
        </div>
        {/* Bottom line glow */}
        <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/15 to-transparent" />
      </div>

    </section>
  )
}


// Client logos are now loaded as images from /images/clients/

export default HeroSection
