'use client'

import { useEffect, useState } from 'react'

type Heading = { id: string; text: string; level: number }

export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>('')
  const [readProgress, setReadProgress] = useState(0)

  // Track reading progress
  useEffect(() => {
    const onScroll = () => {
      const el = document.querySelector('main') || document.body
      const scrollTop = window.scrollY
      const docHeight = el.scrollHeight - window.innerHeight
      setReadProgress(docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Intersection observer to track active heading
  useEffect(() => {
    if (headings.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-10% 0% -70% 0%', threshold: 0 }
    )
    headings.forEach(h => {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
              </svg>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">On this page</span>
          </div>
          {/* Progress badge */}
          <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
            {readProgress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${readProgress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #818cf8)'
            }}
          />
        </div>
      </div>

      {/* TOC items — h2 only */}
      <nav className="p-3 space-y-0.5 max-h-[70vh] overflow-y-auto toc-scroll">
        {headings.filter(h => h.level === 2).map((h) => {
          const isActive = activeId === h.id
          return (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                setActiveId(h.id)
              }}
              className={`group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] leading-snug transition-all duration-150 ${
                isActive
                  ? 'bg-blue-500/10 text-blue-300'
                  : 'text-white/35 hover:text-white/75 hover:bg-white/[0.04]'
              }`}
            >
              <span className={`mt-[5px] w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-150 ${
                isActive ? 'bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-white/20 group-hover:bg-white/40'
              }`} />
              <span className="font-medium leading-[1.4]">{h.text}</span>
              {isActive && (
                <svg className="ml-auto mt-[4px] w-3 h-3 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </a>
          )
        })}
      </nav>

      {/* Footer CTA */}
      <div className="px-3 pb-3">
        <a
          href="/#contact"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[12px] font-semibold text-white transition-all duration-200 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(99,102,241,0.3))', border: '1px solid rgba(59,130,246,0.25)' }}
        >
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Get Ad Account
        </a>
      </div>
    </div>
  )
}
