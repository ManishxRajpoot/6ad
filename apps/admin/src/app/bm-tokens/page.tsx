'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { bmTokensApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import {
  KeyRound, Plus, X, RefreshCw, Trash2, CheckCircle2, AlertCircle,
  Building2, Users, Clock, Loader2, Eye, EyeOff, ShieldCheck, ShieldAlert,
  ChevronRight, ChevronDown,
} from 'lucide-react'

type BmToken = {
  id: string
  bmId: string
  bmName: string | null
  verificationStatus: string | null
  status: string
  tokenType: string | null
  scopes: string[]
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
}

export default function BmTokensPage() {
  const [tokens, setTokens] = useState<BmToken[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [linkedAccounts, setLinkedAccounts] = useState<Record<string, LinkedAccount[]>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const loadTokens = async () => {
    try {
      const data = await bmTokensApi.list()
      setTokens(data.tokens || [])
    } catch (e: any) {
      showToast(e.message || 'Failed to load BM tokens', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTokens() }, [])

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!linkedAccounts[id]) {
      setLoadingDetail(id)
      try {
        const data = await bmTokensApi.get(id)
        setLinkedAccounts(prev => ({ ...prev, [id]: data.linkedAccounts || [] }))
      } catch (e: any) {
        showToast(e.message || 'Failed to load detail', 'error')
      } finally {
        setLoadingDetail(null)
      }
    }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      const r = await bmTokensApi.sync(id)
      showToast(`Synced — ${r.newlyLinked} newly linked, ${r.totalLinked} total`, 'success')
      // Refresh both list + cached detail
      await loadTokens()
      setLinkedAccounts(prev => { const c = { ...prev }; delete c[id]; return c })
      if (expandedId === id) {
        const data = await bmTokensApi.get(id)
        setLinkedAccounts(prev => ({ ...prev, [id]: data.linkedAccounts || [] }))
      }
    } catch (e: any) {
      showToast(e.message || 'Sync failed', 'error')
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string, bmName: string | null) => {
    const ok = await confirm({
      title: 'Remove BM Token?',
      message: `Remove the BMSU token for ${bmName || 'this BM'}? Recharges will fall back to the extension flow until you re-add it. Linked ad accounts keep their sourceBmId.`,
      confirmText: 'Remove',
      destructive: true,
    })
    if (!ok) return
    try {
      await bmTokensApi.remove(id)
      showToast('BM token removed', 'success')
      await loadTokens()
    } catch (e: any) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <Badge variant="success">Active</Badge>
      case 'PAUSED': return <Badge variant="warning">Paused</Badge>
      case 'EXPIRED': return <Badge variant="error">Expired</Badge>
      case 'INVALID': return <Badge variant="error">Invalid</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  return (
    <DashboardLayout title="BM Tokens" subtitle="Server-side recharge via Meta System User tokens — no extension needed">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-sm text-violet-800 flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> {tokens.length} {tokens.length === 1 ? 'BM' : 'BMs'} configured
          </div>
          {tokens.length > 0 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> {tokens.reduce((s, t) => s + (t.linkedAccountsCount || 0), 0)} ad accounts linked
            </div>
          )}
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add BM Token
        </Button>
      </div>

      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        </Card>
      ) : tokens.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <KeyRound className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No BM Tokens Yet</h3>
            <p className="text-gray-500 text-sm mb-4 max-w-md">
              Add a Meta System User token to enable server-side recharge for ad accounts owned by that Business Manager.
              Tokens are encrypted at rest.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Your First BM
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {tokens.map(t => (
            <Card key={t.id} className="overflow-hidden">
              {/* Header row */}
              <div className="flex items-start gap-4 p-4">
                <button
                  onClick={() => toggleExpand(t.id)}
                  className="mt-1 text-gray-400 hover:text-gray-600 transition"
                >
                  {expandedId === t.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {t.bmName || `BM ${t.bmId}`}
                    </h3>
                    {statusBadge(t.status)}
                    {t.verificationStatus === 'verified' && (
                      <span title="Verified" className="text-emerald-500 flex items-center text-xs">
                        <ShieldCheck className="w-4 h-4 mr-0.5" /> Verified
                      </span>
                    )}
                    {t.verificationStatus === 'rejected' && (
                      <span title="Verification rejected" className="text-red-500 flex items-center text-xs">
                        <ShieldAlert className="w-4 h-4 mr-0.5" /> Rejected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{t.bmId}</div>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {t.linkedAccountsCount} accounts linked
                    </span>
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" /> {t.tokenType || 'unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Added {timeAgo(t.addedAt)}
                    </span>
                    {t.lastUsedAt && (
                      <span className="flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Last used {timeAgo(t.lastUsedAt)}
                      </span>
                    )}
                    {t.lastError && (
                      <span className="flex items-center gap-1 text-red-600" title={t.lastError}>
                        <AlertCircle className="w-3.5 h-3.5" /> Last error {timeAgo(t.lastErrorAt!)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => handleSync(t.id)} disabled={syncingId === t.id}>
                    {syncingId === t.id ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Syncing</>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Sync</>
                    )}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(t.id, t.bmName)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded — linked accounts */}
              {expandedId === t.id && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                  {loadingDetail === t.id ? (
                    <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading linked accounts…
                    </div>
                  ) : (linkedAccounts[t.id] && linkedAccounts[t.id].length > 0) ? (
                    <div className="text-sm">
                      <div className="font-semibold text-gray-700 mb-2">Linked Ad Accounts ({linkedAccounts[t.id].length})</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {linkedAccounts[t.id].map(a => (
                          <div key={a.id} className="bg-white border border-gray-200 rounded-md p-2.5 flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate">{a.accountName}</div>
                              <div className="text-xs text-gray-500 font-mono">act_{a.accountId}</div>
                            </div>
                            <div className="text-right text-xs ml-2 shrink-0">
                              <div className="text-gray-700">{a.currency} ${a.balance?.toFixed?.(2) || a.balance}</div>
                              <div className="text-gray-400">spent ${a.totalSpend?.toFixed?.(0) || a.totalSpend}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 py-4 text-center">
                      No ad accounts in your DB are linked to this BM yet.
                      Click <RefreshCw className="w-3.5 h-3.5 inline" /> Sync to re-fetch from Meta.
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddBmTokenModal
          onClose={() => setShowAddModal(false)}
          onSaved={async () => { setShowAddModal(false); await loadTokens() }}
        />
      )}
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
  const { showToast } = useToast()

  const handleValidate = async () => {
    if (!token.trim()) { showToast('Paste a token first', 'error'); return }
    setValidating(true)
    try {
      const r = await bmTokensApi.validate(token.trim())
      if (!r.valid) {
        showToast(r.error || 'Token is invalid', 'error')
        return
      }
      setPreview(r)
      setStep('preview')
    } catch (e: any) {
      showToast(e.message || 'Validation failed', 'error')
    } finally {
      setValidating(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await bmTokensApi.save({ token: token.trim() })
      showToast(`Saved — ${r.linkedAccounts} ad accounts linked`, 'success')
      onSaved()
    } catch (e: any) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-violet-600" />
            Add BM Token
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {step === 'paste' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-900">
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
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Token will be encrypted with AES-256-GCM at rest.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleValidate} disabled={validating || !token.trim()}>
                  {validating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validating</> : 'Validate & Continue'}
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-emerald-900">Token Validated</div>
                  <div className="text-emerald-800 text-xs mt-1">
                    {preview.tokenInfo.type} token, {preview.tokenInfo.permanent ? 'never expires' : `expires ${new Date(preview.tokenInfo.expiresAt * 1000).toLocaleString()}`}
                  </div>
                </div>
              </div>

              {preview.ownerBM && (
                <div className="border border-gray-200 rounded-md p-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Business Manager</div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-600" />
                    <span className="font-semibold text-gray-900">{preview.ownerBM.name}</span>
                    {preview.ownerBM.verification_status === 'verified' && (
                      <Badge variant="success" size="sm">Verified</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono mt-1">BM ID: {preview.ownerBM.id}</div>
                </div>
              )}

              <div className="border border-gray-200 rounded-md p-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permissions</div>
                <div className="flex flex-wrap gap-1.5">
                  {preview.tokenInfo.scopes.map((s: string) => (
                    <span key={s} className="text-xs bg-violet-50 text-violet-800 border border-violet-200 px-2 py-0.5 rounded font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border border-gray-200 rounded-md p-3">
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
                <Button variant="secondary" onClick={() => setStep('paste')}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving</> : 'Save & Link'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
