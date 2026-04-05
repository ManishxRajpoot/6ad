'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { shopApi } from '@/lib/api'
import { StatsChart } from '@/components/ui/StatsChart'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import {
  Search, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  RefreshCw, Loader2, Edit3, Trash2, Eye, Package, Tag, ShoppingCart, ArrowUp, ArrowDown,
} from 'lucide-react'

type Tab = 'products' | 'categories' | 'orders' | 'drafts' | 'settings'

const PLATFORMS = ['META', 'GOOGLE', 'TIKTOK', 'SNAPCHAT', 'BING', 'INSTAGRAM', 'TWITTER', 'OTHER'] as const
const ORDER_STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const
const PAYMENT_METHODS = ['USDT_TRC20', 'USDT_BEP20'] as const

export default function ShopPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [activeTab, setActiveTab] = useState<Tab>('products')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Products
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])

  // Stats
  const [stats, setStats] = useState({ totalProducts: 0, totalCategories: 0, totalOrders: 0, totalRevenue: 0 })

  // Modals
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [deliverOrder, setDeliverOrder] = useState<any>(null)
  const [deliveryContent, setDeliveryContent] = useState('')
  const [delivering, setDelivering] = useState(false)

  // Forms
  const [productForm, setProductForm] = useState({
    title: '', description: '', price: '', stock: '', platform: 'META' as string,
    categoryId: '', status: 'ACTIVE', image: '', features: '',
  })
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '', description: '', status: 'ACTIVE', image: '', icon: '' })

  // Settings
  const [shopSettings, setShopSettings] = useState({ trc20WalletAddress: '', bep20WalletAddress: '', upiId: '' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [categoryImagePreview, setCategoryImagePreview] = useState<string | null>(null)
  const categoryFileRef = useRef<HTMLInputElement>(null)

  // Tab refs for sliding indicator
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const tabs = [
    { id: 'products', label: 'Products' },
    { id: 'categories', label: 'Categories' },
    { id: 'orders', label: 'Orders' },
    { id: 'drafts', label: 'Draft Orders' },
    { id: 'settings', label: 'Settings' },
  ]

  useEffect(() => {
    const updateIndicator = () => {
      const activeRef = tabRefs.current[activeTab]
      if (activeRef) setIndicatorStyle({ left: activeRef.offsetLeft, width: activeRef.offsetWidth })
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeTab])

  // Fetch
  const fetchStats = async () => {
    try {
      const data = await shopApi.getStats()
      setStats(data)
    } catch (e: any) { /* silent */ }
  }

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const data = await shopApi.products.getAll()
      setProducts(data.products || [])
    } catch (e: any) { toast.error('Error', e.message) }
    setLoading(false)
  }

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const data = await shopApi.categories.getAll()
      setCategories(data.categories || [])
    } catch (e: any) { toast.error('Error', e.message) }
    setLoading(false)
  }

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const data = await shopApi.orders.getAll()
      setOrders(data.orders || [])
    } catch (e: any) { toast.error('Error', e.message) }
    setLoading(false)
  }

  const fetchSettings = async () => {
    try {
      const data = await shopApi.settings.get()
      setShopSettings({ trc20WalletAddress: data.trc20WalletAddress || '', bep20WalletAddress: data.bep20WalletAddress || '', upiId: data.upiId || '' })
    } catch {}
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      await shopApi.settings.update(shopSettings)
      toast.success('Saved', 'Wallet settings updated')
    } catch (e: any) { toast.error('Error', e.message) }
    setSavingSettings(false)
  }

  useEffect(() => { fetchProducts(); fetchCategories(); fetchStats() }, [])
  useEffect(() => {
    if (activeTab === 'orders' || activeTab === 'drafts') fetchOrders()
    if (activeTab === 'settings') fetchSettings()
  }, [activeTab])

  // Filtered
  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (p.title || '').toLowerCase().includes(q) || (p.platform || '').toLowerCase().includes(q)
  })

  const filteredCategories = categories.filter(c => {
    if (!searchQuery) return true
    return (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  })

  const filteredOrders = orders.filter(o => {
    const matchSearch = !searchQuery || (o.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) || (o.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (o.telegramUsername || '').toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchSearch) return false
    // Orders tab: only show paid/processing/delivered/refunded (completed payments)
    if (activeTab === 'orders') return ['PAID', 'PROCESSING', 'DELIVERED', 'REFUNDED'].includes(o.status)
    // Drafts tab: only show pending/cancelled (incomplete payments)
    if (activeTab === 'drafts') return ['PENDING', 'CANCELLED'].includes(o.status)
    return true
  })

  // Product CRUD
  const openProductModal = (product?: any) => {
    if (product) {
      setEditingProduct(product)
      setProductForm({
        title: product.title || '',
        description: product.description || '',
        price: product.price?.toString() || '',
        stock: product.stock?.toString() || '',
        platform: product.platform || 'META',
        categoryId: product.categoryId || '',
        status: product.status || 'ACTIVE',
        image: product.image || '',
        features: (product.features || []).join('\n'),
      })
    } else {
      setEditingProduct(null)
      setProductForm({ title: '', description: '', price: '', stock: '', platform: 'META', categoryId: '', status: 'ACTIVE', image: '', features: '' })
    }
    setShowProductModal(true)
  }

  const saveProduct = async () => {
    if (!productForm.title || !productForm.price) return toast.error('Error', 'Title and price are required')
    const payload = {
      ...productForm,
      price: parseFloat(productForm.price),
      stock: parseInt(productForm.stock) || 0,
      features: productForm.features ? productForm.features.split('\n').filter(Boolean) : [],
    }
    try {
      if (editingProduct) {
        await shopApi.products.update(editingProduct.id, payload)
        toast.success('Updated', 'Product updated successfully')
      } else {
        await shopApi.products.create(payload)
        toast.success('Created', 'Product created successfully')
      }
      setShowProductModal(false)
      fetchProducts()
      fetchStats()
    } catch (e: any) { toast.error('Error', e.message) }
  }

  const deleteProduct = async (id: string) => {
    const ok = await confirm({ title: 'Delete Product', message: 'Are you sure you want to delete this product?', variant: 'danger' })
    if (!ok) return
    try {
      await shopApi.products.delete(id)
      toast.success('Deleted', 'Product deleted')
      fetchProducts()
      fetchStats()
    } catch (e: any) { toast.error('Error', e.message) }
  }

  // Category CRUD
  const openCategoryModal = (category?: any) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({ name: category.name || '', slug: category.slug || '', description: category.description || '', status: category.isActive !== false ? 'ACTIVE' : 'INACTIVE', image: category.image || '', icon: category.icon || '' })
      setCategoryImagePreview(category.image || null)
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', slug: '', description: '', status: 'ACTIVE', image: '', icon: '' })
      setCategoryImagePreview(null)
    }
    setShowCategoryModal(true)
  }

  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Show preview immediately
    const reader = new FileReader()
    reader.onload = () => setCategoryImagePreview(reader.result as string)
    reader.readAsDataURL(file)
    // Upload to Cloudflare R2 via shop API
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'shop/categories')
      const token = localStorage.getItem('token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/shop/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.url) {
        setCategoryForm(prev => ({ ...prev, image: data.url }))
        toast.success('Uploaded', 'Image uploaded to Cloudflare R2')
      } else {
        toast.error('Upload', data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload', 'Image upload failed — paste URL manually')
    }
  }

  const saveCategory = async () => {
    if (!categoryForm.name) return toast.error('Error', 'Name is required')
    try {
      const payload = {
        name: categoryForm.name,
        slug: categoryForm.slug || undefined,
        icon: categoryForm.icon,
        image: categoryForm.image,
        isActive: categoryForm.status === 'ACTIVE',
      }
      if (editingCategory) {
        await shopApi.categories.update(editingCategory.id, payload)
        toast.success('Updated', 'Category updated successfully')
      } else {
        await shopApi.categories.create(payload)
        toast.success('Created', 'Category created successfully')
      }
      setShowCategoryModal(false)
      fetchCategories()
      fetchStats()
    } catch (e: any) { toast.error('Error', e.message) }
  }

  // Drag reorder state
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null)
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null)

  const handleCatDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCatId(id)
    e.dataTransfer.effectAllowed = 'move'
    // Make the drag image semi-transparent
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '0.4'
  }

  const handleCatDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '1'
    setDraggedCatId(null)
    setDragOverCatId(null)
  }

  const handleCatDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== draggedCatId) setDragOverCatId(id)
  }

  const handleCatDrop = async (e: React.DragEvent, dropId: string) => {
    e.preventDefault()
    if (!draggedCatId || draggedCatId === dropId) return
    const sorted = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const dragIdx = sorted.findIndex(c => c.id === draggedCatId)
    const dropIdx = sorted.findIndex(c => c.id === dropId)
    if (dragIdx === -1 || dropIdx === -1) return

    // Reorder: remove dragged, insert at drop position
    const reordered = [...sorted]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(dropIdx, 0, moved)

    // Optimistic update
    setCategories(reordered.map((c, i) => ({ ...c, order: i })))
    setDraggedCatId(null)
    setDragOverCatId(null)

    // Save all new orders
    try {
      await Promise.all(reordered.map((c, i) => shopApi.categories.update(c.id, { order: i })))
      toast.success('Reordered', 'Category order updated')
    } catch (e: any) {
      toast.error('Error', 'Failed to save order')
      fetchCategories()
    }
  }

  const deleteCategory = async (id: string) => {
    const ok = await confirm({ title: 'Delete Category', message: 'Are you sure you want to delete this category?', variant: 'danger' })
    if (!ok) return
    try {
      await shopApi.categories.delete(id)
      toast.success('Deleted', 'Category deleted')
      fetchCategories()
      fetchStats()
    } catch (e: any) { toast.error('Error', e.message) }
  }

  // Order status update
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await shopApi.orders.update(orderId, { status })
      toast.success('Updated', `Order status changed to ${status}`)
      setUpdatingOrderId(null)
      fetchOrders()
      fetchStats()
    } catch (e: any) { toast.error('Error', e.message) }
  }

  // Helpers
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; dot: string }> = {
      ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      INACTIVE: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
      PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
      PAID: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
      PROCESSING: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
      DELIVERED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
      REFUNDED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    }
    const c = config[status] || { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {status}
      </span>
    )
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const formatPrice = (p: number) => `$${p?.toFixed(2) || '0.00'}`

  return (
    <DashboardLayout title="Shop Management">
      <style jsx>{`
        @keyframes tabFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .tab-row-animate { animation: tabFadeIn 0.25s ease-out forwards; opacity: 0; }
      `}</style>

      {/* Top Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search products, orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-[250px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'products' && (
            <button onClick={() => openProductModal()} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
          {activeTab === 'categories' && (
            <button onClick={() => openCategoryModal()} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              <Plus className="w-4 h-4" /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards — matching Yeewallex style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Total Products</span><p className="text-2xl font-bold text-gray-800">{stats.totalProducts}</p></div>
            <span className="px-2 py-0.5 bg-violet-500 text-white text-sm font-medium rounded">Products</span>
          </div>
          <StatsChart value={stats.totalProducts} color="#8B5CF6" filterId="shop-prod-f" gradientId="shop-prod-g" clipId="shop-prod-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Categories</span><p className="text-2xl font-bold text-gray-800">{stats.totalCategories}</p></div>
            <span className="px-2 py-0.5 bg-blue-500 text-white text-sm font-medium rounded">Active</span>
          </div>
          <StatsChart value={stats.totalCategories} color="#3B82F6" filterId="shop-cat-f" gradientId="shop-cat-g" clipId="shop-cat-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Total Orders</span><p className="text-2xl font-bold text-gray-800">{stats.totalOrders}</p></div>
            <span className="px-2 py-0.5 bg-amber-500 text-white text-sm font-medium rounded">Orders</span>
          </div>
          <StatsChart value={stats.totalOrders} color="#F59E0B" filterId="shop-ord-f" gradientId="shop-ord-g" clipId="shop-ord-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Revenue</span><p className="text-2xl font-bold text-emerald-600">${stats.totalRevenue?.toFixed(2) || '0.00'}</p></div>
            <span className="px-2 py-0.5 bg-emerald-500 text-white text-sm font-medium rounded">${stats.totalRevenue > 0 ? Math.round(stats.totalRevenue) : 0}</span>
          </div>
          <StatsChart value={stats.totalRevenue || 0} color="#10B981" filterId="shop-rev-f" gradientId="shop-rev-g" clipId="shop-rev-c" />
        </Card>
      </div>

      {/* Main Card with Tabs & Table */}
      <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
        {/* Tabs with sliding indicator */}
        <div className="border-b border-gray-100 flex-shrink-0">
          <div className="flex relative items-center">
            {tabs.map(t => (
              <button key={t.id} ref={el => { tabRefs.current[t.id] = el }} onClick={() => setActiveTab(t.id as Tab)}
                className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${activeTab === t.id ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'}`}>{t.label}</button>
            ))}
            <button onClick={() => { if (activeTab === 'products') fetchProducts(); else if (activeTab === 'categories') fetchCategories(); else fetchOrders() }}
              className="ml-auto mr-3 p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
            <div className="absolute bottom-0 h-0.5 bg-violet-600 transition-all duration-300 ease-out" style={{ left: indicatorStyle.left, width: indicatorStyle.width }} />
          </div>
        </div>

        {/* Table -- Scrollable */}
        <div className="overflow-auto flex-1 min-h-0" key={activeTab}>

          {/* === PRODUCTS TAB === */}
          {activeTab === 'products' && (
            loading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" /><span className="text-gray-500 text-sm ml-2">Loading...</span></div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><h3 className="text-lg font-semibold text-gray-900 mb-2">No Products</h3><p className="text-gray-500 text-sm">Add your first product to get started.</p></div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Title</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Category</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Platform</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Price</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Stock</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, index) => (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate" style={{ animationDelay: `${index * 20}ms` }}>
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap font-medium">{product.title}</td>
                      <td className="py-2.5 px-3 text-gray-500">{product.category?.name || '---'}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">{product.platform}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-600 whitespace-nowrap">{formatPrice(product.price)}</td>
                      <td className="py-2.5 px-3 text-gray-600">{product.stock ?? 0}</td>
                      <td className="py-2.5 px-3">{getStatusBadge(product.status)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => openProductModal(product)} className="p-1.5 rounded-md hover:bg-violet-50 text-violet-600" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteProduct(product.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* === CATEGORIES TAB === */}
          {activeTab === 'categories' && (
            loading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" /><span className="text-gray-500 text-sm ml-2">Loading...</span></div>
            ) : filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><h3 className="text-lg font-semibold text-gray-900 mb-2">No Categories</h3><p className="text-gray-500 text-sm">Add your first category.</p></div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-center py-2.5 px-2 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50 w-12"></th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Image</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Name</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Slug</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Products</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((cat, index) => (
                    <tr
                      key={cat.id}
                      draggable
                      onDragStart={(e) => handleCatDragStart(e, cat.id)}
                      onDragEnd={handleCatDragEnd}
                      onDragOver={(e) => handleCatDragOver(e, cat.id)}
                      onDrop={(e) => handleCatDrop(e, cat.id)}
                      className={`border-b align-middle tab-row-animate transition-all duration-150 ${
                        dragOverCatId === cat.id && draggedCatId !== cat.id
                          ? 'border-t-2 border-t-violet-500 bg-violet-50/50'
                          : 'border-gray-100 hover:bg-gray-50/50'
                      } ${draggedCatId === cat.id ? 'opacity-40' : ''}`}
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="py-2.5 px-2 cursor-grab active:cursor-grabbing">
                        <div className="flex flex-col items-center gap-[2px] text-gray-300 hover:text-gray-500 transition-colors">
                          <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-current" /><span className="w-[3px] h-[3px] rounded-full bg-current" /></div>
                          <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-current" /><span className="w-[3px] h-[3px] rounded-full bg-current" /></div>
                          <div className="flex gap-[2px]"><span className="w-[3px] h-[3px] rounded-full bg-current" /><span className="w-[3px] h-[3px] rounded-full bg-current" /></div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {cat.image ? (
                          <img src={cat.image} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Tag className="w-3.5 h-3.5 text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap font-medium">{cat.name}</td>
                      <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                      <td className="py-2.5 px-3 text-gray-600">{cat._count?.products ?? cat.productsCount ?? 0}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${cat.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cat.isActive !== false ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {cat.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => openCategoryModal(cat)} className="p-1.5 rounded-md hover:bg-violet-50 text-violet-600" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* === ORDERS TAB === */}
          {activeTab === 'orders' && (
            loading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" /><span className="text-gray-500 text-sm ml-2">Loading...</span></div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><h3 className="text-lg font-semibold text-gray-900 mb-2">No Orders</h3><p className="text-gray-500 text-sm">No orders yet.</p></div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Order #</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Email</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Contact</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Amount</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">TxHash</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, index) => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate" style={{ animationDelay: `${index * 20}ms` }}>
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap font-medium font-mono text-xs">{order.orderNumber || order.id?.slice(0, 8)}</td>
                      <td className="py-2.5 px-3 text-gray-600 text-xs">{order.email || '---'}</td>
                      <td className="py-2.5 px-3 text-gray-600 text-xs">{order.telegramUsername || '---'}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-600 whitespace-nowrap">{formatPrice(order.totalAmount || order.amount)}</td>
                      <td className="py-2.5 px-3 relative">
                        {updatingOrderId === order.id ? (
                          <div className="relative dropdown-container">
                            <select
                              value={order.status}
                              onChange={e => updateOrderStatus(order.id, e.target.value)}
                              onBlur={() => setUpdatingOrderId(null)}
                              autoFocus
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            >
                              {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        ) : (
                          <button onClick={() => setUpdatingOrderId(order.id)}>
                            {getStatusBadge(order.status)}
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {order.txHash?.startsWith('UPI_SCREENSHOT:') ? (
                          <img
                            src={order.txHash.replace('UPI_SCREENSHOT:', '')}
                            alt="Payment proof"
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setPreviewImage(order.txHash!.replace('UPI_SCREENSHOT:', ''))}
                          />
                        ) : order.txHash ? (
                          <span className="text-gray-500 font-mono text-xs max-w-[120px] truncate block" title={order.txHash}>{order.txHash.slice(0, 12)}...</span>
                        ) : '---'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className="py-2.5 px-3">
                        {order.status === 'DELIVERED' ? (
                          <span className="text-[11px] text-emerald-600 font-medium">Delivered</span>
                        ) : (
                          <button
                            onClick={() => { setDeliverOrder(order); setDeliveryContent(''); }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-colors"
                          >
                            Deliver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {/* === DRAFT ORDERS TAB === */}
          {activeTab === 'drafts' && (
            loading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" /><span className="text-gray-500 text-sm ml-2">Loading...</span></div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><h3 className="text-lg font-semibold text-gray-900 mb-2">No Draft Orders</h3><p className="text-gray-500 text-sm">Orders with incomplete payments will appear here.</p></div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Order #</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Email</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Contact</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Amount</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, index) => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate" style={{ animationDelay: `${index * 20}ms` }}>
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap font-medium font-mono text-xs">{order.orderNumber || order.id?.slice(0, 8)}</td>
                      <td className="py-2.5 px-3 text-gray-600 text-xs">{order.email}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{order.telegramUsername || '-'}</td>
                      <td className="py-2.5 px-3 text-gray-700 font-medium">${order.totalAmount?.toFixed(2)}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{order.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{formatDate(order.createdAt)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => deleteCategory(order.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* === SETTINGS TAB === */}
          {activeTab === 'settings' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Payment Settings</h3>
              <p className="text-sm text-gray-400 mb-6">Configure wallet addresses for receiving payments in the shop.</p>

              <div className="space-y-5 max-w-xl">
                {/* TRC20 */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                    <img src="https://storage.cryptomus.com/currencies/USDT.svg" alt="USDT" className="w-5 h-5" />
                    USDT TRC20 Wallet Address
                  </label>
                  <input
                    value={shopSettings.trc20WalletAddress}
                    onChange={e => setShopSettings({ ...shopSettings, trc20WalletAddress: e.target.value })}
                    placeholder="T... (Tron network address)"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Tron network — customers will send USDT TRC20 to this address</p>
                </div>

                {/* BEP20 */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                    <img src="https://storage.cryptomus.com/currencies/USDT.svg" alt="USDT" className="w-5 h-5" />
                    USDT BEP20 Wallet Address
                  </label>
                  <input
                    value={shopSettings.bep20WalletAddress}
                    onChange={e => setShopSettings({ ...shopSettings, bep20WalletAddress: e.target.value })}
                    placeholder="0x... (BSC network address)"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">BSC network — customers will send USDT BEP20 to this address</p>
                </div>

                {/* UPI */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                    <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/shop/upi-logo.png" alt="UPI" className="w-5 h-5 object-contain rounded bg-white p-[2px] border border-gray-200" />
                    UPI ID
                  </label>
                  <input
                    value={shopSettings.upiId}
                    onChange={e => setShopSettings({ ...shopSettings, upiId: e.target.value })}
                    placeholder="yourname@upi"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">UPI payments — manual delivery required</p>
                </div>

                {/* Save button */}
                <div className="pt-2">
                  <button onClick={saveSettings} disabled={savingSettings}
                    className="px-6 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm shadow-violet-600/20">
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </Card>

      {/* === PRODUCT MODAL === */}
      <Modal isOpen={showProductModal} onClose={() => setShowProductModal(false)} title={editingProduct ? 'Edit Product' : 'Add Product'}>
        <div className="space-y-4">
          <Input label="Title" value={productForm.title} onChange={e => setProductForm({ ...productForm, title: e.target.value })} placeholder="Product title" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} placeholder="Product description"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none h-20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Price ($)" type="number" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} placeholder="0.00" />
            <Input label="Stock" type="number" value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: e.target.value })} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select value={productForm.platform} onChange={e => setProductForm({ ...productForm, platform: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={productForm.categoryId} onChange={e => setProductForm({ ...productForm, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={productForm.status} onChange={e => setProductForm({ ...productForm, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <Input label="Image URL" value={productForm.image} onChange={e => setProductForm({ ...productForm, image: e.target.value })} placeholder="https://..." />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Features (one per line)</label>
            <textarea value={productForm.features} onChange={e => setProductForm({ ...productForm, features: e.target.value })} placeholder="Feature 1&#10;Feature 2"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none h-20" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowProductModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={saveProduct} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">{editingProduct ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* === CATEGORY MODAL === */}
      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title={editingCategory ? 'Edit Category' : 'New Category'}>
        <div className="space-y-5">
          {/* Image upload area */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Category Image</label>
            <div
              onClick={() => categoryFileRef.current?.click()}
              className="relative w-full h-36 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 bg-gray-50/50 flex flex-col items-center justify-center cursor-pointer transition-colors group overflow-hidden"
            >
              {categoryImagePreview || categoryForm.image ? (
                <>
                  <img src={categoryImagePreview || categoryForm.image} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Change Image</span>
                  </div>
                </>
              ) : (
                <>
                  <svg className="w-8 h-8 text-gray-300 mb-2 group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5V19.5a1.5 1.5 0 001.5 1.5z" />
                  </svg>
                  <span className="text-xs text-gray-400 group-hover:text-violet-400 transition-colors">Click to upload image</span>
                  <span className="text-[10px] text-gray-300 mt-0.5">PNG, JPG, WebP up to 5MB</span>
                </>
              )}
              <input ref={categoryFileRef} type="file" accept="image/*" onChange={handleCategoryImageUpload} className="hidden" />
            </div>
            {/* Or paste URL */}
            <div className="mt-2">
              <input
                type="text"
                value={categoryForm.image}
                onChange={e => { setCategoryForm({ ...categoryForm, image: e.target.value }); setCategoryImagePreview(e.target.value) }}
                placeholder="Or paste image URL..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Name + Slug row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Name</label>
              <input
                value={categoryForm.name}
                onChange={e => {
                  const name = e.target.value
                  const autoSlug = !editingCategory ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : categoryForm.slug
                  setCategoryForm({ ...categoryForm, name, slug: autoSlug })
                }}
                placeholder="e.g. Facebook Profiles"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Slug</label>
              <input
                value={categoryForm.slug}
                onChange={e => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                placeholder="auto-generated"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-gray-50"
              />
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Icon (optional)</label>
            <input
              value={categoryForm.icon}
              onChange={e => setCategoryForm({ ...categoryForm, icon: e.target.value })}
              placeholder="SVG path or icon name"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
            />
          </div>

          {/* Status toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <p className="text-[11px] text-gray-400">Show this category in the shop</p>
            </div>
            <button
              onClick={() => setCategoryForm({ ...categoryForm, status: categoryForm.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${categoryForm.status === 'ACTIVE' ? 'bg-violet-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${categoryForm.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1 border-t border-gray-100">
            <button onClick={() => setShowCategoryModal(false)} className="px-5 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={saveCategory} className="px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm shadow-violet-600/20">
              {editingCategory ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </div>
      </Modal>
      {/* Deliver Order Modal */}
      <Modal isOpen={!!deliverOrder} onClose={() => { if (!delivering) setDeliverOrder(null) }} title="Deliver Order">
        {deliverOrder && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Order</span><span className="font-mono font-medium text-gray-800">{deliverOrder.orderNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="text-gray-800">{deliverOrder.email}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold text-emerald-600">${deliverOrder.totalAmount?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="text-gray-800">{deliverOrder.items?.map((i: any) => i.product?.title).join(', ')}</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Content</label>
              <textarea
                value={deliveryContent}
                onChange={e => setDeliveryContent(e.target.value)}
                placeholder="Paste the account credentials, links, or any delivery details here...&#10;&#10;Example:&#10;Email: user@example.com&#10;Password: abc123&#10;Profile Link: https://..."
                rows={8}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">This content will be emailed to {deliverOrder.email}</p>
            </div>
            <div className="flex justify-end gap-3 pt-1 border-t border-gray-100">
              <button onClick={() => setDeliverOrder(null)} disabled={delivering} className="px-5 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!deliveryContent.trim()) { toast.error('Error', 'Please enter delivery content'); return }
                  setDelivering(true)
                  try {
                    await shopApi.orders.deliver(deliverOrder.id, deliveryContent)
                    toast.success('Delivered', `Order delivered & email sent to ${deliverOrder.email}`)
                    setDeliverOrder(null)
                    setDeliveryContent('')
                    fetchOrders()
                    fetchStats()
                  } catch (e: any) { toast.error('Error', e.message) }
                  setDelivering(false)
                }}
                disabled={delivering || !deliveryContent.trim()}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {delivering && <Loader2 className="w-4 h-4 animate-spin" />}
                {delivering ? 'Sending...' : 'Deliver & Send Email'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      {/* Image Preview Overlay */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center cursor-pointer" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Payment proof" className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </DashboardLayout>
  )
}
