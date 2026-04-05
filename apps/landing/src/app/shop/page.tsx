import { Metadata } from 'next'
import Header from '@/components/sections/Header'
import FooterSection from '@/components/sections/FooterSection'
import ShopHero from './ShopHero'
import ShopContent from './ShopContent'

export const metadata: Metadata = {
  title: 'Shop — ADS360 | Buy Premium Ad Assets',
  description: 'Buy aged ad accounts, Business Managers, Pages & more. Instant delivery, verified quality, USDT payment.',
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

type Category = { id: string; name: string; slug: string; image?: string | null; _count?: { products: number } }
type Product = {
  id: string; title: string; slug: string; shortDesc?: string; description?: string
  price: number; comparePrice?: number | null; platform: string; images: string[]
  stock: number; isFeatured?: boolean; features?: string[]
  category?: { name: string; slug: string }; categoryId?: string
}

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API}/shop/categories`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.categories || []
  } catch { return [] }
}

async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API}/shop/products`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.products || []
  } catch { return [] }
}

export default async function ShopPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()])

  return (
    <div className="min-h-screen bg-[#07071a] text-white">
      <Header />
      <ShopHero categories={categories} totalProducts={products.length} />

      {/* Client-side filtered content — smooth category switching */}
      <ShopContent products={products} categories={categories} />


      <FooterSection />
    </div>
  )
}
