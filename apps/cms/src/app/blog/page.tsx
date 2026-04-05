'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Plus, Trash2, Pencil, Eye, EyeOff, Search, X, Check, Tag, Clock, BarChart2 } from 'lucide-react'

type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  coverImage: string | null
  category: string | null
  tags: string[]
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  authorName: string
  readTime: number
  views: number
  publishedAt: string | null
  createdAt: string
  metaTitle: string | null
  metaDesc: string | null
}

const CATEGORIES = ['Facebook Ads', 'Google Ads', 'TikTok Ads', 'Agency Tips', 'Case Studies', 'News', 'Guides']

const statusColor = {
  PUBLISHED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  DRAFT: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  ARCHIVED: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function BlogPage() {
  const token = useAuthStore((s) => s.token) || (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editPost, setEditPost] = useState<BlogPost | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', coverImage: '',
    category: '', tags: '', status: 'DRAFT' as BlogPost['status'],
    authorName: 'ADS360 Team', readTime: 3, metaTitle: '', metaDesc: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api('/cms/admin/blog', { token, cache: false })
      setPosts(data.posts || [])
    } catch { }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditPost(null)
    setError('')
    setForm({ title: '', slug: '', excerpt: '', content: '', coverImage: '', category: '', tags: '', status: 'DRAFT', authorName: 'ADS360 Team', readTime: 3, metaTitle: '', metaDesc: '' })
    setShowModal(true)
  }

  const openEdit = (p: BlogPost) => {
    setEditPost(p)
    setError('')
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt || '', content: p.content || '',
      coverImage: p.coverImage || '', category: p.category || '', tags: p.tags.join(', '),
      status: p.status, authorName: p.authorName, readTime: p.readTime,
      metaTitle: p.metaTitle || '', metaDesc: p.metaDesc || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt,
        content: form.content,
        coverImage: form.coverImage || null,
        category: form.category || null,
        tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        status: form.status,
        authorName: form.authorName,
        readTime: Number(form.readTime),
        metaTitle: form.metaTitle || null,
        metaDesc: form.metaDesc || null,
      }
      if (editPost) {
        await api(`/cms/admin/blog/${editPost.id}`, {
          method: 'PUT', token, body: JSON.stringify(payload),
        })
      } else {
        await api('/cms/admin/blog', {
          method: 'POST', token, body: JSON.stringify(payload),
        })
      }
      setShowModal(false)
      load()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return
    setDeleting(id)
    try {
      await api(`/cms/admin/blog/${id}`, { method: 'DELETE', token })
      load()
    } catch { }
    setDeleting(null)
  }

  const toggleStatus = async (p: BlogPost) => {
    const newStatus = p.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    try {
      await api(`/cms/admin/blog/${p.id}`, {
        method: 'PUT', token, body: JSON.stringify({ status: newStatus }),
      })
      load()
    } catch { }
  }

  const filtered = posts.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'ALL' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'PUBLISHED').length,
    draft: posts.filter(p => p.status === 'DRAFT').length,
    views: posts.reduce((a, p) => a + p.views, 0),
  }

  return (
    <DashboardLayout title="Blog Posts">
      <div className="flex flex-col flex-1 min-h-0 gap-3">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Posts', value: stats.total, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Published', value: stats.published, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Drafts', value: stats.draft, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { label: 'Total Views', value: stats.views.toLocaleString(), color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                <BarChart2 className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <div className="text-[11px] text-gray-400 font-medium">{s.label}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterStatus === s ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <button onClick={openCreate} className="ml-auto flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Post
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 flex-1 flex flex-col min-h-0 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">Title</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2.5">Category</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2.5">Status</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2.5">Views</th>
                <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-2.5">Date</th>
                <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-xs">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-xs">No posts found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {p.coverImage ? (
                        <img src={p.coverImage} className="w-9 h-7 rounded object-cover shrink-0 bg-gray-100" />
                      ) : (
                        <div className="w-9 h-7 rounded bg-gradient-to-br from-blue-100 to-purple-100 shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 text-[12px] leading-tight line-clamp-1">{p.title}</p>
                        <p className="text-gray-400 text-[11px] mt-0.5">/{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.category ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium">
                        <Tag className="w-2.5 h-2.5" />{p.category}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColor[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{p.views.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not published'}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleStatus(p)} title={p.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                        className={`p-1.5 rounded-lg transition-colors ${p.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                        {p.status === 'PUBLISHED' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                        className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-800">{editPost ? 'Edit Post' : 'New Blog Post'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Post title..." />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Slug</label>
                  <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-xs" placeholder="post-slug" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Excerpt</label>
                <textarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" placeholder="Short description for blog cards..." />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Content (HTML/Markdown)</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={8}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs" placeholder="Write your blog content here..." />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Cover Image URL</label>
                <input value={form.coverImage} onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="https://..." />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
                    <option value="">Select...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Tags (comma separated)</label>
                  <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="ads, facebook, tips" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Read Time (min)</label>
                  <input type="number" value={form.readTime} onChange={e => setForm(f => ({ ...f, readTime: parseInt(e.target.value) || 3 }))} min={1}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Author Name</label>
                  <input value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as BlogPost['status'] }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white">
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50/50">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">SEO Settings</p>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Meta Title</label>
                  <input value={form.metaTitle} onChange={e => setForm(f => ({ ...f, metaTitle: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="SEO title..." />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Meta Description</label>
                  <textarea value={form.metaDesc} onChange={e => setForm(f => ({ ...f, metaDesc: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" placeholder="SEO description..." />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                <Check className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : editPost ? 'Update Post' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
