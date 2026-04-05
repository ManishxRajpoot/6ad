'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import CheckoutModal from './[slug]/CheckoutModal'

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  META: { bg: 'rgba(24,119,242,0.12)', text: '#60a5fa', border: 'rgba(24,119,242,0.25)' },
  GOOGLE: { bg: 'rgba(66,133,244,0.12)', text: '#93bbfc', border: 'rgba(66,133,244,0.25)' },
  TIKTOK: { bg: 'rgba(255,0,80,0.12)', text: '#ff6090', border: 'rgba(255,0,80,0.25)' },
  SNAPCHAT: { bg: 'rgba(255,252,0,0.1)', text: '#ffd700', border: 'rgba(255,220,0,0.2)' },
  BING: { bg: 'rgba(0,137,123,0.12)', text: '#4dd0c8', border: 'rgba(0,137,123,0.25)' },
  INSTAGRAM: { bg: 'rgba(225,48,108,0.12)', text: '#f472b6', border: 'rgba(225,48,108,0.25)' },
  TWITTER: { bg: 'rgba(29,161,242,0.12)', text: '#7dd3fc', border: 'rgba(29,161,242,0.25)' },
  OTHER: { bg: 'rgba(99,102,241,0.12)', text: '#a5b4fc', border: 'rgba(99,102,241,0.25)' },
}

const PLATFORM_LABELS: Record<string, string> = {
  META: 'Meta', GOOGLE: 'Google', TIKTOK: 'TikTok', SNAPCHAT: 'Snapchat',
  BING: 'Bing', INSTAGRAM: 'Instagram', TWITTER: 'X', OTHER: 'Other',
}

type Product = {
  id: string; title: string; slug: string; shortDesc?: string; description?: string
  price: number; comparePrice?: number | null; platform: string; images: string[]
  stock: number; isFeatured?: boolean; features?: string[]
  category?: { name: string; slug: string; order?: number }; categoryId?: string
}

type Category = { id: string; name: string; slug: string; image?: string | null; order?: number }

