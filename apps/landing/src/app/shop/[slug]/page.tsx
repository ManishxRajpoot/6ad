import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Header from '@/components/sections/Header'
import FooterSection from '@/components/sections/FooterSection'
import { TrackProductView } from '@/lib/TrackPageView'
import ProductDetail from './ProductDetail'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

const PLATFORM_COLORS: Record<string, string> = {
  META: '#1877F2',
  GOOGLE: '#4285F4',
  TIKTOK: '#ff0050',
  SNAPCHAT: '#FFFC00',
  BING: '#00897B',
  INSTAGRAM: '#E1306C',
  TWITTER: '#1DA1F2',
  OTHER: '#6366f1',
}

type Product = {
  id: string
  title: string
  slug: string
  shortDescription: string
  description: string
  price: number
  comparePrice?: number | null
  platform: string
  images: string[]
  features: string[]
  specs: Record<string, string>
  stock: number | null
  metaTitle?: string | null
  metaDesc?: string | null
}

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API}/shop/products/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    return data.product || data
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) return { title: 'Product Not Found' }
  return {
    title: product.metaTitle || `${product.title} — ADS360 Shop`,
    description: product.metaDesc || product.shortDescription,
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const platformColor =
    PLATFORM_COLORS[product.platform?.toUpperCase()] || PLATFORM_COLORS.OTHER

  return (
    <div className="min-h-screen bg-[#07071a] text-white">
      <TrackProductView product={{ id: product.id, title: product.title, price: product.price, platform: product.platform }} />
      <Header />

      <div className="max-w-6xl mx-auto px-6 pt-24 pb-14">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/30 mb-8">
          <Link href="/shop" className="hover:text-blue-400 transition-colors">
            Shop
          </Link>
          <span>/</span>
          <span className="text-white/50">{product.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Left — Product Info */}
          <div className="flex-1 min-w-0">
            {/* Platform badge */}
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold border mb-4"
              style={{ backgroundColor: `${platformColor}20`, color: platformColor, borderColor: `${platformColor}30` }}
            >
              {product.platform}
            </span>

            <h1 className="text-2xl md:text-4xl font-bold mb-3 leading-tight">{product.title}</h1>

            {/* Price — mobile only (desktop shows in sidebar) */}
            <div className="lg:hidden flex items-center gap-3 mb-5">
              <span className="text-3xl font-bold text-blue-400">${product.price}</span>
              {product.comparePrice && product.comparePrice > product.price && (
                <>
                  <span className="text-lg text-white/25 line-through">${product.comparePrice}</span>
                  <span className="px-2 py-0.5 rounded bg-green-500/15 text-green-400 text-xs font-semibold border border-green-500/20">
                    {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}% OFF
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-8">
                <p className="text-white/40 text-[15px] leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Features</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {product.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <svg className="w-4 h-4 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-white/50">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specs table */}
            {product.specs && Object.keys(product.specs).length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Specifications</h3>
                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  {Object.entries(product.specs).map(([key, value], i) => (
                    <div key={key} className={`flex items-center justify-between px-5 py-3 text-sm ${i % 2 === 0 ? 'bg-white/[0.02]' : ''} ${i < Object.keys(product.specs).length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                      <span className="text-white/35">{key}</span>
                      <span className="text-white/70 font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buy button — mobile only */}
            <div className="lg:hidden">
              <ProductDetail product={{ id: product.id, title: product.title, price: product.price, slug: product.slug, stock: product.stock }} />
            </div>
          </div>

          {/* Right — Sticky Buy Card (desktop only) */}
          <div className="hidden lg:block w-[340px] shrink-0">
            <div className="sticky top-24 rounded-2xl border border-white/[0.08] bg-[#0c0c24] p-6">
              {/* Price */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl font-extrabold text-white">${product.price}</span>
                {product.comparePrice && product.comparePrice > product.price && (
                  <span className="text-lg text-white/20 line-through">${product.comparePrice}</span>
                )}
              </div>
              {product.comparePrice && product.comparePrice > product.price && (
                <span className="inline-block px-2 py-0.5 rounded bg-green-500/15 text-green-400 text-xs font-semibold border border-green-500/20 mb-4">
                  Save {Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%
                </span>
              )}

              {/* Stock */}
              <div className="flex items-center gap-2 mb-5">
                {product.stock === 0 ? (
                  <span className="flex items-center gap-1.5 text-sm text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" />Sold out</span>
                ) : (product.stock ?? -1) > 0 && (product.stock ?? -1) <= 20 ? (
                  <span className="flex items-center gap-1.5 text-sm text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />Only {product.stock} left</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-green-400/70"><span className="w-2 h-2 rounded-full bg-green-400" />In Stock</span>
                )}
              </div>

              <div className="h-[1px] bg-white/[0.06] mb-5" />

              {/* Quick features */}
              <div className="space-y-2 mb-5">
                {(product.features || []).slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px] text-white/40">
                    <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </div>
                ))}
              </div>

              {/* Buy button */}
              <ProductDetail product={{ id: product.id, title: product.title, price: product.price, slug: product.slug, stock: product.stock }} />

              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-2 mt-5">
                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                  <svg className="w-3.5 h-3.5 text-blue-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Secure Payment
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                  <svg className="w-3.5 h-3.5 text-cyan-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Instant Delivery
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                  <svg className="w-3.5 h-3.5 text-green-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Replacement
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                  <svg className="w-3.5 h-3.5 text-purple-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  24/7 Support
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FooterSection />
    </div>
  )
}
