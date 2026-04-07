'use client'

import { useEffect } from 'react'
import { trackProductView, trackBlogView } from './tracking'

export function TrackProductView({ product }: { product: { id: string; title: string; price: number; platform?: string } }) {
  useEffect(() => { trackProductView(product) }, [])
  return null
}

export function TrackBlogView({ post }: { post: { id: string; title: string; slug: string } }) {
  useEffect(() => { trackBlogView(post) }, [])
  return null
}