export default function ShopContent({ products, categories, initialCategory }: {
  products: Product[]
  categories: Category[]
  initialCategory?: string
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory || '')
  const [checkoutProduct, setCheckoutProduct] = useState<{ id: string; title: string; price: number; slug: string } | null>(null)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!activeCategory) return products
    return products.filter(p => p.category?.slug === activeCategory)
  }, [products, activeCategory])

  return (
    <>
      {/* Category pills — horizontal scroll on mobile, centered wrap on desktop */}
      <div className="max-w-6xl mx-auto px-6 pt-2 pb-6">
        <div className="relative">
          {/* Desktop: centered wrap / Mobile: horizontal scroll */}
          <div className="hidden sm:flex flex-wrap justify-center gap-2">
            {[{ id: 'all', name: 'All Assets', slug: '', image: null as string | null }, ...categories].map(cat => {
              const isActive = cat.slug === '' ? !activeCategory : activeCategory === cat.slug
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.slug)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium border transition-all duration-200 ${
                    isActive
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:border-white/[0.12] hover:text-white/60'
                  }`}>
                  {cat.image && <img src={cat.image} alt="" className="w-5 h-5 rounded object-cover" />}
                  {cat.name}
                </button>
              )
            })}
          </div>

          {/* Mobile: horizontal scroll with arrow */}
          <div className="sm:hidden relative">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide pr-10">
              {[{ id: 'all', name: 'All Assets', slug: '', image: null as string | null }, ...categories].map(cat => {
                const isActive = cat.slug === '' ? !activeCategory : activeCategory === cat.slug
                return (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.slug)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium border transition-all ${
                      isActive
                        ? 'border-blue-500/40 bg-blue-500/15 text-blue-400'
                        : 'border-white/[0.06] text-white/30'
                    }`}>
                    {cat.image && <img src={cat.image} alt="" className="w-4 h-4 rounded object-cover" />}
                    {cat.name}
                  </button>
                )
              })}
            </div>
            {/* Right fade + arrow */}
            <div className="absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-[#07071a] via-[#07071a]/80 to-transparent pointer-events-none flex items-center justify-end pr-0.5">
              <div className="w-5 h-5 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center animate-pulse">
                <svg className="w-2.5 h-2.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product list — E2 Grouped by Category */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 mx-auto mb-4 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            <p className="text-white/30 text-lg">No products in this category yet.</p>
            <button onClick={() => setActiveCategory('')} className="text-blue-400 text-sm mt-2 hover:underline">View all assets</button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-[#0a0a22]">
            {(() => {
              // Group by category, maintaining category order, include category image
              const catImageMap = new Map(categories.map(c => [c.name, c.image]))
              const groupedMap = new Map<string, { order: number; items: Product[]; image?: string | null }>()
              for (const p of filtered) {
                const catName = p.category?.name || 'Other'
                const catOrder = p.category?.order ?? 999
                if (!groupedMap.has(catName)) groupedMap.set(catName, { order: catOrder, items: [], image: catImageMap.get(catName) || null })
                groupedMap.get(catName)!.items.push(p)
              }
              const grouped = [...groupedMap.entries()].sort((a, b) => a[1].order - b[1].order)

              return grouped.map(([cat, { items, image: catImage }]) => (
                <div key={cat} className="animate-[fadeIn_0.3s_ease]">
                  {/* Category header */}
                  <div className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-blue-900/30 to-transparent border-b border-white/[0.06]">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider">{cat}</span>
                    <span className="text-[10px] text-white/20">{items.length} products</span>
                  </div>
                  {/* Product rows */}
                  {items.map((product, i) => {
                    const colors = PLATFORM_COLORS[product.platform] || PLATFORM_COLORS.OTHER
                    return (
                      <div
                        key={product.id}
                        className={`group hover:bg-white/[0.02] transition-colors ${i < items.length - 1 ? 'border-b border-white/[0.03]' : 'border-b border-white/[0.06]'}`}
                      >
                        {/* Desktop row */}
                        <div className="hidden sm:flex items-center justify-between px-5 py-3">
                          <Link href={`/shop/${product.slug}`} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                              {catImage ? (
                                <img src={catImage} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-black" style={{ color: colors.text }}>
                                  {(PLATFORM_LABELS[product.platform] || product.platform).charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-white/80 font-medium truncate group-hover:text-white transition-colors">{product.title}</p>
                              <p className="text-[10px] text-white/20">{product.features?.[0]}</p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-5 shrink-0 ml-4">
                            {product.isFeatured && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Top Seller</span>
                            )}
                            <span className="text-[11px] text-white/20 w-12 text-right">{product.stock > 0 ? `${product.stock} left` : 'Sold out'}</span>
                            <span className="font-bold text-white w-16 text-right">${product.price}<span className="text-[10px] text-white/20 font-normal">/ pc</span></span>
                            <button
                              onClick={() => setCheckoutProduct({ id: product.id, title: product.title, price: product.price, slug: product.slug })}
                              className="px-4 py-1.5 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-400 transition-colors"
                            >
                              Buy Now
                            </button>
                          </div>
                        </div>

                        {/* Mobile row */}
                        <div className="sm:hidden px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                              {catImage ? (
                                <img src={catImage} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-black" style={{ color: colors.text }}>
                                  {(PLATFORM_LABELS[product.platform] || product.platform).charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-white/85 font-semibold leading-snug line-clamp-2">{product.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-green-400/60 flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-green-400" />{product.stock > 0 ? 'In Stock' : 'Sold out'}
                                </span>
                                {product.isFeatured && (
                                  <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">TOP</span>
                                )}
                              </div>
                            </div>
                            <span className="text-lg font-extrabold shrink-0">${product.price}</span>
                          </div>
                          {/* Buy Now + Dropdown */}
                          <div className="flex items-center gap-2 mt-2 ml-[52px]">
                            <button
                              onClick={() => setCheckoutProduct({ id: product.id, title: product.title, price: product.price, slug: product.slug })}
                              className="flex-1 py-2 rounded-lg bg-green-500 text-white text-[12px] font-bold hover:bg-green-400 transition-colors"
                            >
                              Buy Now
                            </button>
                            <button
                              onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${expandedProduct === product.id ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/[0.08] bg-white/[0.03]'}`}
                            >
                              <svg className={`w-4 h-4 text-blue-400 transition-transform duration-200 ${expandedProduct === product.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </div>
                          {/* Expanded details */}
                          <div className={`overflow-hidden transition-all duration-300 ml-[52px] ${expandedProduct === product.id ? 'max-h-[400px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                            <p className="text-[11px] text-white/30 leading-relaxed mb-2">{product.description || product.features?.join('. ')}</p>
                            {product.features && product.features.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {product.features.slice(0, 4).map((f, fi) => (
                                  <div key={fi} className="flex items-center gap-1.5 text-[11px] text-white/35">
                                    <svg className="w-3 h-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    {f}
                                  </div>
                                ))}
                              </div>
                            )}
                            <Link href={`/shop/${product.slug}`} className="inline-flex items-center gap-1 text-blue-400 text-[11px] font-semibold">
                              View details <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            })()}
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          onClose={() => setCheckoutProduct(null)}
        />
      )}
    </>
  )
}
