'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Plus, Trash2, Eye, EyeOff, Pencil, X, Check, Calendar, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'

type Headline = {
  id: string
  headline: string
  subtitle: string
  order: number
  isActive: boolean
}

export default function HeadlinesPage() {
  const token = useAuthStore((s) => s.token) || (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
  const [headlines, setHeadlines] = useState<Headline[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newHeadline, setNewHeadline] = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [editHeadline, setEditHeadline] = useState('')
  const [editSubtitle, setEditSubtitle] = useState('')
  const [todayIndex, setTodayIndex] = useState(-1)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [selectMultiple, setSelectMultiple] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [perPage, setPerPage] = useState(15)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const updateIndicator = useCallback(() => {
    if (!tabsRef.current) return
    const activeBtn = tabsRef.current.querySelector('[data-active="true"]') as HTMLElement
    if (activeBtn) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      })
    }
  }, [])

  useEffect(() => {
    updateIndicator()
  }, [filterStatus, updateIndicator])

  const fetchHeadlines = async () => {
    if (!token) return
    try {
      const [data, todayData] = await Promise.all([
        api('/cms/admin/headlines', { token, cache: false }),
        api('/cms/headlines/today', { cache: false }),
      ])
      setHeadlines(data.headlines || [])
      setTodayIndex(todayData.dayIndex ?? -1)
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('401') || err.message?.includes('Invalid')) {
        localStorage.removeItem('token')
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
        return
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHeadlines() }, [token])

  const handleAdd = async () => {
    if (!token || !newHeadline.trim() || !newSubtitle.trim()) return
    try {
      await api('/cms/admin/headlines', {
        method: 'POST', token,
        body: JSON.stringify({ headline: newHeadline.trim(), subtitle: newSubtitle.trim() }),
      })
      setNewHeadline(''); setNewSubtitle(''); setAdding(false)
      fetchHeadlines()
    } catch (err: any) { alert(err.message) }
  }

  const handleUpdate = async (id: string) => {
    if (!token) return
    try {
      await api(`/cms/admin/headlines/${id}`, {
        method: 'PUT', token,
        body: JSON.stringify({ headline: editHeadline, subtitle: editSubtitle }),
      })
      setEditingId(null)
      fetchHeadlines()
    } catch (err: any) { alert(err.message) }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    if (!token) return
    await api(`/cms/admin/headlines/${id}`, { method: 'PUT', token, body: JSON.stringify({ isActive: !isActive }) })
    fetchHeadlines()
  }

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Delete this headline?')) return
    await api(`/cms/admin/headlines/${id}`, { method: 'DELETE', token })
    fetchHeadlines()
  }

  const startEdit = (h: Headline) => {
    setEditingId(h.id); setEditHeadline(h.headline); setEditSubtitle(h.subtitle)
  }

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const activeCount = headlines.filter(h => h.isActive).length
  const inactiveCount = headlines.length - activeCount

  // Filter + search
  const filtered = headlines.filter(h => {
    if (filterStatus === 'active' && !h.isActive) return false
    if (filterStatus === 'inactive' && h.isActive) return false
    if (search) {
      const q = search.toLowerCase()
      return h.headline.toLowerCase().includes(q) || h.subtitle.toLowerCase().includes(q)
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <DashboardLayout title="Hero Headlines">
      <div className="flex flex-col flex-1 min-h-0">
      {/* Action Bar — matches 6AD admin */}
      <div className="flex items-center justify-between mb-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search headlines..."
            className="w-full h-8 pl-10 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Headline
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards — exact 6AD admin pattern */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-3">
        <Card className="p-3 relative overflow-hidden min-h-[85px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[10px] text-gray-500 leading-none">Total Headlines</span>
              <p className="text-xl font-bold text-gray-800 leading-tight mt-0.5">{headlines.length}</p>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] bg-blue-500 text-white text-sm font-medium rounded">Total</span>
          </div>
          <StatsChart value={headlines.length} color="#3B82F6" filterId="hl-tot-f" gradientId="hl-tot-g" clipId="hl-tot-c" />
        </Card>

        <Card className="p-3 relative overflow-hidden min-h-[85px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[10px] text-gray-500 leading-none">Active Headlines</span>
              <p className="text-xl font-bold text-gray-800 leading-tight mt-0.5">{activeCount}</p>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500 text-white text-sm font-medium rounded">Active</span>
          </div>
          <StatsChart value={activeCount} color="#10B981" filterId="hl-act-f" gradientId="hl-act-g" clipId="hl-act-c" />
        </Card>

        <Card className="p-3 relative overflow-hidden min-h-[85px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[10px] text-gray-500 leading-none">Inactive</span>
              <p className="text-xl font-bold text-gray-800 leading-tight mt-0.5">{inactiveCount}</p>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white text-sm font-medium rounded">Inactive</span>
          </div>
          <StatsChart value={inactiveCount} color="#F59E0B" filterId="hl-ina-f" gradientId="hl-ina-g" clipId="hl-ina-c" />
        </Card>

        <Card className="p-3 relative overflow-hidden min-h-[85px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[10px] text-gray-500 leading-none">Rotation Cycle</span>
              <p className="text-xl font-bold text-gray-800 leading-tight mt-0.5">{activeCount > 0 ? `${activeCount} days` : '—'}</p>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] bg-violet-500 text-white text-sm font-medium rounded">Cycle</span>
          </div>
          <StatsChart value={activeCount} color="#8B5CF6" filterId="hl-cyc-f" gradientId="hl-cyc-g" clipId="hl-cyc-c" />
        </Card>

        <Card className="p-3 relative overflow-hidden min-h-[85px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[10px] text-gray-500 leading-none">Today&apos;s Day</span>
              <p className="text-xl font-bold text-blue-600 leading-tight mt-0.5">#{todayIndex + 1}</p>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] bg-green-500 text-white text-sm font-medium rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
            </span>
          </div>
          <StatsChart value={todayIndex + 1} color="#22C55E" filterId="hl-tdy-f" gradientId="hl-tdy-g" clipId="hl-tdy-c" />
        </Card>
      </div>

      {/* Tabs + Table — matches 6AD admin deposit list */}
      <Card className="overflow-hidden flex-1 flex flex-col">
        {/* Tab bar */}
        <div className="flex items-center border-b border-gray-100 px-3 h-10">
          <div className="relative flex items-center" ref={tabsRef}>
            {[
              { key: 'all' as const, label: 'All Headlines' },
              { key: 'active' as const, label: 'Active' },
              { key: 'inactive' as const, label: 'Inactive' },
            ].map((tab) => (
              <button
                key={tab.key}
                data-active={filterStatus === tab.key}
                onClick={() => { setFilterStatus(tab.key); setPage(1) }}
                className={`px-2.5 h-10 flex items-center text-xs font-medium transition-colors relative ${
                  filterStatus === tab.key
                    ? 'text-violet-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Sliding indicator */}
            <div
              className="absolute bottom-0 h-0.5 bg-violet-500 rounded-full transition-all duration-300 ease-in-out"
              style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
            />
          </div>

          {/* Select Multiple toggle + filter chips */}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
              <div
                onClick={() => { setSelectMultiple(!selectMultiple); setSelectedItems([]) }}
                className={`w-7 h-[16px] rounded-full transition-colors relative cursor-pointer ${selectMultiple ? 'bg-violet-500' : 'bg-gray-200'}`}
              >
                <div className={`w-3 h-3 rounded-full bg-white absolute top-[2px] transition-all ${selectMultiple ? 'left-[14px]' : 'left-[2px]'}`} />
              </div>
              Select Multiple
            </label>

            <span className="text-[10px] text-gray-300">|</span>

            <div className="flex items-center bg-gray-100 rounded p-0.5 text-[11px]">
              <span className="px-1.5 py-0.5 font-medium text-gray-500">Card:</span>
              {['All', `Active (${activeCount})`, 'Inactive'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => { setFilterStatus(i === 0 ? 'all' : i === 1 ? 'active' : 'inactive'); setPage(1) }}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                    (i === 0 && filterStatus === 'all') || (i === 1 && filterStatus === 'active') || (i === 2 && filterStatus === 'inactive')
                      ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Add form */}
        {adding && (
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <input
                  value={newHeadline}
                  onChange={(e) => setNewHeadline(e.target.value)}
                  placeholder='Headline text (use \n for line break, e.g. "SCALE YOUR\nBUSINESS")'
                  className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 bg-white"
                />
                <input
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder="Subtitle text"
                  className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 bg-white"
                />
              </div>
              <div className="flex gap-2 pt-0.5">
                <button onClick={handleAdd} className="h-9 px-4 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">Save</button>
                <button onClick={() => { setAdding(false); setNewHeadline(''); setNewSubtitle('') }} className="h-9 px-4 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Table header — matching 6AD admin */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {selectMultiple && (
                  <th className="w-10 px-3 py-1.5 text-left">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                )}
                <th className="w-12 px-3 py-1.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Headline</th>
                <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Subtitle</th>
                <th className="w-24 px-3 py-1.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="w-20 px-3 py-1.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Day</th>
                <th className="w-28 px-3 py-1.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-400">Loading headlines...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-400">No headlines found</td></tr>
              ) : paginated.map((h) => {
                const globalIdx = headlines.findIndex(x => x.id === h.id)
                const isToday = globalIdx === todayIndex

                return (
                  <tr key={h.id} className={`hover:bg-gray-50/50 transition-colors ${isToday ? 'bg-blue-50/30' : ''} ${!h.isActive ? 'opacity-50' : ''}`}>
                    {selectMultiple && (
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(h.id)}
                          onChange={() => toggleSelection(h.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-xs font-mono text-gray-400">#{h.order + 1}</td>
                    <td className="px-3 py-1.5">
                      {editingId === h.id ? (
                        <input
                          value={editHeadline}
                          onChange={(e) => setEditHeadline(e.target.value)}
                          className="w-full h-7 px-2 rounded border border-gray-300 text-sm focus:border-violet-500 focus:outline-none"
                        />
                      ) : (
                        <p className="text-[13px] font-semibold text-gray-900">{h.headline.replace(/\n/g, ' ')}</p>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {editingId === h.id ? (
                        <input
                          value={editSubtitle}
                          onChange={(e) => setEditSubtitle(e.target.value)}
                          className="w-full h-7 px-2 rounded border border-gray-300 text-sm focus:border-violet-500 focus:outline-none"
                        />
                      ) : (
                        <p className="text-[12px] text-gray-500 max-w-[300px] truncate">{h.subtitle}</p>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {isToday ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Live
                        </span>
                      ) : h.isActive ? (
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">• Active</span>
                      ) : (
                        <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-400">
                      {isToday ? <span className="text-blue-600 font-semibold">Today</span> : `Day ${globalIdx + 1}`}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        {editingId === h.id ? (
                          <>
                            <button onClick={() => handleUpdate(h.id)} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(h)} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Edit">
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                            <button onClick={() => handleToggle(h.id, h.isActive)} className="p-1 hover:bg-gray-100 rounded transition-colors" title={h.isActive ? 'Deactivate' : 'Activate'}>
                              {h.isActive ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-300" />}
                            </button>
                            <button onClick={() => handleDelete(h.id)} className="p-1 hover:bg-red-50 rounded transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination — exact 6AD admin style */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}</span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
              className="h-7 px-1 rounded border border-gray-200 text-xs text-gray-600 bg-white cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    p === page ? 'bg-blue-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </Card>
      </div>
    </DashboardLayout>
  )
}
