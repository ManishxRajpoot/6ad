'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  type FBAdAccount,
  type FBBusiness,
  type FBUserInfo,
  type ParsedAdAccount,
  type ParsedBusiness,
  parseAdAccount,
  parseBusiness,
  exportAccountsToCSV,
  exportBMsToCSV,
} from '@/lib/facebook'
import { Layout } from '@/components/Layout'
import {
  Search,
  Download,
  User,
  Building2,
  CreditCard,
  AlertCircle,
  Loader2,
  Shield,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  BarChart3,
} from 'lucide-react'

// ==================== FACEBOOK API HELPER ====================

async function fbFetch(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL('/api/fb', window.location.origin)
  url.searchParams.set('path', path)
  url.searchParams.set('token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString())
  const data = await res.json()

  if (data.error) {
    const msg = typeof data.error === 'object' ? data.error.message : data.error
    throw new Error(msg)
  }

  return data
}

// ==================== MAIN PAGE ====================

export default function AdsCheckerPage() {
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<FBUserInfo | null>(null)
  const [adAccounts, setAdAccounts] = useState<ParsedAdAccount[]>([])
  const [businesses, setBusinesses] = useState<ParsedBusiness[]>([])
  const [activeTab, setActiveTab] = useState<'accounts' | 'bm'>('accounts')
  const [sortField, setSortField] = useState<string>('index')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // ==================== HANDLERS ====================

  const loadingRef = useRef(false)
  useEffect(() => { loadingRef.current = loading }, [loading])

  const handleCheck = useCallback(async (overrideToken?: string) => {
    const trimmed = (overrideToken || token).trim()
    if (!trimmed) {
      setError('Please paste your Facebook access token')
      return
    }
    if (!trimmed.startsWith('EAA')) {
      setError('Invalid token format. Facebook access tokens start with "EAA"')
      return
    }

    if (overrideToken) {
      setToken(overrideToken)
    }

    setLoading(true)
    setError(null)
    setUserInfo(null)
    setAdAccounts([])
    setBusinesses([])

    try {
      // Step 1: Validate token + get user info
      const me = await fbFetch('/me', trimmed, { fields: 'id,name' })
      setUserInfo({ id: me.id, name: me.name })

      // Step 2: Fetch ad accounts + businesses in parallel
      const [accountsData, bmsData] = await Promise.all([
        fbFetch('/me/adaccounts', trimmed, {
          fields: 'id,account_id,name,account_status,amount_spent,balance,spend_cap,currency,business_name,business{id,name},funding_source_details,disable_reason,created_time',
          limit: '200',
        }).catch(() => ({ data: [] })),
        fbFetch('/me/businesses', trimmed, {
          fields: 'id,name,created_time,verification_status,permitted_roles',
          limit: '100',
        }).catch(() => ({ data: [] })),
      ])

      // Parse ad accounts
      const accounts: FBAdAccount[] = accountsData.data || []
      setAdAccounts(accounts.map((a: FBAdAccount, i: number) => parseAdAccount(a, i)))

      // Parse businesses and fetch ad account counts in parallel
      const bms: FBBusiness[] = bmsData.data || []
      const parsedBMs = await Promise.all(
        bms.map(async (bm, i) => {
          let count: number | null = null
          try {
            const countData = await fbFetch(`/${bm.id}/owned_ad_accounts`, trimmed, {
              limit: '1',
              summary: 'true',
            })
            count = countData.summary?.total_count ?? null
          } catch {}
          return parseBusiness(bm, i, count)
        })
      )
      setBusinesses(parsedBMs)
    } catch (err: any) {
      setError(err.message || 'Failed to check accounts')
    } finally {
      setLoading(false)
    }
  }, [token])

  // Listen for token from 6AD Chrome extension
  useEffect(() => {
    const ALLOWED_ORIGINS = [
      'http://localhost:3004',
      'https://ads-check.6ad.in',
    ]

    function handleExtensionMessage(event: MessageEvent) {
      if (!ALLOWED_ORIGINS.includes(event.origin)) return
      if (!event.data || event.data.type !== '__6AD_ADS_CHECK_TOKEN__') return
      if (loadingRef.current) return

      const extensionToken = event.data.token
      if (extensionToken && typeof extensionToken === 'string' && extensionToken.startsWith('EAA')) {
        console.log('[6AD] Token received from extension, auto-checking...')
        handleCheck(extensionToken)
      }
    }

    window.addEventListener('message', handleExtensionMessage)
    return () => window.removeEventListener('message', handleExtensionMessage)
  }, [handleCheck])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ==================== SORTING & FILTERING ====================

  const sortAccounts = (accounts: ParsedAdAccount[]) => {
    let filtered = accounts
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = accounts.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.accountId.includes(q) ||
        a.businessName.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q)
      )
    }
    return [...filtered].sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal ?? '')
      const bStr = String(bVal ?? '')
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }

  const sortBusinesses = (bms: ParsedBusiness[]) => {
    let filtered = bms
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = bms.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.bmId.includes(q) ||
        b.roles.toLowerCase().includes(q)
      )
    }
    return [...filtered].sort((a, b) => {
      const aVal = (a as any)[sortField]
      const bVal = (b as any)[sortField]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal ?? '')
      const bStr = String(bVal ?? '')
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }

  const sortedAccounts = sortAccounts(adAccounts)
  const sortedBusinesses = sortBusinesses(businesses)
  const activeCount = adAccounts.filter(a => a.status === 'Active').length
  const disabledCount = adAccounts.filter(a => a.status === 'Disabled').length

  // ==================== STATUS BADGE ====================

  const StatusBadge = ({ status, variant }: { status: string; variant: string }) => {
    const colors: Record<string, string> = {
      success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      danger: 'bg-red-50 text-red-700 border-red-200',
      warning: 'bg-amber-50 text-amber-700 border-amber-200',
      info: 'bg-blue-50 text-blue-700 border-blue-200',
      default: 'bg-gray-50 text-gray-600 border-gray-200',
    }
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', colors[variant] || colors.default)}>
        <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', {
          'bg-emerald-500': variant === 'success',
          'bg-red-500': variant === 'danger',
          'bg-amber-500': variant === 'warning',
          'bg-blue-500': variant === 'info',
          'bg-gray-400': variant === 'default',
        })} />
        {status}
      </span>
    )
  }

  // ==================== SORT HEADER ====================

  const SortHeader = ({ field, label, className }: { field: string; label: string; className?: string }) => (
    <th
      className={cn('text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[11px] bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap', className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  )

  // ==================== RENDER ====================

  return (
    <Layout>
      <div className="p-6">
        {/* Top Toolbar — Token Input */}
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleCheck() }}
                placeholder="Paste your Facebook access token (EAA...)"
                className="w-full h-10 pl-4 pr-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={() => handleCheck()}
              disabled={loading}
              className="h-10 px-6 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-medium text-sm hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Check Accounts
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results */}
        {userInfo && (
          <div className="animate-slide-up">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-violet-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase">FB User</span>
                </div>
                <p className="font-bold text-gray-900 truncate" title={userInfo.name}>{userInfo.name}</p>
                <p className="text-xs text-gray-400 font-mono">{userInfo.id}</p>
              </div>

              <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase">Total Accounts</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{adAccounts.length}</p>
              </div>

              <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Check className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase">Active</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
              </div>

              <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase">Disabled</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{disabledCount}</p>
              </div>

              <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase">Business Mgrs</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{businesses.length}</p>
              </div>
            </div>

            {/* Tabs + Actions */}
            <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setActiveTab('accounts'); setSortField('index'); setSortOrder('asc') }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      activeTab === 'accounts'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    <CreditCard className="h-3.5 w-3.5 inline mr-1.5" />
                    Ad Accounts ({adAccounts.length})
                  </button>
                  <button
                    onClick={() => { setActiveTab('bm'); setSortField('index'); setSortOrder('asc') }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      activeTab === 'bm'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5 inline mr-1.5" />
                    Business Managers ({businesses.length})
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-48"
                    />
                  </div>
                  <button
                    onClick={() => activeTab === 'accounts' ? exportAccountsToCSV(sortedAccounts) : exportBMsToCSV(sortedBusinesses)}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Ad Accounts Table */}
              {activeTab === 'accounts' && (
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                        <SortHeader field="index" label="#" />
                        <SortHeader field="name" label="Account Name" />
                        <SortHeader field="accountId" label="Account ID" />
                        <SortHeader field="status" label="Status" />
                        <SortHeader field="spendingLimit" label="Spend Limit" />
                        <SortHeader field="balance" label="Balance" />
                        <SortHeader field="amountSpent" label="Spent" />
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[11px] bg-gray-50 whitespace-nowrap">Currency</th>
                        <SortHeader field="businessName" label="Business" />
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[11px] bg-gray-50 whitespace-nowrap">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAccounts.length > 0 ? (
                        sortedAccounts.map((account) => (
                          <tr
                            key={account.accountId}
                            className="border-b border-gray-50 hover:bg-gray-50/50 row-animate"
                            style={{ animationDelay: `${account.index * 15}ms` }}
                          >
                            <td className="py-2.5 px-3 text-gray-400">{account.index}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-medium text-gray-900 truncate max-w-[180px] block" title={account.name}>
                                {account.name}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded text-[10px]">
                                  {account.accountId}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(account.accountId)}
                                  className="p-0.5 rounded hover:bg-gray-100 transition-colors"
                                  title="Copy ID"
                                >
                                  {copiedId === account.accountId ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge status={account.status} variant={account.statusVariant} />
                            </td>
                            <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">
                              {account.spendingLimit !== null
                                ? formatCurrency(account.spendingLimit, account.currency)
                                : <span className="text-gray-400 text-[10px]">Unlimited</span>
                              }
                            </td>
                            <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">
                              {formatCurrency(account.balance, account.currency)}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                              {formatCurrency(account.amountSpent, account.currency)}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500">{account.currency}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-gray-600 truncate max-w-[120px] block" title={account.businessName}>
                                {account.businessName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{formatDate(account.createdTime)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-gray-500">
                            <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p>{searchQuery ? 'No accounts match your search' : 'No ad accounts found'}</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Business Managers Table */}
              {activeTab === 'bm' && (
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                        <SortHeader field="index" label="#" />
                        <SortHeader field="name" label="BM Name" />
                        <SortHeader field="bmId" label="BM ID" />
                        <SortHeader field="roles" label="Roles" />
                        <SortHeader field="verificationStatus" label="Verification" />
                        <SortHeader field="adAccountCount" label="Ad Accounts" />
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[11px] bg-gray-50 whitespace-nowrap">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBusinesses.length > 0 ? (
                        sortedBusinesses.map((bm) => (
                          <tr
                            key={bm.bmId}
                            className="border-b border-gray-50 hover:bg-gray-50/50 row-animate"
                            style={{ animationDelay: `${bm.index * 15}ms` }}
                          >
                            <td className="py-2.5 px-3 text-gray-400">{bm.index}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-medium text-gray-900">{bm.name}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded text-[10px]">
                                  {bm.bmId}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(bm.bmId)}
                                  className="p-0.5 rounded hover:bg-gray-100 transition-colors"
                                  title="Copy BM ID"
                                >
                                  {copiedId === bm.bmId ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 capitalize">{bm.roles.toLowerCase()}</td>
                            <td className="py-2.5 px-3">
                              <StatusBadge
                                status={bm.verificationStatus === 'verified' ? 'Verified' : bm.verificationStatus === 'not_verified' ? 'Not Verified' : bm.verificationStatus}
                                variant={bm.verificationStatus === 'verified' ? 'success' : bm.verificationStatus === 'not_verified' ? 'warning' : 'default'}
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {bm.adAccountCount !== null ? (
                                <span className="font-medium text-gray-900">{bm.adAccountCount}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{formatDate(bm.createdTime)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-500">
                            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p>{searchQuery ? 'No BMs match your search' : 'No Business Managers found'}</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!userInfo && !loading && !error && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Ready to check your accounts</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Paste your Facebook access token above to view all ad accounts, spending limits, balances, and Business Manager details.
            </p>
          </div>
        )}
        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Shield className="h-3 w-3 text-white" />
              </div>
              <span>Powered by <span className="font-medium text-gray-600">6AD</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              <span>Your access token is processed in-memory and never stored on our servers</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
