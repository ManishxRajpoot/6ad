'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { vccApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/contexts/ToastContext'
import { AccountManageIcon, DepositManageIcon, AfterSaleIcon } from '@/components/icons/MenuIcons'
import {
  Search, ChevronDown, Plus, Download, RefreshCw, Loader2, Eye, EyeOff,
  Copy, Clock, CreditCard, Wallet, ArrowDownToLine, ArrowUpFromLine, Wifi,
} from 'lucide-react'

// ─── Animated Counter (matches FB page) ──────────────────────────────
function AnimatedCounter({ value, duration = 500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)
  useEffect(() => {
    if (previousValue.current === value) return
    const startValue = previousValue.current
    const endValue = value
    const startTime = Date.now()
    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 4)
      const cur = Math.round(startValue + (endValue - startValue) * ease)
      setDisplayValue(cur)
      if (progress < 1) requestAnimationFrame(animate)
      else previousValue.current = value
    }
    requestAnimationFrame(animate)
  }, [value, duration])
  return <>{String(displayValue).padStart(2, '0')}</>
}

// Generate a friendly chart path from a count (mirrors FB)
const generateChartPath = (count: number, trend: 'up' | 'down') => {
  const seed = count + 1
  const points = Array.from({ length: 8 }, (_, i) => {
    const base = trend === 'up' ? 10 + i * 4 : 40 - i * 3
    const wave = Math.sin(i * (seed % 3 + 1)) * 6
    return Math.max(4, Math.min(48, base + wave))
  })
  return points.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i / 7) * 120},${50 - y}`).join(' ')
}

type SubPage = 'card-list' | 'issue-card' | 'deposit' | 'withdraw' | 'recharge-history' | 'transactions'
type MenuSection = 'card-manage' | 'recharge-manage' | 'transactions'

const dateFilterOptions = [
  { value: '', label: 'Date and Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
]
const statusFilterOptions = [
  { value: '', label: 'Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FROZEN', label: 'Frozen' },
  { value: 'CANCELLED', label: 'Cancelled' },
]
const exportOptions = [
  { id: 'card-list', label: 'Card List' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'recharge-history', label: 'Recharge History' },
]

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    FROZEN: 'bg-blue-50 text-blue-700 border-blue-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200',
    SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    FAILED: 'bg-red-50 text-red-700 border-red-200',
    RECHARGE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PURCHASE: 'bg-blue-50 text-blue-700 border-blue-200',
    REFUND: 'bg-purple-50 text-purple-700 border-purple-200',
    WITHDRAWAL: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${colors[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  )
}

export default function VccPage() {
  const { isHydrated, isAuthenticated, user, updateUser } = useAuthStore()
  const { showToast } = useToast()

  // Data
  const [cards, setCards] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // UI
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeSubPage, setActiveSubPage] = useState<SubPage>('card-list')
  const [expandedSections, setExpandedSections] = useState<MenuSection[]>(['card-manage'])
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  // Form state
  const [issueForm, setIssueForm] = useState({ label: '', alias: '' })
  const [issueSubmitting, setIssueSubmitting] = useState(false)

  const [depositCardId, setDepositCardId] = useState<string>('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositSubmitting, setDepositSubmitting] = useState(false)

  const [withdrawCardId, setWithdrawCardId] = useState<string>('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)

  // Card details modal
  const [detailsCardId, setDetailsCardId] = useState<string | null>(null)
  const [cardSensitive, setCardSensitive] = useState<any>(null)
  const [showSensitive, setShowSensitive] = useState(false)
  const [revealLoading, setRevealLoading] = useState(false)

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return
    refreshAll()
  }, [isHydrated, isAuthenticated])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const refreshAll = async () => {
    setLoading(true)
    try {
      const [cardsRes, txRes, meRes] = await Promise.all([
        vccApi.getMyCards().catch(() => ({ cards: [] })),
        vccApi.getMyTransactions({ limit: 100 }).catch(() => ({ transactions: [], total: 0 })),
        authApi.me().catch(() => ({ user: null })),
      ])
      setCards(cardsRes.cards || [])
      setTransactions(txRes.transactions || [])
      if (meRes.user) updateUser(meRes.user)
    } catch (e: any) {
      showToast('error', e.message)
    }
    setLoading(false)
  }
  const refreshSilent = async () => {
    setRefreshing(true)
    try {
      const [cardsRes, txRes, meRes] = await Promise.all([
        vccApi.getMyCards().catch(() => ({ cards: [] })),
        vccApi.getMyTransactions({ limit: 100 }).catch(() => ({ transactions: [], total: 0 })),
        authApi.me().catch(() => ({ user: null })),
      ])
      setCards(cardsRes.cards || [])
      setTransactions(txRes.transactions || [])
      if (meRes.user) updateUser(meRes.user)
    } catch {}
    setRefreshing(false)
  }

  const toggleSection = (section: MenuSection) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    )
  }

  // ─── Filters ─────────────────────────────────────────────────────
  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return cards.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false
      if (!q) return true
      const hay = [
        c.label, c.alias, c.cardNumber, c.yeewallexCardId, c.currency, c.status,
        c.cardholder?.firstName, c.cardholder?.lastName,
      ].filter(Boolean).map(String).map(s => s.toLowerCase())
      return hay.some(h => h.includes(q))
    })
  }, [cards, searchQuery, statusFilter])

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return transactions.filter(tx => {
      if (!q) return true
      const hay = [
        tx.type, tx.status, tx.currency, tx.merchantName, tx.description,
        tx.card?.label, String(tx.amount ?? ''),
      ].filter(Boolean).map(String).map(s => s.toLowerCase())
      return hay.some(h => h.includes(q))
    })
  }, [transactions, searchQuery])

  // ─── Stats ──────────────────────────────────────────────────────
  const statsData = useMemo(() => {
    const total = cards.length
    const active = cards.filter(c => c.status === 'ACTIVE').length
    const totalBalance = cards.reduce((s, c) => s + (Number(c.balance) || 0), 0)
    const totalSpend = cards.reduce((s, c) => s + (Number(c.totalSpent) || 0), 0)
    return [
      { label: 'Total Cards', numericValue: total, badge: total > 0 ? `${total} Total` : 'None', trend: 'up' as const, color: '#8B5CF6', chartPath: generateChartPath(total, 'up') },
      { label: 'Active Cards', numericValue: active, badge: active > 0 ? `${active} Active` : 'None', trend: 'up' as const, color: '#22C55E', chartPath: generateChartPath(active, 'up') },
      { label: 'Total Balance', numericValue: Math.round(totalBalance), badge: 'USD', trend: 'up' as const, color: '#F97316', chartPath: generateChartPath(Math.round(totalBalance), 'up') },
      { label: 'Total Spend', numericValue: Math.round(totalSpend), badge: 'Lifetime', trend: 'down' as const, color: '#EF4444', chartPath: generateChartPath(Math.round(totalSpend), 'down') },
    ]
  }, [cards])

  // ─── Actions ────────────────────────────────────────────────────
  const submitIssue = async () => {
    setIssueSubmitting(true)
    try {
      await vccApi.issueCard(issueForm)
      showToast('success', 'Card issued. It may take a moment to activate.')
      setIssueForm({ label: '', alias: '' })
      setActiveSubPage('card-list')
      await refreshSilent()
    } catch (e: any) {
      showToast('error', e.message)
    }
    setIssueSubmitting(false)
  }
  const submitDeposit = async () => {
    if (!depositCardId) return showToast('error', 'Pick a card')
    const amt = parseFloat(depositAmount)
    if (!amt || amt <= 0) return showToast('error', 'Enter a valid amount')
    setDepositSubmitting(true)
    try {
      await vccApi.rechargeCard(depositCardId, amt)
      showToast('success', `Deposited $${amt.toFixed(2)}`)
      setDepositAmount('')
      setActiveSubPage('card-list')
      await refreshSilent()
    } catch (e: any) { showToast('error', e.message) }
    setDepositSubmitting(false)
  }
  const submitWithdraw = async () => {
    if (!withdrawCardId) return showToast('error', 'Pick a card')
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt <= 0) return showToast('error', 'Enter a valid amount')
    setWithdrawSubmitting(true)
    try {
      await vccApi.withdrawCard(withdrawCardId, amt)
      showToast('success', `Withdrew $${amt.toFixed(2)} to wallet`)
      setWithdrawAmount('')
      await refreshSilent()
    } catch (e: any) { showToast('error', e.message) }
    setWithdrawSubmitting(false)
  }
  const doReveal = async () => {
    if (!detailsCardId) return
    setRevealLoading(true)
    try {
      const data = await vccApi.getCardDetails(detailsCardId)
      setCardSensitive(data)
      setShowSensitive(true)
      setTimeout(() => { setShowSensitive(false); setCardSensitive(null) }, 30000)
    } catch (e: any) { showToast('error', e.message) }
    setRevealLoading(false)
  }
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('success', 'Copied')
  }
  const closeDetails = () => {
    setDetailsCardId(null)
    setCardSensitive(null)
    setShowSensitive(false)
  }
  const exportToCsv = (kind: string) => {
    let rows: any[] = []
    let headers: string[] = []
    if (kind === 'card-list') {
      headers = ['Label', 'Alias', 'Card', 'Holder', 'Status', 'Balance', 'Currency']
      rows = cards.map(c => [c.label || '', c.alias || '', c.cardNumber || '', `${c.cardholder?.firstName || ''} ${c.cardholder?.lastName || ''}`.trim(), c.status, Number(c.balance || 0).toFixed(2), c.currency])
    } else {
      headers = ['Type', 'Amount', 'Status', 'Card', 'Description', 'Date']
      rows = transactions.map(t => [t.type, Number(t.amount || 0).toFixed(2), t.status, t.card?.label || '', t.merchantName || t.description || '', new Date(t.createdAt).toISOString()])
    }
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${kind}-${Date.now()}.csv`
    a.click()
  }

  const menuItems = [
    {
      section: 'card-manage' as MenuSection,
      title: 'Card Manage',
      icon: <AccountManageIcon />,
      items: [
        { id: 'issue-card' as SubPage, label: 'Issue Card' },
        { id: 'card-list' as SubPage, label: 'Card List' },
      ],
    },
    {
      section: 'recharge-manage' as MenuSection,
      title: 'Recharge Manage',
      icon: <DepositManageIcon />,
      items: [
        { id: 'deposit' as SubPage, label: 'Deposit' },
        { id: 'withdraw' as SubPage, label: 'Withdraw' },
        { id: 'recharge-history' as SubPage, label: 'Recharge History' },
      ],
    },
    {
      section: 'transactions' as MenuSection,
      title: 'Transactions',
      icon: <AfterSaleIcon />,
      items: [
        { id: 'transactions' as SubPage, label: 'All Transactions' },
      ],
    },
  ]

  const cardOptions = useMemo(
    () => cards.map(c => ({ value: c.id, label: `${c.label || c.alias || (c.yeewallexCardId ? '••' + c.yeewallexCardId.slice(-4) : 'Card')} — $${Number(c.balance || 0).toFixed(2)}` })),
    [cards]
  )
  const walletBalance = Number(user?.walletBalance || 0)

  return (
    <DashboardLayout title="VCC Cards" subtitle="">
      <div className="flex flex-col h-full">
        <style jsx global>{`
          @keyframes vccFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes vccSlideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
          .vcc-row { animation: vccFadeUp 0.25s ease-out forwards; }
          .vcc-slide { animation: vccSlideIn 0.25s ease-out forwards; }
          .vcc-stat-card { transition: all 0.2s ease; }
          .vcc-stat-card:hover { transform: translateY(-1px); box-shadow: 0 4px 15px -3px rgba(139, 92, 246, 0.12); }
          .vcc-scroll::-webkit-scrollbar { width: 4px; }
          .vcc-scroll::-webkit-scrollbar-track { background: transparent; }
          .vcc-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
        `}</style>

        {/* Row 1: Header bar — search + filters + export + Issue Card */}
        <div className="hidden lg:flex flex-wrap items-center gap-1.5 lg:gap-2 mb-2 lg:mb-3 p-1.5 lg:p-2 bg-white rounded-lg lg:rounded-xl shadow-sm border border-gray-100/50">
          <div className="relative w-32 lg:w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 lg:w-3.5 h-3 lg:h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 lg:pl-8 pr-2 lg:pr-3 py-1 lg:py-1.5 bg-gray-50 border border-gray-200 rounded-md text-[10px] lg:text-xs focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
            />
          </div>
          <div className="w-28 lg:w-36 hidden sm:block">
            <Select options={dateFilterOptions} value={dateFilter} onChange={setDateFilter} placeholder="Date" size="sm" />
          </div>
          <div className="w-24 lg:w-28 hidden sm:block">
            <Select options={statusFilterOptions} value={statusFilter} onChange={setStatusFilter} placeholder="Status" size="sm" />
          </div>

          <div className="flex-1" />

          <button
            onClick={refreshSilent}
            className="p-1.5 rounded-md text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="relative" ref={exportDropdownRef}>
            <Button
              variant="outline"
              className="border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 whitespace-nowrap text-[10px] lg:text-xs px-2 lg:px-3 py-1 lg:py-1.5 h-auto"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
            >
              <Download className="w-3 lg:w-3.5 h-3 lg:h-3.5 mr-1" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className={`w-3 lg:w-3.5 h-3 lg:h-3.5 ml-1 transition-transform duration-200 ${showExportDropdown ? 'rotate-180' : ''}`} />
            </Button>

            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-48 lg:w-56 bg-white border border-gray-200 rounded-lg lg:rounded-xl shadow-lg overflow-hidden z-50">
                <div className="py-1">
                  {exportOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => { exportToCsv(option.id); setShowExportDropdown(false) }}
                      className="w-full px-3 lg:px-4 py-2 text-xs lg:text-sm text-left text-gray-700 hover:bg-[#52B788]/10 hover:text-[#52B788] transition-colors flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={() => setActiveSubPage('issue-card')}
            className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-md shadow-sm whitespace-nowrap text-[10px] lg:text-xs px-2 lg:px-3 py-1 lg:py-1.5 h-auto"
          >
            <Plus className="w-3 lg:w-3.5 h-3 lg:h-3.5 mr-0.5 lg:mr-1" />
            <span className="hidden sm:inline">Issue Card</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* Row 2: Stats Cards */}
        <div className="hidden lg:grid grid-cols-2 lg:grid-cols-4 gap-1.5 lg:gap-3 mb-2 lg:mb-3">
          {statsData.map((stat, index) => (
            <Card key={index} className="vcc-stat-card p-2 lg:p-3 border border-gray-100 bg-white rounded-lg lg:rounded-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 lg:mb-2">
                <p className="text-[11px] lg:text-sm text-gray-500 font-medium">{stat.label}</p>
                {stat.badge !== 'None' && (
                  <span className={`text-[8px] lg:text-[10px] px-1.5 lg:px-2.5 py-0.5 lg:py-1 rounded-full font-semibold whitespace-nowrap ${
                    stat.trend === 'up' ? 'bg-[#22C55E] text-white' : stat.trend === 'down' ? 'bg-[#EF4444] text-white' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {stat.badge}
                  </span>
                )}
              </div>
              <div className="flex items-end justify-between">
                <p className="text-lg lg:text-2xl font-bold text-gray-900 tabular-nums">
                  <AnimatedCounter value={stat.numericValue} duration={600} />
                </p>
                <div className="w-16 h-8 lg:w-24 lg:h-12 relative hidden sm:block">
                  <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id={`vcc-stat-gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={stat.color} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={stat.color} stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <path d={`${stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')} L100,50 L0,50 Z`} fill={`url(#vcc-stat-gradient-${index})`} />
                    <path d={stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')} fill="none" stroke={stat.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Row 3: Main content */}
        <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar */}
          <div className="w-56 lg:w-64 flex-shrink-0 hidden md:block">
            <Card className="p-3 h-full border border-gray-100/50 bg-gradient-to-b from-white to-gray-50/50 relative overflow-hidden flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/5 via-transparent to-[#52B788]/5" />

              {/* VCC Logo */}
              <div className="relative z-10 flex flex-col items-center mb-3 pb-3 border-b border-gray-100 flex-shrink-0">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                    <div className="w-3.5 h-3.5 bg-[#52B788] rounded-full flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-2 h-2" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  </div>
                </div>
                <p className="mt-1.5 text-xs font-medium text-gray-600">Card Management</p>
              </div>

              <div className="relative z-10 space-y-1 overflow-y-auto flex-1 vcc-scroll" style={{ scrollbarWidth: 'thin' }}>
                {menuItems.map(menu => (
                  <div key={menu.section}>
                    <button
                      onClick={() => toggleSection(menu.section)}
                      className="w-full flex items-center justify-between px-2.5 py-2 text-sm font-semibold text-gray-700 hover:bg-[#8B5CF6]/5 rounded-lg transition-all duration-200 active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{menu.icon}</span>
                        <span>{menu.title}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-all duration-300 ${expandedSections.includes(menu.section) ? 'rotate-180 text-[#8B5CF6]' : 'rotate-0 text-gray-400'}`} />
                    </button>
                    <div className={`ml-4 space-y-0.5 border-l-2 border-[#8B5CF6]/20 pl-3 overflow-hidden transition-all duration-300 ease-in-out ${expandedSections.includes(menu.section) ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'}`}>
                      {menu.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => setActiveSubPage(item.id)}
                          className={`w-full text-left px-2.5 py-1.5 text-sm rounded-lg transition-all duration-200 ease-out hover:translate-x-0.5 active:scale-95 ${expandedSections.includes(menu.section) ? 'vcc-slide' : ''} ${
                            activeSubPage === item.id
                              ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white font-medium shadow-md shadow-purple-200'
                              : 'text-gray-600 hover:bg-[#8B5CF6]/5 hover:text-[#8B5CF6]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right content */}
          <Card className="flex-1 p-0 rounded-xl lg:rounded-2xl overflow-hidden border border-gray-100/50 shadow-sm flex flex-col min-h-0">
            <div className="overflow-y-auto flex-1 min-h-0 bg-gradient-to-b from-white to-gray-50/30 vcc-scroll">

              {/* ─── Card List ───────────────────────────────────────── */}
              {activeSubPage === 'card-list' && (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Your VCC Cards</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Manage your virtual credit cards</p>
                    </div>
                    <span className="text-xs text-gray-500">Total: <span className="font-semibold text-[#8B5CF6]">{filteredCards.length}</span></span>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
                  ) : filteredCards.length === 0 ? (
                    <div className="text-center py-16">
                      <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-700 text-base font-medium">No cards yet</p>
                      <p className="text-gray-400 text-sm mt-1 mb-4">Issue your first virtual card to start spending.</p>
                      <button
                        onClick={() => setActiveSubPage('issue-card')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-medium hover:opacity-90"
                      >
                        <Plus className="w-4 h-4" /> Issue Card
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredCards.map(card => {
                        const last4 = card.cardNumber
                          ? String(card.cardNumber).replace(/\D/g, '').slice(-4)
                          : (card.yeewallexCardId ? card.yeewallexCardId.slice(-4) : '••••')
                        const dotColor = card.status === 'ACTIVE'
                          ? 'bg-emerald-500'
                          : card.status === 'PENDING'
                            ? 'bg-yellow-500'
                            : card.status === 'FROZEN'
                              ? 'bg-blue-500'
                              : 'bg-red-500'
                        return (
                        <div key={card.id} className="vcc-row group relative flex items-center gap-4 p-3 rounded-2xl border border-gray-100 bg-gradient-to-r from-white via-white to-purple-50/40 hover:to-purple-50/80 hover:shadow-md transition-all">
                          {/* Mini card chip */}
                          <div className="relative w-20 h-12 rounded-lg bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 flex flex-col justify-between p-1.5 flex-shrink-0 overflow-hidden">
                            <Wifi className="w-3 h-3 text-white/40 self-end rotate-90" />
                            <p className="font-mono text-[8px] text-white/80 tracking-wider">•• {last4}</p>
                            <div className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-purple-500/30 blur-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {card.label || card.alias || `Card ${last4}`}
                              </p>
                              <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider">{card.status}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {card.expiry ? `Exp ${card.expiry} · ` : ''}{card.currency || 'USD'}
                            </p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Balance</p>
                            <p className="text-base font-bold text-gray-900 tabular-nums">${Number(card.balance || 0).toFixed(2)}</p>
                          </div>
                          {/* B9 · Segmented bar */}
                          <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden divide-x divide-gray-200">
                            <button
                              disabled={card.status !== 'ACTIVE' || !card.yeewallexCardId}
                              onClick={() => setDetailsCardId(card.id)}
                              className="px-3 py-1.5 hover:bg-purple-50 text-purple-700 text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> Access
                            </button>
                            <button
                              disabled={card.status !== 'ACTIVE'}
                              onClick={() => { setDepositCardId(card.id); setActiveSubPage('deposit') }}
                              className="px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" /> Deposit
                            </button>
                            <button
                              disabled={card.status !== 'ACTIVE' || Number(card.balance) <= 0}
                              onClick={() => { setWithdrawCardId(card.id); setActiveSubPage('withdraw') }}
                              className="px-3 py-1.5 hover:bg-orange-50 text-orange-700 text-[11px] font-medium inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <ArrowUpFromLine className="w-3.5 h-3.5" /> Withdraw
                            </button>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Issue Card form ─────────────────────────────────── */}
              {activeSubPage === 'issue-card' && (
                <div className="p-6 max-w-xl">
                  <h2 className="text-base font-bold text-gray-900 mb-1">Issue a New Card</h2>
                  <p className="text-xs text-gray-500 mb-5">A new virtual card will be created and assigned to your account.</p>
                  <div className="space-y-4">
                    <Input label="Label (optional)" value={issueForm.label} onChange={e => setIssueForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Facebook Ads" />
                    <Input label="Alias (optional)" value={issueForm.alias} onChange={e => setIssueForm(p => ({ ...p, alias: e.target.value }))} placeholder="Internal nickname" />
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                      <p className="text-xs text-gray-500">Wallet Balance</p>
                      <p className="text-base font-bold text-gray-900">${walletBalance.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setActiveSubPage('card-list')} className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                      <button
                        disabled={issueSubmitting}
                        onClick={submitIssue}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {issueSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Issue Card
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Deposit form ────────────────────────────────────── */}
              {activeSubPage === 'deposit' && (
                <div className="p-6 max-w-xl">
                  <h2 className="text-base font-bold text-gray-900 mb-1">Deposit to Card</h2>
                  <p className="text-xs text-gray-500 mb-5">Move funds from your wallet onto a card.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Card</label>
                      <Select options={[{ value: '', label: 'Select a card' }, ...cardOptions]} value={depositCardId} onChange={setDepositCardId} placeholder="Select a card" size="default" />
                    </div>
                    <Input label="Amount (USD)" type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="100.00" />
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Wallet Balance</p>
                        <p className="text-base font-bold text-gray-900">${walletBalance.toFixed(2)}</p>
                      </div>
                      <ArrowDownToLine className="w-5 h-5 text-emerald-500" />
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Card Balance</p>
                        <p className="text-base font-bold text-gray-900">${Number(cards.find(c => c.id === depositCardId)?.balance || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">Funds are deducted from your wallet and added to the card immediately.</p>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setActiveSubPage('card-list')} className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                      <button
                        disabled={depositSubmitting}
                        onClick={submitDeposit}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {depositSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Deposit
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Withdraw form ───────────────────────────────────── */}
              {activeSubPage === 'withdraw' && (
                <div className="p-6 max-w-xl">
                  <h2 className="text-base font-bold text-gray-900 mb-1">Withdraw to Wallet</h2>
                  <p className="text-xs text-gray-500 mb-5">Pull funds from a card back to your wallet.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Card</label>
                      <Select options={[{ value: '', label: 'Select a card' }, ...cardOptions]} value={withdrawCardId} onChange={setWithdrawCardId} placeholder="Select a card" size="default" />
                    </div>
                    <Input label="Amount (USD)" type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="50.00" />
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Card Balance</p>
                        <p className="text-base font-bold text-gray-900">${Number(cards.find(c => c.id === withdrawCardId)?.balance || 0).toFixed(2)}</p>
                      </div>
                      <ArrowUpFromLine className="w-5 h-5 text-orange-500" />
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Wallet Balance</p>
                        <p className="text-base font-bold text-gray-900">${walletBalance.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setActiveSubPage('card-list')} className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                      <button
                        disabled={withdrawSubmitting}
                        onClick={submitWithdraw}
                        className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {withdrawSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Withdraw
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Recharge History ────────────────────────────────── */}
              {activeSubPage === 'recharge-history' && (
                <div className="p-5">
                  <h2 className="text-base font-bold text-gray-900 mb-1">Recharge History</h2>
                  <p className="text-xs text-gray-500 mb-4">Past deposits and withdrawals.</p>
                  <RechargeTable transactions={transactions.filter(t => t.type === 'RECHARGE' || t.type === 'WITHDRAWAL' || t.type === 'REFUND')} />
                </div>
              )}

              {/* ─── All Transactions ────────────────────────────────── */}
              {activeSubPage === 'transactions' && (
                <div className="p-5">
                  <h2 className="text-base font-bold text-gray-900 mb-1">All Transactions</h2>
                  <p className="text-xs text-gray-500 mb-4">Every event on your cards.</p>
                  <RechargeTable transactions={filteredTransactions} />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ─── Card Details Modal ────────────────────────────────────── */}
      {detailsCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeDetails}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Card Details</h3>
            {!showSensitive ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4"><EyeOff className="w-7 h-7 text-gray-400" /></div>
                <p className="text-gray-500 text-sm mb-5">Card details are hidden for security.</p>
                <button onClick={doReveal} disabled={revealLoading} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {revealLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  Reveal Details
                </button>
                <p className="text-[10px] text-gray-400 mt-3">Details auto-hide after 30 seconds</p>
              </div>
            ) : cardSensitive ? (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Card Number</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-lg font-bold tracking-wider">{cardSensitive.cardNo}</p>
                    <button onClick={() => copyText(cardSensitive.cardNo)} className="p-1.5 hover:bg-gray-200 rounded-lg"><Copy className="w-4 h-4 text-gray-400" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Expiry Date</p>
                    <p className="font-mono text-base font-bold">{cardSensitive.expireDate}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">CVV</p>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-base font-bold">{cardSensitive.cvv}</p>
                      <button onClick={() => copyText(cardSensitive.cvv)} className="p-1.5 hover:bg-gray-200 rounded-lg"><Copy className="w-4 h-4 text-gray-400" /></button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 text-[11px] text-amber-600 bg-amber-50 rounded-lg p-3">
                  <Clock className="w-3.5 h-3.5 shrink-0" /> Details will auto-hide in 30 seconds for security.
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
            )}
            <button onClick={closeDetails} className="w-full mt-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

function RechargeTable({ transactions }: { transactions: any[] }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-y border-gray-100">
          <tr>
            <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">Type</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase">Amount</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase">Card</th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase">Description</th>
            <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map(tx => (
            <tr key={tx.id} className="hover:bg-gray-50">
              <td className="px-5 py-3"><StatusBadge status={tx.type} /></td>
              <td className="px-4 py-3 font-semibold text-gray-900">${Number(tx.amount || 0).toFixed(2)}</td>
              <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
              <td className="px-4 py-3 text-gray-600">{tx.card?.label || '—'}</td>
              <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{tx.merchantName || tx.description || '—'}</td>
              <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No records yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
