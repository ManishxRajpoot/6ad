'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'

interface LazySectionProps {
  children: ReactNode
  /** Height placeholder before loading (prevents layout shift) */
  minHeight?: string
  /** How far before viewport to start loading (default 200px) */
  rootMargin?: string
}

/**
 * LazySection — only mounts children when the section scrolls near the viewport.
 * This means you can put ANY heavy content (canvas, videos, 3D, huge SVGs)
 * inside and it won't cost anything until the user scrolls close.
 *
 * Usage:
 *   <LazySection minHeight="600px">
 *     <HeavySection />
 *   </LazySection>
 */
export default function LazySection({ children, minHeight = '400px', rootMargin = '500px' }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true)
          observer.disconnect() // once loaded, never unload
        }
      },
      { rootMargin: `${rootMargin} 0px` }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref} style={{ minHeight: mounted ? undefined : minHeight }}>
      {mounted ? children : null}
    </div>
  )
}
