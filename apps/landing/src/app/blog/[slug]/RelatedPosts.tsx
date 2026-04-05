'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

type Post = {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImage: string | null
  category: string | null
  authorName: string
  readTime: number
  publishedAt: string
}

const CARD_GAP = 20
const CARD_WIDTH = 300

export function RelatedPosts({ currentSlug }: { currentSlug: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const API = typeof window !== 'undefined' && (window.location.hostname.endsWith('6ad.in') || window.location.hostname.endsWith('ads360.ai'))
    ? 'https://api.6ad.in'
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001')

  useEffect(() => {
    fetch(`${API}/cms/blog?limit=10`)
      .then(r => r.json())
      .then(d => {
        const filtered = (d.posts || []).filter((p: Post) => p.slug !== currentSlug)
        setPosts(filtered.slice(0, 6))
      })
      .catch(() => {})
  }, [currentSlug])

  // Reveal on scroll
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  // Auto-advance
  useEffect(() => {
    if (posts.length <= 3) return
    autoRef.current = setInterval(() => {
      setActive(a => (a + 1) % Math.max(1, posts.length - 2))
    }, 4000)
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [posts.length])

  const goTo = (idx: number) => {
    setActive(idx)
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null }
  }

  if (posts.length === 0) return null

  const maxActive = Math.max(0, posts.length - 3)
  const dots = Array.from({ length: maxActive + 1 })

  return (
    <div ref={sectionRef} className="mt-14 pt-10 border-t border-white/[0.07]">
      {/* Header */}
      <div className={`flex items-center justify-between mb-7 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
        <div className="flex items-center gap-3">
          {/* Accent bar */}
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500" />
          <h2 className="text-xl font-bold text-white">More Articles</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold">
            {posts.length} posts
          </span>
        </div>
        <Link
          href="/blog"
          className="flex items-center gap-1.5 text-[13px] text-white/40 hover:text-blue-400 transition-colors group"
        >
          View all
          <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Cards grid (desktop: 3, mobile: 1) */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
          style={{ transform: `translateX(calc(-${active} * (100% / 3 + ${CARD_GAP / 3}px)))`, gap: `${CARD_GAP}px` }}
        >
          {posts.map((post, idx) => {
            const delay = (idx % 3) * 80
            const isHovered = hovered === post.id
            return (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className={`shrink-0 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{
                  width: 'calc(33.333% - 14px)',
                  transitionDelay: `${delay}ms`,
                  minWidth: '260px',
                }}
                onMouseEnter={() => setHovered(post.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <article
                  className="h-full rounded-2xl overflow-hidden transition-all duration-300"
                  style={{
                    background: isHovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)',
                    border: isHovered ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.07)',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    boxShadow: isHovered ? '0 16px 40px rgba(59,130,246,0.12)' : 'none',
                  }}
                >
                  {/* Image */}
                  <div className="relative h-44 overflow-hidden">
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500"
                        style={{ transform: isHovered ? 'scale(1.06)' : 'scale(1)' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))' }}>
                        <svg className="w-10 h-10 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Category badge */}
                    {post.category && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(59,130,246,0.85)', backdropFilter: 'blur(8px)', color: 'white' }}>
                        {post.category}
                      </span>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3
                      className="font-semibold text-[14px] leading-snug mb-2 line-clamp-2 transition-colors duration-150"
                      style={{ color: isHovered ? 'rgba(147,197,253,1)' : 'rgba(255,255,255,0.88)' }}
                    >
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-[12px] text-white/35 leading-relaxed line-clamp-2 mb-4">{post.excerpt}</p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[11px] text-white/25 pt-3 border-t border-white/[0.06]">
                      <span>{post.authorName}</span>
                      <div className="flex items-center gap-2">
                        <span>{post.readTime}m</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>{new Date(post.publishedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      {posts.length > 3 && (
        <div className={`flex items-center justify-between mt-5 transition-all duration-700 delay-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {dots.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: active === i ? '20px' : '6px',
                  height: '6px',
                  background: active === i
                    ? 'linear-gradient(90deg, #3b82f6, #818cf8)'
                    : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          {/* Arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goTo(Math.max(0, active - 1))}
              disabled={active === 0}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-25"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => goTo(Math.min(maxActive, active + 1))}
              disabled={active === maxActive}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-25"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}
            >
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
