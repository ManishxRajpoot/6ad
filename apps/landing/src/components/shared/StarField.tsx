'use client'

import { useEffect, useRef } from 'react'

export default function StarField() {
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

    const onScroll = () => {
      isScrolling = true
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => { isScrolling = false }, 150)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

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
      canvas.width = canvas.parentElement?.offsetWidth || window.innerWidth
      canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight
      initStars()
    }

    const initStars = () => {
      const area = canvas.width * canvas.height
      const isMobile = canvas.width < 768
      const count = Math.floor(area / (isMobile ? 20000 : 8000))
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
          isTwinkler: Math.random() > 0.6,
          r, g, b,
        }
      })
    }

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
      if (!isVisibleRef.current) { animId = requestAnimationFrame(animate); return }
      time += 1
      if (isScrolling) { animId = requestAnimationFrame(animate); return }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (staticCanvas && staticCanvas.width > 0 && staticCanvas.height > 0) ctx.drawImage(staticCanvas, 0, 0)

      for (const star of stars) {
        if (!star.isTwinkler) continue
        const wave = Math.sin(time * star.twinkleSpeed + star.twinkleOffset)
        const factor = 0.15 + 0.85 * ((wave + 1) / 2)
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.baseSize, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${star.maxOpacity * factor})`
        ctx.fill()
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]
        s.x += s.vx; s.y += s.vy; s.life -= 1
        const progress = 1 - s.life / s.maxLife
        let alpha = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1
        alpha *= 0.9
        const tailX = s.x - s.vx * s.tailLength, tailY = s.y - s.vy * s.tailLength
        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(1, `rgba(255,255,255,${alpha})`)
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(s.x, s.y)
        ctx.strokeStyle = grad; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.stroke()
        if (s.life <= 0 || s.x > canvas.width + 50 || s.y > canvas.height + 50 || s.x < -50) shootingStars.splice(i, 1)
      }

      const isMob = canvas.width < 768
      if (Math.random() < (isMob ? 0.03 : 0.08) && shootingStars.length < (isMob ? 2 : 6)) {
        const side = Math.random() < 0.5 ? 'left' : 'right'
        let startX: number, startY: number, angle: number
        if (side === 'left') { startX = Math.random() * canvas.width * 0.3; startY = -10 - Math.random() * 50; angle = Math.PI / 5 + Math.random() * 0.3 }
        else { startX = canvas.width * 0.7 + Math.random() * canvas.width * 0.3; startY = -10 - Math.random() * 50; angle = Math.PI - (Math.PI / 5 + Math.random() * 0.3) }
        const speed = Math.random() * 3 + 5
        shootingStars.push({ x: startX, y: startY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: Math.random() * 1.5 + 0.5, life: Math.floor(Math.random() * 50 + 35), maxLife: Math.floor(Math.random() * 50 + 35), tailLength: Math.random() * 12 + 8 })
      }

      animId = requestAnimationFrame(animate)
    }

    resize(); renderStaticStars(); animate()
    window.addEventListener('resize', () => { resize(); renderStaticStars() })
    return () => { cancelAnimationFrame(animId); window.removeEventListener('scroll', onScroll); observer.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-[1]" />
}
