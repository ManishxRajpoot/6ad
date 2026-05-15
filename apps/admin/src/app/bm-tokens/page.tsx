'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { bmTokensApi, usersApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import {
  KeyRound, Plus, X, RefreshCw, Trash2, CheckCircle2, AlertCircle,
  Building2, Clock, Loader2, Eye, EyeOff, ShieldCheck, ShieldAlert,
  ChevronRight, Search, Wallet, TrendingUp, Activity, UserCircle2,
} from 'lucide-react'

type BmToken = {
  id: string
  bmId: string
  bmName: string | null
  verificationStatus: string | null
  status: string
  tokenType: string | null
  scopes: string[]
  fbProfileId: string | null
  fbProfileName: string | null
  systemUserId: string | null
  addedAt: string
  lastUsedAt: string | null
  lastErrorAt: string | null
  lastError: string | null
  validatedAt: string | null
  linkedAccountsCount: number
  updatedAt: string
}

type LinkedAccount = {
  id: string
  accountId: string
  accountName: string
  status: string
  balance: number
  totalDeposit: number
  totalSpend: number
  currency: string
  spendCap?: number | null
  remaining?: number | null
  live?: boolean
  inDb?: boolean
  userName?: string | null
  userEmail?: string | null
  fbStatus?: number | null
  disableReason?: number | null
}

// FB account_status numeric → label / colour
function fbStatusInfo(s?: number | null): { label: string; tone: 'green' | 'red' | 'amber' | 'gray'; disabled: boolean } {
  switch (s) {
    case 1:   return { label: 'Active', tone: 'green', disabled: false }
    case 2:   return { label: 'Disabled', tone: 'red', disabled: true }
    case 3:   return { label: 'Unsettled', tone: 'amber', disabled: false }
    case 7:   return { label: 'Risk Review', tone: 'amber', disabled: true }
    case 8:   return { label: 'Pending Settlement', tone: 'amber', disabled: false }
    case 9:   return { label: 'Grace Period', tone: 'amber', disabled: false }
    case 100: return { label: 'Pending Closure', tone: 'red', disabled: true }
    case 101: return { label: 'Closed', tone: 'red', disabled: true }
    case 201: return { label: 'Active', tone: 'green', disabled: false }
    case 202: return { label: 'Closed', tone: 'red', disabled: true }
    default:  return { label: s != null ? `Status ${s}` : 'Unknown', tone: 'gray', disabled: false }
  }
}

