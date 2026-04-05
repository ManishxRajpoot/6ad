import { MetadataRoute } from 'next'

const SITE_URL = 'https://ads360.ai'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]

  // Dynamic blog posts
  let blogPages: MetadataRoute.Sitemap = []
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.6ad.in'
    const res = await fetch(`${API}/cms/blog?limit=100`, { next: { revalidate: 3600 } })
    if (res.ok) {
      const data = await res.json()
      blogPages = (data.posts || []).map((post: any) => ({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: new Date(post.updatedAt || post.publishedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    }
  } catch {
    // Silently fail — static pages will still be in sitemap
  }

  return [...staticPages, ...blogPages]
}
