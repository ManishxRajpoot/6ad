import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { TableOfContents } from './TableOfContents'
import { ShareButtons } from './ShareButtons'
import { RelatedPosts } from './RelatedPosts'
import Header from '@/components/sections/Header'
import FooterSection from '@/components/sections/FooterSection'

type Post = {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  coverImage: string | null
  category: string | null
  tags: string[]
  authorName: string
  authorImage: string | null
  readTime: number
  views: number
  publishedAt: string
  metaTitle: string | null
  metaDesc: string | null
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ads360.ai'

async function getPost(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API}/cms/blog/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    return data.post
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Post Not Found' }
  return {
    title: post.metaTitle || `${post.title} — ADS360 Blog`,
    description: post.metaDesc || post.excerpt,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDesc || post.excerpt,
      siteName: 'ADS360',
      images: post.coverImage ? [post.coverImage] : [],
      type: 'article',
    },
  }
}

// Extract h2/h3 headings from HTML and inject IDs
function processContent(html: string): { processed: string; headings: { id: string; text: string; level: number }[] } {
  const headings: { id: string; text: string; level: number }[] = []

  const processed = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi, (_, level, attrs, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim()
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `heading-${headings.length}`
    // Don't double-add id if already present
    const hasId = /id="/i.test(attrs)
    const finalId = hasId ? (attrs.match(/id="([^"]*)"/i)?.[1] || id) : id
    headings.push({ id: finalId, text, level: parseInt(level) })
    if (hasId) return `<h${level}${attrs}>${inner}</h${level}>`
    return `<h${level}${attrs} id="${finalId}">${inner}</h${level}>`
  })

  return { processed, headings }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const { processed: processedContent, headings } = processContent(post.content)
  const postUrl = `${SITE_URL}/blog/${post.slug}`

  return (
    <div className="min-h-screen bg-[#07071a] text-white">
      <Header />

      {/* ─── HERO BANNER ──────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden pt-16" style={{ minHeight: '380px' }}>
        {/* Background */}
        {post.coverImage ? (
          <>
            <img src={post.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0d1540]/80 via-[#0d1540]/60 to-[#07071a]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#0d1540] via-[#0a1a55] to-[#07071a]" />
            {/* Grid lines */}
            <div className="absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            {/* Center glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 rounded-full blur-[100px]" />
          </>
        )}

        {/* Decorative side elements */}
        <div className="absolute left-0 top-0 bottom-0 w-1/4 opacity-[0.35] pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-8 -translate-y-1/2 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl" />
          <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/satellite.webp" alt="" className="absolute top-[30%] left-[5%] w-28 opacity-40 drop-shadow-[0_0_20px_rgba(59,130,246,0.4)]" style={{ filter: 'hue-rotate(10deg) saturate(0.6) brightness(0.9)' }} />
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/4 opacity-[0.35] pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 right-8 -translate-y-1/2 w-32 h-32 bg-indigo-400/20 rounded-full blur-3xl" />
          <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/landing/planet.webp" alt="" className="absolute top-[25%] right-[8%] w-24 opacity-40 drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 text-center">
          {/* Back link */}
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-white/35 hover:text-white/70 text-[13px] transition-colors mb-8">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>

          {/* Category badge */}
          {post.category && (
            <div className="mb-5">
              <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-300 text-[12px] font-bold tracking-widest uppercase border border-blue-500/30">
                {post.category}
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-[42px] font-bold leading-tight text-white mb-6 drop-shadow-[0_0_40px_rgba(59,130,246,0.2)]">
            {post.title}
          </h1>

          {/* Date + read time */}
          <div className="flex items-center justify-center gap-5 text-white/40 text-[13px]">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(post.publishedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span className="text-blue-300 font-semibold">{post.readTime} MINUTES</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── 3-COLUMN LAYOUT ──────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 pb-0">
        <div className="flex gap-8 items-start">

          {/* LEFT — Table of Contents (sticky) */}
          <aside className="hidden lg:block w-56 xl:w-64 shrink-0 sticky top-8 self-start">
            <TableOfContents headings={headings} />
          </aside>

          {/* CENTER — Article */}
          <main className="flex-1 min-w-0">
            {/* Author row */}
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/[0.07]">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                {post.authorImage
                  ? <img src={post.authorImage} className="w-full h-full object-cover" alt={post.authorName} />
                  : <span>{post.authorName[0]}</span>
                }
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">{post.authorName}</p>
                <div className="flex items-center gap-2 text-white/30 text-[12px] mt-0.5">
                  <span>{new Date(post.publishedAt).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span>·</span>
                  <span>{post.readTime} min read</span>
                  {post.views > 0 && <><span>·</span><span>{post.views.toLocaleString()} views</span></>}
                </div>
              </div>
            </div>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg text-white/50 leading-relaxed mb-8 border-l-2 border-blue-500/40 pl-4 italic">
                {post.excerpt}
              </p>
            )}

            {/* Content */}
            <div
              className="blog-content prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: processedContent }}
            />

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/[0.07]">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.04] text-white/35 text-[12px] border border-white/[0.08] hover:border-white/20 hover:text-white/55 transition-colors cursor-default">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Related Posts */}
            <RelatedPosts currentSlug={post.slug} />

          </main>

          {/* RIGHT — Share + CTA (sticky) */}
          <aside className="hidden xl:block w-64 shrink-0 sticky top-8 self-start">
            <ShareButtons title={post.title} url={postUrl} />
          </aside>

        </div>
      </div>

      {/* Mobile share bar */}
      <div className="xl:hidden border-t border-white/[0.07] mt-4 py-6 px-6">
        <ShareButtons title={post.title} url={postUrl} />
      </div>

      {/* Bottom CTA bar — outside content area, directly before footer */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/50 to-indigo-950/50 p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div>
            <p className="font-bold text-white text-lg">Ready to scale your ads?</p>
            <p className="text-white/40 text-sm mt-1">Get a real agency ad account and run ads without limits or bans.</p>
          </div>
          <Link
            href="/#contact"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-500 hover:bg-blue-400 text-white text-[14px] font-semibold transition-colors whitespace-nowrap"
          >
            Get Started →
          </Link>
        </div>
      </div>

      <FooterSection />
    </div>
  )
}
