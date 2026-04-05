import Link from 'next/link'
import { Metadata } from 'next'
import Header from '@/components/sections/Header'
import FooterSection from '@/components/sections/FooterSection'

export const metadata: Metadata = {
  title: 'Blog — ADS360 | Agency Ad Account Tips & Guides',
  description: 'Expert tips, guides and strategies for Facebook, Google, TikTok agency ad accounts.',
}

type Post = {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImage: string | null
  category: string | null
  authorName: string
  readTime: number
  views: number
  publishedAt: string
}

async function getPosts(): Promise<Post[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/cms/blog?limit=50`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.posts || []
  } catch {
    return []
  }
}

export default async function BlogIndexPage() {
  const posts = await getPosts()
  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))] as string[]
  const featured = posts[0]
  const rest = posts.slice(1)

  return (
    <div className="min-h-screen bg-[#07071a] text-white">
      <Header />

      <div className="max-w-6xl mx-auto px-6 pt-28 pb-14">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/8 text-blue-400 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> ADS360 Blog
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Ad Strategies That <span className="text-blue-400">Actually Work</span>
          </h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Expert guides on agency ad accounts, scaling strategies, and platform tips.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20 text-white/30">No posts published yet. Check back soon!</div>
        ) : (
          <>
            {/* Featured */}
            {featured && (
              <Link href={`/blog/${featured.slug}`} className="group block mb-10">
                <div className="relative rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] transition-colors">
                  <div className="md:flex md:min-h-[280px]">
                    <div className="md:w-1/2 relative min-h-[200px]">
                      {featured.coverImage ? (
                        <img src={featured.coverImage} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-900/40 to-purple-900/40 flex items-center justify-center">
                          <span className="text-4xl opacity-30">📝</span>
                        </div>
                      )}
                    </div>
                    <div className="md:w-1/2 p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 text-xs font-semibold border border-blue-500/20">Featured</span>
                        {featured.category && <span className="px-2.5 py-1 rounded-full bg-white/5 text-white/50 text-xs border border-white/10">{featured.category}</span>}
                      </div>
                      <h2 className="text-2xl font-bold mb-3 group-hover:text-blue-300 transition-colors leading-tight">{featured.title}</h2>
                      {featured.excerpt && <p className="text-white/45 text-sm leading-relaxed mb-5 line-clamp-3">{featured.excerpt}</p>}
                      <div className="flex items-center gap-3 text-white/30 text-xs">
                        <span>{featured.authorName}</span>
                        <span>·</span>
                        <span>{featured.readTime} min read</span>
                        <span>·</span>
                        <span>{new Date(featured.publishedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Category filters */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 mb-8 flex-wrap">
                <span className="text-white/30 text-xs">Filter:</span>
                {categories.map(cat => (
                  <span key={cat} className="px-3 py-1 rounded-full text-xs border border-white/[0.08] text-white/40 hover:border-blue-500/30 hover:text-blue-400 cursor-pointer transition-colors">
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Grid */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {rest.map(post => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="group block">
                    <article className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden hover:border-white/[0.13] hover:bg-white/[0.04] transition-all duration-200">
                      <div className="h-44 overflow-hidden">
                        {post.coverImage ? (
                          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex items-center justify-center">
                            <span className="text-3xl opacity-25">📝</span>
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        {post.category && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-semibold border border-blue-500/15 mb-2.5">{post.category}</span>
                        )}
                        <h3 className="font-bold text-[15px] leading-snug mb-2 group-hover:text-blue-300 transition-colors line-clamp-2">{post.title}</h3>
                        {post.excerpt && <p className="text-white/35 text-[13px] leading-relaxed line-clamp-2 mb-4">{post.excerpt}</p>}
                        <div className="flex items-center justify-between text-white/25 text-[11px]">
                          <span>{post.authorName}</span>
                          <div className="flex items-center gap-2">
                            <span>{post.readTime}m read</span>
                            <span>·</span>
                            <span>{new Date(post.publishedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <FooterSection />
    </div>
  )
}