export default function BmTokensPage() {
  const [tokens, setTokens] = useState<BmToken[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [linkedAccounts, setLinkedAccounts] = useState<Record<string, LinkedAccount[]>>({})
  const [bmStats, setBmStats] = useState<Record<string, { ownedCount: number | null; liveCount: number; dbLinkedCount: number }>>({})
  const [users, setUsers] = useState<Array<{ id: string; username: string; email?: string }>>([])
  const [importing, setImporting] = useState<string | null>(null)             // accountId being imported
  const [pickerForAccount, setPickerForAccount] = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [findResult, setFindResult] = useState<{
    found: boolean; bmTokenId?: string; bmId?: string; bmName?: string | null;
    accountName?: string | null; userName?: string | null; cheetah?: boolean; queryId?: string;
  } | null>(null)
  const [findLoading, setFindLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [refreshingOwnerId, setRefreshingOwnerId] = useState<string | null>(null)

  const handleRefreshOwner = async (id: string) => {
    setRefreshingOwnerId(id)
    try {
      const r = await bmTokensApi.refreshOwner(id)
      toast.success('Profile fetched', `${r.bmToken.fbProfileName || 'unknown'} · ${r.bmToken.fbProfileId || ''}`)
      await loadTokens()
    } catch (e: any) {
      toast.error('Refresh failed', e.message)
    } finally {
      setRefreshingOwnerId(null)
    }
  }
  const [searchQuery, setSearchQuery] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const loadTokens = async () => {
    try {
      const data = await bmTokensApi.list()
      setTokens(data.tokens || [])
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to load BM tokens')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTokens() }, [])

  // Load user list once — used by the "Assign to user" picker on not-in-DB cards.
  useEffect(() => {
    usersApi.getAll().then(d => setUsers(d.users || [])).catch(() => {})
  }, [])

  // Debounced ad-account-ID lookup. If the query is digits-only with >=10 chars
  // (or starts with "act_"), call /bm-tokens/find to locate the owning BM and
  // auto-expand it.
  useEffect(() => {
    const q = searchQuery.trim().replace(/^act_/i, '')
    const looksLikeAccountId = /^\d{10,20}$/.test(q)
    if (!looksLikeAccountId) {
      setFindResult(null)
      setFindLoading(false)
      return
    }
    setFindLoading(true)
    const timer = setTimeout(async () => {
      try {
        const r = await bmTokensApi.find(q)
        setFindResult({ ...r, queryId: q })
        if (r.found && r.bmTokenId && expandedId !== r.bmTokenId) {
          // Auto-expand the matched BM and load its accounts
          toggleExpand(r.bmTokenId)
        }
      } catch (e: any) {
        setFindResult({ found: false, queryId: q })
      } finally {
        setFindLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const filteredPickerUsers = users
    .filter(u => {
      if (!pickerSearch) return true
      const q = pickerSearch.toLowerCase()
      return u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    })
    .slice(0, 50)

  const importAccount = async (bmTokenId: string, accountId: string, userId: string, username: string) => {
    setImporting(accountId)
    try {
      await bmTokensApi.importAccount(bmTokenId, { accountId, userId })
      toast.success('Imported', `Account assigned to ${username}`)
      setPickerForAccount(null)
      setPickerSearch('')
      // Refresh the expanded BM's accounts so the card flips from "not in DB" → user pill
      const data = await bmTokensApi.get(bmTokenId)
      setLinkedAccounts(prev => ({ ...prev, [bmTokenId]: data.linkedAccounts || [] }))
      const t: any = data.token || {}
      setBmStats(prev => ({
        ...prev,
        [bmTokenId]: {
          ownedCount: t.ownedCount ?? null,
          liveCount: t.liveCount ?? (data.linkedAccounts?.length || 0),
          dbLinkedCount: t.dbLinkedCount ?? 0,
        },
      }))
      // Top-level row count refresh
      await loadTokens()
    } catch (e: any) {
      toast.error('Import failed', e.message)
    } finally {
      setImporting(null)
    }
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!linkedAccounts[id]) {
      setLoadingDetail(id)
      try {
        const data = await bmTokensApi.get(id)
        setLinkedAccounts(prev => ({ ...prev, [id]: data.linkedAccounts || [] }))
        const t: any = data.token || {}
        setBmStats(prev => ({
          ...prev,
          [id]: {
            ownedCount: t.ownedCount ?? null,
            liveCount: t.liveCount ?? (data.linkedAccounts?.length || 0),
            dbLinkedCount: t.dbLinkedCount ?? 0,
          },
        }))
      } catch (e: any) {
        toast.error('Error', e.message || 'Failed to load detail')
      } finally {
        setLoadingDetail(null)
      }
    }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      const r = await bmTokensApi.sync(id)
      toast.success('Synced', `${r.newlyLinked} newly linked, ${r.totalLinked} total`)
      await loadTokens()
      setLinkedAccounts(prev => { const c = { ...prev }; delete c[id]; return c })
      if (expandedId === id) {
        const data = await bmTokensApi.get(id)
        setLinkedAccounts(prev => ({ ...prev, [id]: data.linkedAccounts || [] }))
        const t: any = data.token || {}
        setBmStats(prev => ({
          ...prev,
          [id]: {
            ownedCount: t.ownedCount ?? null,
            liveCount: t.liveCount ?? (data.linkedAccounts?.length || 0),
            dbLinkedCount: t.dbLinkedCount ?? 0,
          },
        }))
      }
    } catch (e: any) {
      toast.error('Sync failed', e.message)
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string, bmName: string | null) => {
    const ok = await confirm({
      title: 'Remove BM Token?',
      message: `Remove the BMSU token for ${bmName || 'this BM'}? Recharges will fall back to the extension flow until you re-add it. Linked ad accounts keep their sourceBmId.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await bmTokensApi.remove(id)
      toast.success('Removed', 'BM token removed')
      await loadTokens()
    } catch (e: any) {
      toast.error('Delete failed', e.message)
    }
  }

  // Aggregate stats — sums across all linked accounts that have been expanded/loaded.
  // Falls back to per-token linkedAccountsCount until the user expands.
  const allLoadedAccounts = Object.values(linkedAccounts).flat()
  const totalLinked = tokens.reduce((s, t) => s + (t.linkedAccountsCount || 0), 0)
  const totalSpent = allLoadedAccounts.reduce((s, a) => s + (a.totalSpend || 0), 0)
  const totalRemaining = allLoadedAccounts.reduce((s, a) => s + (a.remaining || 0), 0)
  const activeBMs = tokens.filter(t => t.status === 'ACTIVE').length

  const filteredTokens = tokens.filter(t => {
    if (!searchQuery) return true
    // If the user typed an ad-account-ID and we resolved it to a BM, narrow to that BM only
    if (findResult?.found && findResult.bmTokenId) {
      return t.id === findResult.bmTokenId
    }
    const q = searchQuery.trim().toLowerCase()
    return [t.bmName, t.bmId, t.tokenType, t.status].filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q))
  })

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
      ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Active' },
      PAUSED: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Paused' },
      EXPIRED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Expired' },
      INVALID: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Invalid' },
    }
    const c = config[status] || { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400', label: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {c.label}
      </span>
    )
  }

  return (
    <DashboardLayout title="BM Tokens" subtitle="Server-side recharge via Meta System User tokens — no extension needed">
      <style jsx>{`
        @keyframes tabFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .row-animate { animation: tabFadeIn 0.25s ease-out forwards; opacity: 0; }
      `}</style>

      {/* Top Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by BM name, BM ID, ad account ID (act_… or digits)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-[280px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTokens}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add BM Token
          </button>
        </div>
      </div>

      {/* Ad-account-ID lookup banner */}
      {(findLoading || findResult) && (
        <div className="mb-4">
          {findLoading ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up <span className="font-mono">act_{searchQuery.replace(/^act_/i, '').trim()}</span>…
            </div>
          ) : findResult?.found && findResult.cheetah ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                <span className="font-mono">act_{findResult.queryId}</span> belongs to <strong>Cheetah</strong>
                {findResult.userName && <> · user <strong>{findResult.userName}</strong></>}
              </span>
            </div>
          ) : findResult?.found ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                <span className="font-mono">act_{findResult.queryId}</span> belongs to <strong>{findResult.bmName || findResult.bmId}</strong>
                {findResult.accountName && <> · <span className="font-medium">{findResult.accountName}</span></>}
                {findResult.userName && <> · user <strong>{findResult.userName}</strong></>}
              </span>
            </div>
          ) : findResult ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              No BM found for <span className="font-mono">act_{findResult.queryId}</span>. Account is not in DB and no active BM token owns it.
            </div>
          ) : null}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">BMs Configured</span>
              <p className="text-2xl font-bold text-gray-800">{tokens.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{activeBMs} active</p>
            </div>
            <span className="px-2 py-0.5 bg-violet-500 text-white text-sm font-medium rounded">BM</span>
          </div>
          <StatsChart value={tokens.length} color="#8B5CF6" filterId="bm-cnt-f" gradientId="bm-cnt-g" clipId="bm-cnt-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Ad Accounts Linked</span>
              <p className="text-2xl font-bold text-gray-800">{totalLinked}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">across all BMs</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500 text-white text-sm font-medium rounded">Linked</span>
          </div>
          <StatsChart value={totalLinked} color="#10B981" filterId="bm-link-f" gradientId="bm-link-g" clipId="bm-link-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Total Spent (live)</span>
              <p className="text-2xl font-bold text-gray-800">${totalSpent.toFixed(2)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">expand BMs to load</p>
            </div>
            <span className="px-2 py-0.5 bg-amber-500 text-white text-sm font-medium rounded">Spent</span>
          </div>
          <StatsChart value={totalSpent} color="#F59E0B" filterId="bm-spent-f" gradientId="bm-spent-g" clipId="bm-spent-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Total Remaining</span>
              <p className="text-2xl font-bold text-emerald-600">${totalRemaining.toFixed(2)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">cap − spent</p>
            </div>
            <span className="px-2 py-0.5 bg-green-500 text-white text-sm font-medium rounded">USD</span>
          </div>
          <StatsChart value={totalRemaining} color="#22C55E" filterId="bm-rem-f" gradientId="bm-rem-g" clipId="bm-rem-c" />
        </Card>
      </div>

      {/* Main Card with Table */}
      <Card className="p-0 overflow-hidden flex flex-col" style={{ minHeight: 'calc(100vh - 320px)' }}>
        <div className="overflow-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
              <span className="text-gray-500 text-sm ml-2">Loading…</span>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <KeyRound className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {tokens.length === 0 ? 'No BM Tokens Yet' : 'No matches'}
              </h3>
              <p className="text-gray-500 text-sm mb-4 max-w-md">
                {tokens.length === 0
                  ? 'Add a Meta System User token to enable server-side recharge for ad accounts owned by that Business Manager. Tokens are encrypted at rest.'
                  : 'Try a different search query.'}
              </p>
              {tokens.length === 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Your First BM
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Table header */}
              <div className="hidden lg:grid grid-cols-[32px,110px,1fr,140px,120px,160px,180px] gap-3 px-4 py-2 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10">
                <span />
                <span>Status</span>
                <span>Business Manager</span>
                <span>Token Type</span>
                <span className="text-right">Linked</span>
                <span>Added</span>
                <span className="text-right">Actions</span>
              </div>

              {filteredTokens.map((t, index) => {
                const isExpanded = expandedId === t.id
                const accounts = linkedAccounts[t.id] || []
                const bmTotalSpent = accounts.reduce((s, a) => s + (a.totalSpend || 0), 0)
                const bmTotalRemaining = accounts.reduce((s, a) => s + (a.remaining || 0), 0)

                return (
                  <div key={t.id} className={`row-animate ${isExpanded ? 'bg-violet-50/30' : 'hover:bg-gray-50/50'}`} style={{ animationDelay: `${index * 20}ms` }}>
                    <button
                      onClick={() => toggleExpand(t.id)}
                      className="w-full grid grid-cols-[32px,110px,1fr,140px,120px,160px,180px] gap-3 px-4 py-3 items-center text-left"
                    >
                      <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} text-gray-400`}>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                      <span>{getStatusBadge(t.status)}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex-shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[13px] text-gray-900 truncate">{t.bmName || `BM ${t.bmId}`}</span>
                            {t.verificationStatus === 'verified' && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            )}
                            {t.verificationStatus === 'rejected' && (
                              <ShieldAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="font-mono text-[10px] text-gray-400 truncate">{t.bmId}</p>
                          {/* FB profile / system-user owner of the token */}
                          {(t.fbProfileName || t.fbProfileId) && (
                            <p className="text-[10px] text-gray-500 truncate" title={`Token owner UID: ${t.fbProfileId || '—'}`}>
                              <span className="text-gray-400">owner: </span>
                              <span className="text-gray-700 font-medium">{t.fbProfileName || 'unknown'}</span>
                              {t.fbProfileId && (
                                <span className="font-mono text-gray-400"> · {t.fbProfileId}</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600 w-fit">
                        <KeyRound className="w-3 h-3" /> {t.tokenType || 'unknown'}
                      </span>
                      <div className="text-right">
                        {bmStats[t.id]?.ownedCount != null ? (
                          <>
                            <p className="font-semibold text-[13px] text-gray-900">
                              {bmStats[t.id]!.ownedCount}
                              <span className="text-gray-400 font-normal"> created</span>
                            </p>
                            <p className="text-[10px] text-gray-400">{t.linkedAccountsCount} in DB</p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-[13px] text-gray-900">{t.linkedAccountsCount}</p>
                            <p className="text-[10px] text-gray-400">in DB · expand for live</p>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {timeAgo(t.addedAt)}
                      </span>
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSync(t.id)}
                          disabled={syncingId === t.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-600 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-50"
                        >
                          {syncingId === t.id
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Syncing</>
                            : <><RefreshCw className="w-3 h-3" /> Sync</>}
                        </button>
                        <button
                          onClick={() => handleRefreshOwner(t.id)}
                          disabled={refreshingOwnerId === t.id}
                          title="Fetch /me to identify which FB profile owns this token"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          {refreshingOwnerId === t.id
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> </>
                            : <><UserCircle2 className="w-3 h-3" /> Profile</>}
                        </button>
                        <button
                          onClick={() => handleDelete(t.id, t.bmName)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </button>

                    {/* Expanded panel — linked ad accounts */}
                    {isExpanded && (
                      <div className="bg-gradient-to-br from-gray-50 to-white p-6 border-y-2 border-violet-200">
                        {loadingDetail === t.id ? (
                          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading linked accounts…
                          </div>
                        ) : accounts.length > 0 ? (
                          <>
                            {/* Inline summary */}
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-gray-200 text-xs">
                                <Building2 className="w-3.5 h-3.5 text-violet-600" />
                                <span className="text-gray-500">Linked</span>
                                <span className="font-semibold text-gray-900">{accounts.length}</span>
                              </div>
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-gray-200 text-xs">
                                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-gray-500">Spent</span>
                                <span className="font-semibold text-gray-900">${bmTotalSpent.toFixed(2)}</span>
                              </div>
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-gray-200 text-xs">
                                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-gray-500">Remaining</span>
                                <span className="font-semibold text-emerald-700">${bmTotalRemaining.toFixed(2)}</span>
                              </div>
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider ml-auto">
                                <Activity className="w-3 h-3" /> Live from Meta
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {accounts.map(a => {
                                const cap = a.spendCap ?? 0
                                const spent = a.totalSpend ?? 0
                                const pct = cap > 0 ? Math.min((spent / cap) * 100, 100) : 0
                                const fb = fbStatusInfo(a.fbStatus)
                                const toneCls = {
                                  green: 'bg-emerald-50 text-emerald-700',
                                  red:   'bg-red-50 text-red-700',
                                  amber: 'bg-amber-50 text-amber-700',
                                  gray:  'bg-gray-100 text-gray-600',
                                }[fb.tone]
                                return (
                                  <div key={a.id} className={`relative bg-white border rounded-lg p-3 hover:shadow-sm transition-all ${fb.disabled ? 'opacity-60 grayscale-[30%]' : ''} ${a.inDb ? 'border-gray-200 hover:border-violet-300' : 'border-dashed border-amber-200 hover:border-amber-300'}`}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {a.userName ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-semibold flex-shrink-0" title={a.userEmail || ''}>
                                              <span className="w-1 h-1 rounded-full bg-violet-500" />
                                              {a.userName}
                                            </span>
                                          ) : a.inDb ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-medium flex-shrink-0">
                                              unassigned
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => { setPickerForAccount(a.accountId); setPickerSearch('') }}
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-medium flex-shrink-0 transition-colors"
                                              title="Click to assign this ad account to a user"
                                            >
                                              <Plus className="w-2.5 h-2.5" />
                                              assign user
                                            </button>
                                          )}
                                          <p className="font-semibold text-[13px] text-gray-900 truncate">{a.accountName}</p>
                                        </div>
                                        <p className="font-mono text-[10px] text-gray-400 truncate mt-0.5">act_{a.accountId}</p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${toneCls}`} title={a.disableReason ? `disable_reason ${a.disableReason}` : ''}>
                                          <span className={`w-1 h-1 rounded-full ${fb.tone === 'green' ? 'bg-emerald-500 animate-pulse' : fb.tone === 'red' ? 'bg-red-500' : fb.tone === 'amber' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                                          {fb.label}
                                        </span>
                                      </div>
                                    </div>

                                    {a.spendCap != null ? (
                                      <>
                                        <div className="flex items-baseline justify-between mb-1">
                                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Remaining</span>
                                          <span className="font-bold text-[15px] text-emerald-600">{a.currency} ${(a.remaining ?? 0).toFixed(2)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-1.5">
                                          <div
                                            className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                                          <span>spent <span className="font-semibold text-gray-700">${spent.toFixed(2)}</span></span>
                                          <span>cap <span className="font-semibold text-gray-700">${cap.toFixed(2)}</span></span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-baseline justify-between">
                                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Balance</span>
                                          <span className="font-bold text-[15px] text-gray-900">{a.currency} ${(a.balance ?? 0).toFixed(2)}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1">spent <span className="font-semibold text-gray-700">${spent.toFixed(2)}</span> · no cap</p>
                                      </>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-500 py-4 text-center">
                            No ad accounts in your DB are linked to this BM yet. Click <RefreshCw className="w-3.5 h-3.5 inline" /> Sync to re-fetch from Meta.
                          </div>
                        )}

                        {t.lastError && (
                          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Last error · {t.lastErrorAt && timeAgo(t.lastErrorAt)} ago</p>
                              <p className="mt-0.5 break-all">{t.lastError}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {showAddModal && (
        <AddBmTokenModal
          onClose={() => setShowAddModal(false)}
          onSaved={async () => { setShowAddModal(false); await loadTokens() }}
        />
      )}

      {pickerForAccount && (() => {
        // Find which BM holds this account so we can call the right import endpoint
        const bmTokenId = Object.keys(linkedAccounts).find(
          k => linkedAccounts[k].some(a => a.accountId === pickerForAccount),
        )
        const acc = bmTokenId ? linkedAccounts[bmTokenId].find(a => a.accountId === pickerForAccount) : null
        if (!bmTokenId || !acc) return null
        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { setPickerForAccount(null); setPickerSearch('') }}>
            <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-900">Assign Ad Account to User</h3>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  <span className="font-medium text-gray-700">{acc.accountName}</span>
                  <span className="font-mono text-gray-400 ml-2">act_{acc.accountId}</span>
                </p>
              </div>
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search users by name or email…"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filteredPickerUsers.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">No users match.</div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {filteredPickerUsers.map(u => (
                      <li key={u.id}>
                        <button
                          disabled={importing === acc.accountId}
                          onClick={() => importAccount(bmTokenId, acc.accountId, u.id, u.username)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-violet-50 transition-colors disabled:opacity-50 text-left"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{u.username}</p>
                            {u.email && <p className="text-xs text-gray-500 truncate">{u.email}</p>}
                          </div>
                          {importing === acc.accountId ? (
                            <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => { setPickerForAccount(null); setPickerSearch('') }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </DashboardLayout>
  )
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60); if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24); return `${d}d ago`
}

// ─── Add BM Token Modal ──────────────────────────────────────────────

function AddBmTokenModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<'paste' | 'preview' | 'saving'>('paste')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [validating, setValidating] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const handleValidate = async () => {
    if (!token.trim()) { toast.error('Error', 'Paste a token first'); return }
    setValidating(true)
    try {
      const r = await bmTokensApi.validate(token.trim())
      if (!r.valid) { toast.error('Invalid token', r.error || 'Token is invalid'); return }
      setPreview(r); setStep('preview')
    } catch (e: any) {
      toast.error('Validation failed', e.message)
    } finally { setValidating(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await bmTokensApi.save({ token: token.trim() })
      toast.success('Saved', `${r.linkedAccounts} ad accounts linked`)
      onSaved()
    } catch (e: any) {
      toast.error('Save failed', e.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-violet-600" /> Add BM Token
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {step === 'paste' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                <div className="font-semibold mb-1">How to get a System User token:</div>
                <ol className="list-decimal pl-5 space-y-0.5 text-xs">
                  <li>Open Meta Business Settings for the BM you want to manage</li>
                  <li>Users → System Users → <em>Add</em> (or pick existing) → Generate Token</li>
                  <li>Select your "API" app, check <code>ads_management</code> + <code>business_management</code></li>
                  <li>Copy the token (starts with <code>EAA…</code>) and paste below</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System User Token <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="EAALFDny..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Encrypted with AES-256-GCM at rest.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleValidate}
                  disabled={validating || !token.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {validating ? <><Loader2 className="w-4 h-4 animate-spin" /> Validating</> : 'Validate & Continue'}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-emerald-900">Token Validated</div>
                  <div className="text-emerald-800 text-xs mt-1">
                    {preview.tokenInfo.type} token, {preview.tokenInfo.permanent ? 'never expires' : `expires ${new Date(preview.tokenInfo.expiresAt * 1000).toLocaleString()}`}
                  </div>
                </div>
              </div>

              {preview.ownerBM && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Business Manager</div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-600" />
                    <span className="font-semibold text-gray-900">{preview.ownerBM.name}</span>
                    {preview.ownerBM.verification_status === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono mt-1">BM ID: {preview.ownerBM.id}</div>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permissions</div>
                <div className="flex flex-wrap gap-1.5">
                  {preview.tokenInfo.scopes.map((s: string) => (
                    <span key={s} className="text-xs bg-violet-50 text-violet-800 border border-violet-200 px-2 py-0.5 rounded font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Ad Accounts ({preview.summary.totalFb} total)
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {preview.adAccounts.map((a: any) => (
                    <div key={a.accountId} className={`text-sm flex items-center justify-between py-1 px-2 rounded ${a.existsInDb ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {a.existsInDb ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                        <span className="truncate font-medium text-gray-900">{a.fbName}</span>
                        <span className="font-mono text-xs text-gray-400">act_{a.accountId}</span>
                      </div>
                      {!a.existsInDb && (
                        <span className="text-xs text-gray-500 ml-2 shrink-0">not in DB — skip</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                  <strong>{preview.summary.existsInDb}</strong> will be linked to this BM.
                  {preview.summary.notInDb > 0 && (
                    <> <strong>{preview.summary.notInDb}</strong> in FB but not in your DB will be skipped.</>
                  )}
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <button onClick={() => setStep('paste')} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  Back
                </button>
                <div className="flex gap-2">
                  <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving</> : 'Save & Link'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
