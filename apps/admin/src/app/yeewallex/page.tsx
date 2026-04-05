'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
import { yeewallexApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import {
  Search, Plus, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronDown,
  RefreshCw, Loader2, Copy, CreditCard, DollarSign, Snowflake, Play,
  XCircle, Link2, UserPlus, Wallet,
} from 'lucide-react'

type Tab = 'card-list' | 'cardholders' | 'recharge-history' | 'transactions' | 'account'

export default function VCCPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [activeTab, setActiveTab] = useState<Tab>('card-list')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Cards
  const [cards, setCards] = useState<any[]>([])
  const [cardsTotal, setCardsTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Cardholders
  const [cardholders, setCardholders] = useState<any[]>([])

  // Transactions
  const [transactions, setTransactions] = useState<any[]>([])
  const [txTotal, setTxTotal] = useState(0)

  // Account
  const [accountInfo, setAccountInfo] = useState<any>(null)
  const [cardBins, setCardBins] = useState<any>(null)

  // Stats
  const [stats, setStats] = useState({ totalBalance: 0, totalActive: 0, totalPending: 0, totalFrozen: 0 })

  // Modals
  const [showCreateCard, setShowCreateCard] = useState(false)
  const [showCreateHolder, setShowCreateHolder] = useState(false)
  const [showCardDetails, setShowCardDetails] = useState<string | null>(null)
  const [cardSensitive, setCardSensitive] = useState<any>(null)
  const [showSensitive, setShowSensitive] = useState(false)
  const [rechargeCardId, setRechargeCardId] = useState<string | null>(null)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [assignCardId, setAssignCardId] = useState<string | null>(null)
  const [assignUserId, setAssignUserId] = useState('')

  // Forms
  const [holderForm, setHolderForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [cardForm, setCardForm] = useState({ cardholderId: '', label: '', alias: '' })

  // Tab refs for sliding indicator
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  // Recharge/Refund history (local DB)
  const [rechargeHistory, setRechargeHistory] = useState<any[]>([])

  const fetchRechargeHistory = async () => {
    try {
      const data = await yeewallexApi.transactions.getRechargeHistory()
      setRechargeHistory(data.transactions || [])
    } catch (e: any) { /* silent */ }
  }

  const tabs = [
    { id: 'card-list', label: 'Card List' },
    { id: 'cardholders', label: 'Cardholders' },
    { id: 'recharge-history', label: 'Recharge/Refund' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'account', label: 'Account' },
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) setShowStatusDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch
  const fetchCards = async () => {
    setLoading(true)
    try {
      const data = await yeewallexApi.cards.getAll({ page: currentPage, limit: itemsPerPage })
      const c = data.cards || []
      setCards(c)
      setCardsTotal(data.total || 0)
      setStats({
        totalBalance: c.reduce((s: number, x: any) => s + (x.balance || 0), 0),
        totalActive: c.filter((x: any) => x.status === 'ACTIVE').length,
        totalPending: c.filter((x: any) => x.status === 'PENDING').length,
        totalFrozen: c.filter((x: any) => x.status === 'FROZEN').length,
      })
    } catch (e: any) { toast.error('Error', e.message) }
    setLoading(false)
  }

  const fetchCardholders = async () => {
    try {
      const data = await yeewallexApi.cardholders.getAll({ limit: 100 })
      setCardholders(data.cardholders || [])
    } catch (e: any) { toast.error('Error', e.message) }
  }

  const fetchTransactions = async () => {
    try {
      const data = await yeewallexApi.transactions.getAll({ page: 1, size: 50 })
      setTransactions(data.transactions || [])
      setTxTotal(data.total || 0)
    } catch (e: any) { toast.error('Error', e.message) }
  }

  const fetchAccount = async () => {
    try {
      const [info, bins] = await Promise.all([yeewallexApi.getAccountInfo(), yeewallexApi.getCardBins()])
      setAccountInfo(info)
      setCardBins(bins)
    } catch (e: any) { toast.error('Error', e.message) }
  }

  useEffect(() => { fetchCards(); fetchCardholders() }, [])
  useEffect(() => {
    if (activeTab === 'transactions') fetchTransactions()
    if (activeTab === 'recharge-history') fetchRechargeHistory()
    if (activeTab === 'account') fetchAccount()
  }, [activeTab])

  // Filtered
  const filteredCards = cards.filter(c => {
    const matchSearch = !searchQuery || (c.label || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.yeewallexCardId || '').includes(searchQuery) || (c.cardholder?.firstName || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  // Actions
  const syncFromYeewallex = async () => {
    setSyncing(true)
    try { const r = await yeewallexApi.sync(); toast.success('Synced', r.message || 'Done'); fetchCards(); fetchCardholders() } catch (e: any) { toast.error('Error', e.message) }
    setSyncing(false)
  }
  const createCardholder = async () => {
    if (!holderForm.firstName || !holderForm.lastName) return toast.error('Error', 'Name required')
    try { await yeewallexApi.cardholders.create(holderForm); toast.success('Created', 'Cardholder created'); setShowCreateHolder(false); setHolderForm({ firstName: '', lastName: '', email: '', phone: '' }); fetchCardholders() } catch (e: any) { toast.error('Error', e.message) }
  }
  const createCard = async () => {
    if (!cardForm.cardholderId) return toast.error('Error', 'Select a cardholder')
    try {
      const r = await yeewallexApi.cards.create(cardForm)
      toast.success('Created', 'Card issued! Checking status...')
      setShowCreateCard(false)
      setCardForm({ cardholderId: '', label: '', alias: '' })
      await fetchCards()

      // Auto-poll task status every 5s for up to 60s
      if (r.taskId) {
        let attempts = 0
        const poll = setInterval(async () => {
          attempts++
          try {
            const cards = await yeewallexApi.cards.getAll({ page: 1, limit: 20 })
            const newCards = cards.cards || []
            setCards(newCards)
            setCardsTotal(cards.total || 0)
            const pending = newCards.find((c: any) => c.status === 'PENDING' && c.taskId)
            if (pending) {
              await yeewallexApi.cards.getTaskStatus(pending.id)
              await fetchCards()
            }
            const stillPending = newCards.some((c: any) => c.status === 'PENDING')
            if (!stillPending || attempts >= 12) {
              clearInterval(poll)
              if (!stillPending) toast.success('Ready', 'Card is now active!')
            }
          } catch { clearInterval(poll) }
        }, 5000)
      }
    } catch (e: any) { toast.error('Error', e.message) }
  }
  const pollTaskStatus = async (id: string) => {
    try { const r = await yeewallexApi.cards.getTaskStatus(id); toast.info('Status', `Task: ${r.taskStatus || r.data?.status || 'Processing'}`); fetchCards() } catch (e: any) { toast.error('Error', e.message) }
  }
  const revealSensitive = async (id: string) => {
    setShowCardDetails(id); setCardSensitive(null); setShowSensitive(false)
    try { const data = await yeewallexApi.cards.getDetails(id); setCardSensitive(data); setShowSensitive(true); setTimeout(() => { setShowSensitive(false); setCardSensitive(null) }, 30000) } catch (e: any) { toast.error('Error', e.message) }
  }
  const cardAction = async (id: string, action: string) => {
    const ok = await confirm({ title: `${action.charAt(0).toUpperCase() + action.slice(1)} Card`, message: `Are you sure you want to ${action} this card?`, variant: action === 'cancel' ? 'danger' : 'warning' })
    if (!ok) return
    try {
      if (action === 'activate') await yeewallexApi.cards.activate(id)
      else if (action === 'freeze') await yeewallexApi.cards.freeze(id)
      else if (action === 'unfreeze') await yeewallexApi.cards.unfreeze(id)
      else if (action === 'cancel') await yeewallexApi.cards.cancel(id)
      toast.success('Done', `Card ${action}d`); fetchCards()
    } catch (e: any) { toast.error('Error', e.message) }
  }
  const doRecharge = async () => {
    if (!rechargeCardId || !rechargeAmount) return
    try { await yeewallexApi.cards.recharge(rechargeCardId, { amount: parseFloat(rechargeAmount) }); toast.success('Done', `Recharged $${rechargeAmount}`); setRechargeCardId(null); setRechargeAmount(''); fetchCards() } catch (e: any) { toast.error('Error', e.message) }
  }
  const doAssign = async () => {
    if (!assignCardId) return
    try { await yeewallexApi.cards.assign(assignCardId, assignUserId || null); toast.success('Done', assignUserId ? 'Card assigned' : 'Card unassigned'); setAssignCardId(null); setAssignUserId(''); fetchCards() } catch (e: any) { toast.error('Error', e.message) }
  }
  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied', 'Copied to clipboard') }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
      ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Active' },
      PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Pending' },
      INACTIVE: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Inactive' },
      FROZEN: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Frozen' },
      CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Cancelled' },
      FAILED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Failed' },
      SUCCESS: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Success' },
      RECHARGE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Recharge' },
      PURCHASE: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Purchase' },
    }
    const c = config[status] || { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400', label: status }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {c.label}
      </span>
    )
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // Pagination
  const totalPages = Math.ceil(cardsTotal / itemsPerPage) || 1
  const renderPageButtons = (current: number, total: number, setCurrent: (p: number) => void) => (
    <div className="flex items-center gap-1">
      <button onClick={() => setCurrent(Math.max(1, current - 1))} disabled={current === 1} className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
      {Array.from({ length: Math.min(total, 5) }, (_, i) => {
        let p: number; if (total <= 5) p = i + 1; else if (current <= 3) p = i + 1; else if (current >= total - 2) p = total - 4 + i; else p = current - 2 + i
        return <button key={p} onClick={() => setCurrent(p)} className={`w-8 h-8 rounded-md text-[13px] font-medium transition-all ${current === p ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
      })}
      <button onClick={() => setCurrent(Math.min(total, current + 1))} disabled={current >= total} className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
    </div>
  )

  return (
    <DashboardLayout title="VCC Cards">
      <style jsx>{`
        @keyframes tabFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .tab-row-animate { animation: tabFadeIn 0.25s ease-out forwards; opacity: 0; }
      `}</style>

      {/* Top Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search cards, ID, holders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-[250px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white" />
          </div>
          <div className="relative dropdown-container">
            <button onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors min-w-[130px] justify-between bg-white">
              <span>{statusFilter === 'all' ? 'All Status' : statusFilter}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${showStatusDropdown ? 'opacity-100 scale-y-100 visible' : 'opacity-0 scale-y-95 invisible'}`}>
              {[{ value: 'all', label: 'All Status' }, { value: 'ACTIVE', label: 'Active' }, { value: 'PENDING', label: 'Pending' }, { value: 'FROZEN', label: 'Frozen' }, { value: 'CANCELLED', label: 'Cancelled' }].map((o, i) => (
                <button key={o.value} onClick={() => { setStatusFilter(o.value); setShowStatusDropdown(false) }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-all ${statusFilter === o.value ? 'text-violet-600 bg-violet-50 font-medium' : 'text-gray-600'}`}
                  style={{ transitionDelay: showStatusDropdown ? `${i * 30}ms` : '0ms' }}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreateCard(true)} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"><Plus className="w-4 h-4" /> Issue Card</button>
          <button onClick={() => setShowCreateHolder(true)} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"><UserPlus className="w-4 h-4" /> Add Holder</button>
          <button onClick={syncFromYeewallex} disabled={syncing} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Total Balance</span><p className="text-2xl font-bold text-gray-800">${stats.totalBalance.toFixed(2)}</p></div>
            <span className="px-2 py-0.5 bg-blue-500 text-white text-sm font-medium rounded">Total</span>
          </div>
          <StatsChart value={stats.totalBalance} color="#3B82F6" filterId="vcc-bal-f" gradientId="vcc-bal-g" clipId="vcc-bal-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Active Cards</span><p className="text-2xl font-bold text-gray-800">{stats.totalActive}</p></div>
            <span className="px-2 py-0.5 bg-emerald-500 text-white text-sm font-medium rounded">Active</span>
          </div>
          <StatsChart value={stats.totalActive} color="#10B981" filterId="vcc-act-f" gradientId="vcc-act-g" clipId="vcc-act-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Pending Cards</span><p className="text-2xl font-bold text-gray-800">{stats.totalPending}</p></div>
            <span className="px-2 py-0.5 bg-amber-500 text-white text-sm font-medium rounded">Pending</span>
          </div>
          <StatsChart value={stats.totalPending} color="#F59E0B" filterId="vcc-pen-f" gradientId="vcc-pen-g" clipId="vcc-pen-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Frozen Cards</span><p className="text-2xl font-bold text-gray-800">{stats.totalFrozen}</p></div>
            <span className="px-2 py-0.5 bg-blue-400 text-white text-sm font-medium rounded">Frozen</span>
          </div>
          <StatsChart value={stats.totalFrozen} color="#60A5FA" filterId="vcc-frz-f" gradientId="vcc-frz-g" clipId="vcc-frz-c" />
        </Card>
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div><span className="text-[13px] text-gray-500">Card Wallet</span><p className="text-2xl font-bold text-green-600">{accountInfo?.wallets?.[0]?.usableQuota ? `$${parseFloat(accountInfo.wallets[0].usableQuota).toFixed(2)}` : '$0.00'}</p></div>
            <span className="px-2 py-0.5 bg-green-500 text-white text-sm font-medium rounded">$0</span>
          </div>
          <StatsChart value={parseFloat(accountInfo?.wallets?.[0]?.usableQuota || '0')} color="#22C55E" filterId="vcc-wal-f" gradientId="vcc-wal-g" clipId="vcc-wal-c" />
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
            <button onClick={() => { if (activeTab === 'card-list') fetchCards(); else if (activeTab === 'cardholders') fetchCardholders(); else if (activeTab === 'transactions') fetchTransactions(); else fetchAccount() }}
              className="ml-auto mr-3 p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
            <div className="absolute bottom-0 h-0.5 bg-violet-600 transition-all duration-300 ease-out" style={{ left: indicatorStyle.left, width: indicatorStyle.width }} />
          </div>
        </div>

        {/* Table — Scrollable */}
        <div className="overflow-auto flex-1 min-h-0" key={activeTab}>

          {/* ═══ CARD LIST TAB ═══ */}
          {activeTab === 'card-list' && (
            loading ? (
              <div className="flex h-64 items-center justify-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" /><span className="text-gray-500 text-sm ml-2">Loading...</span></div>
            ) : filteredCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><h3 className="text-lg font-semibold text-gray-900 mb-2">No Cards</h3><p className="text-gray-500 text-sm">No cards found. Issue your first card.</p></div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Label</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Card ID</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Balance</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Cardholder</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Assigned To</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCards.map((card, index) => (
                    <tr key={card.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate" style={{ animationDelay: `${index * 20}ms` }}>
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap font-medium">{card.label || card.alias || 'Untitled'}</td>
                      <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">{(card.yeewallexCardId || card.taskId || '—').slice(0, 18)}...</td>
                      <td className="py-2.5 px-3">{getStatusBadge(card.status)}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-600 whitespace-nowrap">${card.balance?.toFixed(2) || '0.00'}</td>
                      <td className="py-2.5 px-3 text-gray-600">{card.cardholder ? `${card.cardholder.firstName} ${card.cardholder.lastName}` : '—'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{card.assignedUser?.username || <span className="text-gray-300">—</span>}</td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{formatDate(card.createdAt)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-0.5">
                          {card.status === 'PENDING' && card.taskId && <button onClick={() => pollTaskStatus(card.id)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-500" title="Check Status"><RefreshCw className="w-3.5 h-3.5" /></button>}
                          {card.yeewallexCardId && <button onClick={() => revealSensitive(card.id)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="View"><Eye className="w-3.5 h-3.5" /></button>}
                          {card.status === 'INACTIVE' && <button onClick={() => cardAction(card.id, 'activate')} className="p-1.5 rounded-md hover:bg-green-50 text-green-600" title="Activate"><Play className="w-3.5 h-3.5" /></button>}
                          {card.status === 'ACTIVE' && <>
                            <button onClick={() => { setRechargeCardId(card.id); setRechargeAmount('') }} className="p-1.5 rounded-md hover:bg-green-50 text-green-600" title="Recharge"><DollarSign className="w-3.5 h-3.5" /></button>
                            <button onClick={() => cardAction(card.id, 'freeze')} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-500" title="Freeze"><Snowflake className="w-3.5 h-3.5" /></button>
                          </>}
                          {card.status === 'FROZEN' && <button onClick={() => cardAction(card.id, 'unfreeze')} className="p-1.5 rounded-md hover:bg-green-50 text-green-600" title="Unfreeze"><Play className="w-3.5 h-3.5" /></button>}
                          <button onClick={() => { setAssignCardId(card.id); setAssignUserId(card.assignedUser?.id || '') }} className="p-1.5 rounded-md hover:bg-violet-50 text-violet-600" title="Assign"><Link2 className="w-3.5 h-3.5" /></button>
                          {card.status !== 'CANCELLED' && card.status !== 'PENDING' && <button onClick={() => cardAction(card.id, 'cancel')} className="p-1.5 rounded-md hover:bg-red-50 text-red-500" title="Cancel"><XCircle className="w-3.5 h-3.5" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* ═══ CARDHOLDERS TAB ═══ */}
          {activeTab === 'cardholders' && (
            cardholders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><h3 className="text-lg font-semibold text-gray-900 mb-2">No Cardholders</h3><p className="text-gray-500 text-sm">Add a cardholder to issue cards.</p></div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10"><tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  {['Name', 'Email', 'Phone', 'Cards', 'Linked User', 'Created'].map(h => <th key={h} className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">{h}</th>)}
                </tr></thead>
                <tbody>{cardholders.map((h, i) => (
                  <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50/50 tab-row-animate" style={{ animationDelay: `${i * 20}ms` }}>
                    <td className="py-2.5 px-3 text-gray-700 font-medium">{h.firstName} {h.lastName}</td>
                    <td className="py-2.5 px-3 text-gray-600">{h.email || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-600">{h.phone || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-600">{h._count?.cards || 0}</td>
                    <td className="py-2.5 px-3 text-gray-500">{h.user?.username || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-500">{formatDate(h.createdAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )
          )}

          {/* ═══ RECHARGE/REFUND HISTORY TAB ═══ */}
          {activeTab === 'recharge-history' && (
            rechargeHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><h3 className="text-lg font-semibold text-gray-900 mb-2">No Recharge/Refund History</h3><p className="text-gray-500 text-sm">Card recharges, withdrawals and fees will appear here.</p></div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10"><tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  {['Time', 'Order ID', 'Card ID', 'Card No.', 'Card Notes', 'Card Account No.', 'Account Remarks', 'Type', 'Amount', 'Status', 'Asset Account Change', 'Action'].map(h => (
                    <th key={h} className="text-left py-2.5 px-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">{h}</th>
                  ))}
                </tr></thead>
                <tbody>{rechargeHistory.map((tx: any, i: number) => (
                  <tr key={tx.id || i} className="border-b border-gray-100 hover:bg-gray-50/50 tab-row-animate" style={{ animationDelay: `${i * 20}ms` }}>
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap text-xs">{tx.createdAt ? formatDate(tx.createdAt) : '—'}</td>
                    <td className="py-2 px-2 text-gray-500 font-mono text-[10px]">{tx.yeewallexTxId || tx.id || '—'}</td>
                    <td className="py-2 px-2 text-gray-500 font-mono text-[10px]">{tx.card?.yeewallexCardId || '—'}</td>
                    <td className="py-2 px-2 text-gray-600 font-mono text-xs">{tx.cardNumber || '****'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{tx.card?.label || '—'}</td>
                    <td className="py-2 px-2 text-gray-400 font-mono text-[10px]">{tx.accountNo || '—'}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{tx.accountRemarks || '—'}</td>
                    <td className="py-2 px-2">{getStatusBadge(tx.type)}</td>
                    <td className="py-2 px-2 font-semibold text-emerald-600 text-xs">${parseFloat(tx.amount || '0').toFixed(2)}</td>
                    <td className="py-2 px-2">{getStatusBadge(tx.status)}</td>
                    <td className="py-2 px-2 text-gray-600 text-xs">{tx.assetChange || tx.description || '—'}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{tx.operation || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )
          )}

          {/* ═══ TRANSACTIONS TAB ═══ */}
          {activeTab === 'transactions' && (
            transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16"><h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions</h3><p className="text-gray-500 text-sm">No transactions found. Card spending and fees will appear here.</p></div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10"><tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  {['Time', 'Txn ID', 'Card ID', 'Card No.', 'Account No.', 'Type', 'Status', 'Token', 'Wallet', 'Merchant Amt', 'Card Amt', 'Balance (Start)', 'Balance (End)', 'Settlement', 'Fee', 'Ref No.', 'Auth Code', 'Merchant', 'Country', 'MCC', 'Failure', 'Card Notes', 'Acct Remarks', 'Action'].map(h => (
                    <th key={h} className="text-left py-2.5 px-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">{h}</th>
                  ))}
                </tr></thead>
                <tbody>{transactions.map((tx: any, i: number) => (
                  <tr key={tx.id || tx.transactionId || i} className="border-b border-gray-100 hover:bg-gray-50/50 tab-row-animate" style={{ animationDelay: `${i * 20}ms` }}>
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap text-xs">{tx.transactionTime || tx.tradingTime || tx.createdAt || '—'}</td>
                    <td className="py-2 px-2 text-gray-500 font-mono text-[10px]">{tx.transactionId || tx.id || '—'}</td>
                    <td className="py-2 px-2 text-gray-500 font-mono text-[10px]">{tx.cardId || tx.card_id || '—'}</td>
                    <td className="py-2 px-2 text-gray-600 font-mono text-xs">{tx.cardNumber || tx.cardNo || '—'}</td>
                    <td className="py-2 px-2 text-gray-500 font-mono text-[10px]">{tx.accountNo || tx.cardAccountNo || '—'}</td>
                    <td className="py-2 px-2">{getStatusBadge(tx.transactionType || tx.type || '—')}</td>
                    <td className="py-2 px-2">{getStatusBadge(tx.transactionStatus || tx.status || tx.state || '—')}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{tx.tokenTransactionMark || tx.tokenMark || '—'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{tx.walletProvider || '—'}</td>
                    <td className="py-2 px-2 font-semibold text-gray-700 text-xs">{tx.merchantTransactionAmount || tx.merchantAmount ? `$${parseFloat(tx.merchantTransactionAmount || tx.merchantAmount || '0').toFixed(2)}` : '—'}</td>
                    <td className="py-2 px-2 font-semibold text-emerald-600 text-xs">{tx.cardTransactionAmount || tx.transactionAmount || tx.amount ? `$${parseFloat(tx.cardTransactionAmount || tx.transactionAmount || tx.amount || '0').toFixed(2)}` : '—'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{tx.beginBalance || tx.balanceStart ? `$${parseFloat(tx.beginBalance || tx.balanceStart || '0').toFixed(2)}` : '—'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{tx.endBalance || tx.balanceEnd ? `$${parseFloat(tx.endBalance || tx.balanceEnd || '0').toFixed(2)}` : '—'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{tx.settlementAmount || tx.liquidationAmount ? `$${parseFloat(tx.settlementAmount || tx.liquidationAmount || '0').toFixed(2)}` : '—'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{tx.fee || tx.handlingFee ? `$${parseFloat(tx.fee || tx.handlingFee || '0').toFixed(2)}` : '—'}</td>
                    <td className="py-2 px-2 text-gray-400 font-mono text-[10px]">{tx.tradingReferenceNo || tx.referenceNo || '—'}</td>
                    <td className="py-2 px-2 text-gray-400 font-mono text-[10px]">{tx.authorizationCode || tx.authCode || '—'}</td>
                    <td className="py-2 px-2 text-gray-600 text-xs">{tx.merchantName || tx.merchant_name || '—'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{tx.merchantCountry || tx.country || '—'}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{tx.merchantMcc || tx.mcc || '—'}</td>
                    <td className="py-2 px-2 text-red-500 text-xs">{tx.failureReason || tx.failReason || '—'}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{tx.cardNotes || tx.cardRemark || '—'}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{tx.accountRemarks || tx.accountNoRemarks || '—'}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{tx.operate || tx.operation || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )
          )}

          {/* ═══ ACCOUNT TAB ═══ */}
          {activeTab === 'account' && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-violet-500" /> Account Info</h3>
                {accountInfo ? (
                  <div className="space-y-3">
                    {accountInfo.username && <div className="flex justify-between"><span className="text-sm text-gray-500">Company</span><span className="text-sm font-medium">{accountInfo.username}</span></div>}
                    {accountInfo.customerId && <div className="flex justify-between"><span className="text-sm text-gray-500">Merchant ID</span><span className="text-sm font-mono">{accountInfo.customerId}</span></div>}
                    {accountInfo.wallets?.map((w: any) => <div key={w.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><span className="text-sm font-medium">{w.currency}</span><span className="text-lg font-bold">{parseFloat(w.usableQuota).toFixed(2)}</span></div>)}
                  </div>
                ) : <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
              </div>
              <div className="border border-gray-100 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-violet-500" /> Card BINs</h3>
                {cardBins?.bins?.data?.map((bin: any) => (
                  <div key={bin.id} className="p-3 bg-gray-50 rounded-lg mb-2 flex justify-between items-center">
                    <div><p className="text-sm font-medium">{bin.cardLabel} — {bin.currency}</p><p className="text-xs text-gray-400 font-mono mt-0.5">BIN: {bin.sectionNo}</p></div>
                    {getStatusBadge('ACTIVE')}
                  </div>
                )) || <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
              </div>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {activeTab === 'card-list' && filteredCards.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 flex-shrink-0 bg-white">
            <p className="text-xs text-gray-500">Page {currentPage} of {totalPages}</p>
            {renderPageButtons(currentPage, totalPages, setCurrentPage)}
          </div>
        )}
      </Card>

      {/* ═══ MODALS ═══ */}
      <Modal isOpen={showCreateHolder} onClose={() => setShowCreateHolder(false)} title="Add Cardholder">
        <div className="space-y-4 p-1">
          <div className="grid grid-cols-2 gap-3"><Input label="First Name *" value={holderForm.firstName} onChange={e => setHolderForm(p => ({ ...p, firstName: e.target.value }))} /><Input label="Last Name *" value={holderForm.lastName} onChange={e => setHolderForm(p => ({ ...p, lastName: e.target.value }))} /></div>
          <Input label="Email" value={holderForm.email} onChange={e => setHolderForm(p => ({ ...p, email: e.target.value }))} />
          <Input label="Phone" value={holderForm.phone} onChange={e => setHolderForm(p => ({ ...p, phone: e.target.value }))} />
          <div className="flex gap-2 pt-2"><button onClick={() => setShowCreateHolder(false)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={createCardholder} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">Create</button></div>
        </div>
      </Modal>

      <Modal isOpen={showCreateCard} onClose={() => setShowCreateCard(false)} title="Issue New Card">
        <div className="space-y-4 p-1">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Cardholder *</label><select value={cardForm.cardholderId} onChange={e => setCardForm(p => ({ ...p, cardholderId: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"><option value="">Select Cardholder</option>{cardholders.map(h => <option key={h.id} value={h.id}>{h.firstName} {h.lastName}</option>)}</select></div>
          <Input label="Card Label" placeholder="e.g. FB Ads #1" value={cardForm.label} onChange={e => setCardForm(p => ({ ...p, label: e.target.value }))} />
          <p className="text-xs text-gray-400">Card BIN: VC03 — Ads & Purchasing (USD)</p>
          <div className="flex gap-2 pt-2"><button onClick={() => setShowCreateCard(false)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={createCard} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">Issue Card</button></div>
        </div>
      </Modal>

      <Modal isOpen={!!showCardDetails} onClose={() => { setShowCardDetails(null); setCardSensitive(null); setShowSensitive(false) }} title="Card Details">
        <div className="p-1">
          {!showSensitive ? (
            <div className="text-center py-8"><EyeOff className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500 mb-4">Card details hidden for security</p><button onClick={() => showCardDetails && revealSensitive(showCardDetails)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"><Eye className="w-4 h-4" /> Reveal Details</button><p className="text-[11px] text-gray-400 mt-2">Auto-hides after 30 seconds</p></div>
          ) : cardSensitive ? (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4"><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Card Number</p><div className="flex items-center justify-between"><p className="font-mono text-lg font-bold tracking-wider">{cardSensitive.cardNo}</p><button onClick={() => copyText(cardSensitive.cardNo)} className="p-1.5 hover:bg-gray-200 rounded-lg"><Copy className="w-4 h-4 text-gray-400" /></button></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4"><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Expiry</p><p className="font-mono text-base font-bold">{cardSensitive.expireDate || '—'}</p></div>
                <div className="bg-gray-50 rounded-xl p-4"><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">CVV</p><div className="flex items-center justify-between"><p className="font-mono text-base font-bold">{cardSensitive.cvv || '—'}</p>{cardSensitive.cvv && <button onClick={() => copyText(cardSensitive.cvv)} className="p-1.5 hover:bg-gray-200 rounded-lg"><Copy className="w-4 h-4 text-gray-400" /></button>}</div></div>
              </div>
            </div>
          ) : <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}
        </div>
      </Modal>

      <Modal isOpen={!!rechargeCardId} onClose={() => setRechargeCardId(null)} title="Recharge Card">
        <div className="p-1 space-y-4"><Input label="Amount (USD)" type="number" placeholder="Enter amount" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} /><div className="flex gap-2"><button onClick={() => setRechargeCardId(null)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={doRecharge} className="flex-1 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">Recharge</button></div></div>
      </Modal>

      <Modal isOpen={!!assignCardId} onClose={() => setAssignCardId(null)} title="Assign Card to User">
        <div className="p-1 space-y-4"><Input label="User ID" placeholder="Leave empty to unassign" value={assignUserId} onChange={e => setAssignUserId(e.target.value)} /><div className="flex gap-2"><button onClick={() => setAssignCardId(null)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button><button onClick={doAssign} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">{assignUserId ? 'Assign' : 'Unassign'}</button></div></div>
      </Modal>
    </DashboardLayout>
  )
}
