'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { airwallexApi } from '@/lib/api'
import {
  CreditCard,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  Snowflake,
  Play,
  XCircle,
  DollarSign,
  ArrowDownCircle,
  User,
  ChevronDown,
  ChevronRight,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Search,
} from 'lucide-react'

type Tab = 'cards' | 'cardholders' | 'transactions' | 'balances'

type CardItem = {
  card_id: string
  card_nickname?: string
  card_number?: string
  display_name?: string
  cardholder_id?: string
  status: string
  brand?: string
  currency?: string
  created_at?: string
  authorization_controls?: any
  card_type?: string
  form_factor?: string
  is_personalized?: boolean
  primary_card_id?: string
}

type CardholderItem = {
  cardholder_id: string
  email?: string
  first_name?: string
  last_name?: string
  status?: string
  created_at?: string
  phone_number?: string
}

type TransactionItem = {
  transaction_id: string
  card_id?: string
  amount?: number
  currency?: string
  merchant?: { name?: string; category?: string; country?: string }
  status?: string
  transaction_date?: string
  created_at?: string
  type?: string
  description?: string
}

export default function AirwallexPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [activeTab, setActiveTab] = useState<Tab>('cards')
  const [loading, setLoading] = useState(false)
  const [authOk, setAuthOk] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState<string>('')

  // Cards
  const [cards, setCards] = useState<CardItem[]>([])
  const [cardsTotal, setCardsTotal] = useState(0)
  const [cardPage, setCardPage] = useState(0)
  const [cardStatusFilter, setCardStatusFilter] = useState('')
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null)
  const [cardDetails, setCardDetails] = useState<any>(null)
  const [showSensitive, setShowSensitive] = useState(false)

  // Cardholders
  const [cardholders, setCardholders] = useState<CardholderItem[]>([])
  const [cardholdersTotal, setCardholdersTotal] = useState(0)

  // Transactions
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txCardFilter, setTxCardFilter] = useState('')

  // Balances
  const [balances, setBalances] = useState<any>(null)

  // Create card modal
  const [showCreateCard, setShowCreateCard] = useState(false)
  const [createCardData, setCreateCardData] = useState({
    cardholder_id: '',
    card_nickname: '',
    currency: 'USD',
    authorization_controls: {
      allowed_transaction_count: 'MULTIPLE',
    },
    form_factor: 'VIRTUAL',
    is_personalized: false,
  })

  // Create cardholder modal
  const [showCreateHolder, setShowCreateHolder] = useState(false)
  const [createHolderData, setCreateHolderData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
  })

  // Fund modal
  const [showFundModal, setShowFundModal] = useState(false)
  const [fundData, setFundData] = useState({ amount: '', currency: 'USD' })
  const [fundCardId, setFundCardId] = useState('')
  const [fundMode, setFundMode] = useState<'fund' | 'withdraw'>('fund')

  // Test auth on mount
  useEffect(() => {
    testAuth()
  }, [])

  useEffect(() => {
    if (authOk) {
      if (activeTab === 'cards') fetchCards()
      else if (activeTab === 'cardholders') fetchCardholders()
      else if (activeTab === 'transactions') fetchTransactions()
      else if (activeTab === 'balances') fetchBalances()
    }
  }, [activeTab, authOk, cardPage, cardStatusFilter])

  async function testAuth() {
    try {
      const res = await airwallexApi.testAuth()
      setAuthOk(res.success)
      if (!res.success) setAuthError(res.message)
    } catch (err: any) {
      setAuthOk(false)
      setAuthError(err.message || 'Authentication failed')
    }
  }

  async function fetchCards() {
    setLoading(true)
    try {
      const res = await airwallexApi.cards.getAll({
        page_num: cardPage,
        page_size: 20,
        status: cardStatusFilter || undefined,
      })
      setCards(res.items || [])
      setCardsTotal(res.total_count || 0)
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to fetch cards')
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchCardholders() {
    setLoading(true)
    try {
      const res = await airwallexApi.cardholders.getAll({ page_num: 0, page_size: 50 })
      setCardholders(res.items || [])
      setCardholdersTotal(res.total_count || 0)
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to fetch cardholders')
      setCardholders([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchTransactions() {
    setLoading(true)
    try {
      const res = await airwallexApi.transactions.getAll({
        page_num: 0,
        page_size: 50,
        card_id: txCardFilter || undefined,
      })
      setTransactions(res.items || [])
      setTxTotal(res.total_count || 0)
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to fetch transactions')
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchBalances() {
    setLoading(true)
    try {
      const res = await airwallexApi.getBalances()
      setBalances(res)
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to fetch balances')
    } finally {
      setLoading(false)
    }
  }

  async function viewCardDetails(card: CardItem) {
    setSelectedCard(card)
    setCardDetails(null)
    setShowSensitive(false)
  }

  async function fetchSensitiveDetails(cardId: string) {
    try {
      const res = await airwallexApi.cards.getDetails(cardId)
      setCardDetails(res)
      setShowSensitive(true)
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to get card details')
    }
  }

  async function handleActivateCard(cardId: string) {
    const ok = await confirm({ title: 'Activate Card', message: 'Are you sure you want to activate this card?' })
    if (!ok) return
    try {
      await airwallexApi.cards.activate(cardId)
      toast.success('Success', 'Card activated successfully')
      fetchCards()
      setSelectedCard(null)
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to activate card')
    }
  }

  async function handleFreezeCard(cardId: string) {
    const ok = await confirm({ title: 'Freeze Card', message: 'Are you sure you want to freeze this card?' })
    if (!ok) return
    try {
      await airwallexApi.cards.deactivate(cardId)
      toast.success('Success', 'Card frozen successfully')
      fetchCards()
      setSelectedCard(null)
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to freeze card')
    }
  }

  async function handleCancelCard(cardId: string) {
    const ok = await confirm({ title: 'Cancel Card', message: 'Are you sure you want to CANCEL this card? This action cannot be undone.', variant: 'danger' })
    if (!ok) return
    try {
      await airwallexApi.cards.cancel(cardId, 'Admin cancelled')
      toast.success('Success', 'Card cancelled')
      fetchCards()
      setSelectedCard(null)
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to cancel card')
    }
  }

  async function handleCreateCard() {
    if (!createCardData.cardholder_id) {
      toast.error('Error', 'Cardholder ID is required')
      return
    }
    try {
      await airwallexApi.cards.create(createCardData)
      toast.success('Success', 'Card created successfully')
      setShowCreateCard(false)
      setCreateCardData({
        cardholder_id: '',
        card_nickname: '',
        currency: 'USD',
        authorization_controls: { allowed_transaction_count: 'MULTIPLE' },
        form_factor: 'VIRTUAL',
        is_personalized: false,
      })
      fetchCards()
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to create card')
    }
  }

  async function handleCreateHolder() {
    if (!createHolderData.email || !createHolderData.first_name || !createHolderData.last_name) {
      toast.error('Error', 'Name and email are required')
      return
    }
    try {
      await airwallexApi.cardholders.create(createHolderData)
      toast.success('Success', 'Cardholder created')
      setShowCreateHolder(false)
      setCreateHolderData({ email: '', first_name: '', last_name: '', phone_number: '' })
      fetchCardholders()
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to create cardholder')
    }
  }

  async function handleFundCard() {
    const amt = parseFloat(fundData.amount)
    if (!amt || amt <= 0) {
      toast.error('Error', 'Enter a valid amount')
      return
    }
    try {
      if (fundMode === 'fund') {
        await airwallexApi.cards.fund(fundCardId, { amount: amt, currency: fundData.currency })
        toast.success('Success', `Funded $${amt} to card`)
      } else {
        await airwallexApi.cards.withdraw(fundCardId, { amount: amt, currency: fundData.currency })
        toast.success('Success', `Withdrawn $${amt} from card`)
      }
      setShowFundModal(false)
      setFundData({ amount: '', currency: 'USD' })
      fetchCards()
    } catch (err: any) {
      toast.error('Error', err.message || 'Fund operation failed')
    }
  }

  function getStatusColor(status: string) {
    const s = status?.toUpperCase()
    if (s === 'ACTIVE') return 'bg-emerald-100 text-emerald-700'
    if (s === 'INACTIVE' || s === 'DEACTIVATED' || s === 'FROZEN') return 'bg-blue-100 text-blue-700'
    if (s === 'CANCELLED' || s === 'CLOSED') return 'bg-red-100 text-red-700'
    if (s === 'PENDING') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-600'
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copied', 'Copied to clipboard')
  }

  function formatDate(d?: string) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // ── Auth not ready state ──
  if (authOk === null) {
    return (
      <DashboardLayout title="Airwallex">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-500 text-sm">Connecting to Airwallex...</span>
        </div>
      </DashboardLayout>
    )
  }

  if (authOk === false) {
    return (
      <DashboardLayout title="Airwallex">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-900">Airwallex Connection Issue</h3>
          <p className="text-sm text-gray-500 max-w-md text-center">
            {authError || 'Unable to authenticate with Airwallex API. KYB verification may still be pending.'}
          </p>
          <button onClick={testAuth} className="mt-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">
            Retry Connection
          </button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Airwallex" subtitle="Card Issuing & Management">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
        {([
          { key: 'cards' as Tab, label: 'Cards', icon: CreditCard },
          { key: 'cardholders' as Tab, label: 'Cardholders', icon: User },
          { key: 'transactions' as Tab, label: 'Transactions', icon: DollarSign },
          { key: 'balances' as Tab, label: 'Balances', icon: Wallet },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Cards Tab ── */}
      {activeTab === 'cards' && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <select
                value={cardStatusFilter}
                onChange={e => { setCardStatusFilter(e.target.value); setCardPage(0) }}
                className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button onClick={fetchCards} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <span className="text-[11px] text-gray-400">{cardsTotal} cards</span>
            </div>
            <button
              onClick={() => setShowCreateCard(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[12px] font-medium hover:bg-gray-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Card
            </button>
          </div>

          {/* Cards table */}
          <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-left">
                  <th className="px-3 py-2.5 font-medium">Card ID</th>
                  <th className="px-3 py-2.5 font-medium">Nickname</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Brand</th>
                  <th className="px-3 py-2.5 font-medium">Currency</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && cards.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : cards.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">No cards found. Create one to get started.</td></tr>
                ) : cards.map(card => (
                  <tr key={card.card_id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px] text-gray-600">{card.card_id?.substring(0, 12)}...</span>
                      <button onClick={() => copyText(card.card_id)} className="ml-1 text-gray-300 hover:text-gray-500">
                        <Copy className="w-3 h-3 inline" />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{card.card_nickname || card.display_name || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{card.form_factor || card.card_type || 'VIRTUAL'}</td>
                    <td className="px-3 py-2 text-gray-500">{card.brand || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{card.currency || 'USD'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(card.status)}`}>
                        {card.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{formatDate(card.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => viewCardDetails(card)} title="View" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {card.status === 'ACTIVE' && (
                          <button onClick={() => handleFreezeCard(card.card_id)} title="Freeze" className="p-1 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600">
                            <Snowflake className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(card.status === 'INACTIVE' || card.status === 'DEACTIVATED') && (
                          <button onClick={() => handleActivateCard(card.card_id)} title="Activate" className="p-1 rounded hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {card.status !== 'CANCELLED' && (
                          <>
                            <button
                              onClick={() => { setFundCardId(card.card_id); setFundMode('fund'); setShowFundModal(true) }}
                              title="Fund" className="p-1 rounded hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setFundCardId(card.card_id); setFundMode('withdraw'); setShowFundModal(true) }}
                              title="Withdraw" className="p-1 rounded hover:bg-amber-50 text-amber-400 hover:text-amber-600"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleCancelCard(card.card_id)} title="Cancel" className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {cardsTotal > 20 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-[11px] text-gray-400">Page {cardPage + 1} of {Math.ceil(cardsTotal / 20)}</span>
              <div className="flex gap-1">
                <button disabled={cardPage === 0} onClick={() => setCardPage(p => p - 1)} className="px-3 py-1 text-[11px] border rounded-md disabled:opacity-40">Prev</button>
                <button disabled={(cardPage + 1) * 20 >= cardsTotal} onClick={() => setCardPage(p => p + 1)} className="px-3 py-1 text-[11px] border rounded-md disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cardholders Tab ── */}
      {activeTab === 'cardholders' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={fetchCardholders} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <span className="text-[11px] text-gray-400">{cardholdersTotal} cardholders</span>
            </div>
            <button
              onClick={() => setShowCreateHolder(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[12px] font-medium hover:bg-gray-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Cardholder
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-left">
                  <th className="px-3 py-2.5 font-medium">ID</th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading && cardholders.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : cardholders.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No cardholders found.</td></tr>
                ) : cardholders.map(h => (
                  <tr key={h.cardholder_id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px] text-gray-600">{h.cardholder_id?.substring(0, 12)}...</span>
                      <button onClick={() => copyText(h.cardholder_id)} className="ml-1 text-gray-300 hover:text-gray-500">
                        <Copy className="w-3 h-3 inline" />
                      </button>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{h.first_name} {h.last_name}</td>
                    <td className="px-3 py-2 text-gray-500">{h.email || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{h.phone_number || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(h.status || 'ACTIVE')}`}>
                        {h.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{formatDate(h.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {activeTab === 'transactions' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={txCardFilter}
              onChange={e => setTxCardFilter(e.target.value)}
              placeholder="Filter by Card ID..."
              className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 w-64 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
            <button onClick={fetchTransactions} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-[11px] text-gray-400">{txTotal} transactions</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-left">
                  <th className="px-3 py-2.5 font-medium">Transaction ID</th>
                  <th className="px-3 py-2.5 font-medium">Card</th>
                  <th className="px-3 py-2.5 font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Merchant</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && transactions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No transactions found.</td></tr>
                ) : transactions.map(tx => (
                  <tr key={tx.transaction_id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px] text-gray-600">{tx.transaction_id?.substring(0, 12)}...</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 font-mono text-[11px]">{tx.card_id?.substring(0, 8)}...</td>
                    <td className="px-3 py-2 font-medium text-gray-700">
                      {tx.currency || 'USD'} {tx.amount?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{tx.merchant?.name || tx.description || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{tx.type || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(tx.status || '')}`}>
                        {tx.status || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{formatDate(tx.transaction_date || tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Balances Tab ── */}
      {activeTab === 'balances' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={fetchBalances} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading balances...</div>
          ) : !balances ? (
            <div className="text-center py-12 text-gray-400 text-sm">No balance data available.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Array.isArray(balances) ? balances : balances.items || [balances]).map((bal: any, idx: number) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200/80 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="w-5 h-5 text-violet-500" />
                    <span className="text-sm font-semibold text-gray-900">{bal.currency || 'USD'}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[12px] text-gray-500">Available</span>
                      <span className="text-[13px] font-medium text-gray-900">
                        {Number(bal.available_amount || bal.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {bal.pending_amount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[12px] text-gray-500">Pending</span>
                        <span className="text-[13px] font-medium text-amber-600">
                          {Number(bal.pending_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {bal.reserved_amount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-[12px] text-gray-500">Reserved</span>
                        <span className="text-[13px] font-medium text-gray-500">
                          {Number(bal.reserved_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Card Details Sidebar ── */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedCard(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl h-full overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Card Details</h3>
              <button onClick={() => setSelectedCard(null)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Card visual */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-700 rounded-xl p-5 text-white">
                <div className="text-[10px] text-gray-300 mb-4">AIRWALLEX</div>
                <div className="font-mono text-lg tracking-wider mb-4">
                  {showSensitive && cardDetails?.card_number
                    ? cardDetails.card_number.replace(/(.{4})/g, '$1 ').trim()
                    : selectedCard.card_number
                      ? '**** **** **** ' + selectedCard.card_number
                      : '**** **** **** ****'}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-gray-400">CARDHOLDER</div>
                    <div className="text-[12px]">{selectedCard.display_name || selectedCard.card_nickname || '-'}</div>
                  </div>
                  {showSensitive && cardDetails && (
                    <div className="text-right">
                      <div className="text-[9px] text-gray-400">EXPIRY</div>
                      <div className="text-[12px]">{cardDetails.expiry_month}/{cardDetails.expiry_year}</div>
                    </div>
                  )}
                  {showSensitive && cardDetails && (
                    <div className="text-right">
                      <div className="text-[9px] text-gray-400">CVV</div>
                      <div className="text-[12px]">{cardDetails.cvc}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sensitive details toggle */}
              <button
                onClick={() => showSensitive ? setShowSensitive(false) : fetchSensitiveDetails(selectedCard.card_id)}
                className="flex items-center gap-1.5 text-[12px] text-violet-600 hover:text-violet-800 font-medium"
              >
                {showSensitive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showSensitive ? 'Hide sensitive details' : 'Show PAN / CVV / Expiry'}
              </button>

              {/* Info */}
              <div className="space-y-3">
                {[
                  ['Card ID', selectedCard.card_id],
                  ['Status', selectedCard.status],
                  ['Currency', selectedCard.currency || 'USD'],
                  ['Brand', selectedCard.brand || '-'],
                  ['Cardholder ID', selectedCard.cardholder_id || '-'],
                  ['Created', formatDate(selectedCard.created_at)],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between border-b border-gray-50 pb-2">
                    <span className="text-[12px] text-gray-400">{label}</span>
                    <span className="text-[12px] text-gray-700 font-medium">{value as string}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedCard.status === 'ACTIVE' && (
                  <button onClick={() => handleFreezeCard(selectedCard.card_id)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[12px] hover:bg-blue-100">
                    <Snowflake className="w-3.5 h-3.5" /> Freeze
                  </button>
                )}
                {(selectedCard.status === 'INACTIVE' || selectedCard.status === 'DEACTIVATED') && (
                  <button onClick={() => handleActivateCard(selectedCard.card_id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[12px] hover:bg-emerald-100">
                    <Play className="w-3.5 h-3.5" /> Activate
                  </button>
                )}
                {selectedCard.status !== 'CANCELLED' && (
                  <>
                    <button
                      onClick={() => { setFundCardId(selectedCard.card_id); setFundMode('fund'); setShowFundModal(true) }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[12px] hover:bg-emerald-100"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Fund
                    </button>
                    <button
                      onClick={() => { setFundCardId(selectedCard.card_id); setFundMode('withdraw'); setShowFundModal(true) }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-[12px] hover:bg-amber-100"
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5" /> Withdraw
                    </button>
                    <button onClick={() => handleCancelCard(selectedCard.card_id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-[12px] hover:bg-red-100">
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Card Modal ── */}
      {showCreateCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowCreateCard(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Create New Card</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Cardholder ID *</label>
                <input
                  type="text"
                  value={createCardData.cardholder_id}
                  onChange={e => setCreateCardData(d => ({ ...d, cardholder_id: e.target.value }))}
                  placeholder="Enter cardholder ID"
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Card Nickname</label>
                <input
                  type="text"
                  value={createCardData.card_nickname}
                  onChange={e => setCreateCardData(d => ({ ...d, card_nickname: e.target.value }))}
                  placeholder="e.g. Marketing Card"
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Currency</label>
                  <select
                    value={createCardData.currency}
                    onChange={e => setCreateCardData(d => ({ ...d, currency: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  >
                    <option value="USD">USD</option>
                    <option value="HKD">HKD</option>
                    <option value="CNY">CNY</option>
                    <option value="SGD">SGD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Form Factor</label>
                  <select
                    value={createCardData.form_factor}
                    onChange={e => setCreateCardData(d => ({ ...d, form_factor: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  >
                    <option value="VIRTUAL">Virtual</option>
                    <option value="PHYSICAL">Physical</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreateCard(false)} className="px-4 py-2 text-[12px] text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleCreateCard} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-[12px] font-medium hover:bg-gray-800">Create Card</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Cardholder Modal ── */}
      {showCreateHolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowCreateHolder(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Create Cardholder</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">First Name *</label>
                  <input
                    type="text"
                    value={createHolderData.first_name}
                    onChange={e => setCreateHolderData(d => ({ ...d, first_name: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Last Name *</label>
                  <input
                    type="text"
                    value={createHolderData.last_name}
                    onChange={e => setCreateHolderData(d => ({ ...d, last_name: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Email *</label>
                <input
                  type="email"
                  value={createHolderData.email}
                  onChange={e => setCreateHolderData(d => ({ ...d, email: e.target.value }))}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Phone</label>
                <input
                  type="text"
                  value={createHolderData.phone_number}
                  onChange={e => setCreateHolderData(d => ({ ...d, phone_number: e.target.value }))}
                  placeholder="+852..."
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreateHolder(false)} className="px-4 py-2 text-[12px] text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleCreateHolder} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-[12px] font-medium hover:bg-gray-800">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fund/Withdraw Modal ── */}
      {showFundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowFundModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {fundMode === 'fund' ? 'Fund Card' : 'Withdraw from Card'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Card ID</label>
                <input type="text" value={fundCardId} disabled className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Amount *</label>
                  <input
                    type="number"
                    value={fundData.amount}
                    onChange={e => setFundData(d => ({ ...d, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">Currency</label>
                  <select
                    value={fundData.currency}
                    onChange={e => setFundData(d => ({ ...d, currency: e.target.value }))}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  >
                    <option value="USD">USD</option>
                    <option value="HKD">HKD</option>
                    <option value="CNY">CNY</option>
                    <option value="SGD">SGD</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowFundModal(false)} className="px-4 py-2 text-[12px] text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleFundCard} className={`px-4 py-2 rounded-lg text-[12px] font-medium text-white ${fundMode === 'fund' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {fundMode === 'fund' ? 'Fund Card' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
