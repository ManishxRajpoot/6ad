'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/contexts/ToastContext'
import { vccApi, authApi } from '@/lib/api'
import {
  CreditCard, Eye, EyeOff, Copy, Plus, ArrowDownToLine, ArrowUpFromLine,
  Clock, Wallet, RefreshCw, Loader2, Snowflake, CheckCircle2,
} from 'lucide-react'

type Tab = 'cards' | 'transactions'

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
  const [tab, setTab] = useState<Tab>('cards')
  const [cards, setCards] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modals
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueForm, setIssueForm] = useState({ label: '', alias: '' })
  const [issueSubmitting, setIssueSubmitting] = useState(false)

  const [depositCardId, setDepositCardId] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositSubmitting, setDepositSubmitting] = useState(false)

  const [withdrawCardId, setWithdrawCardId] = useState<string | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)

  // Card details (sensitive)
  const [detailsCardId, setDetailsCardId] = useState<string | null>(null)
  const [cardSensitive, setCardSensitive] = useState<any>(null)
  const [showSensitive, setShowSensitive] = useState(false)
  const [revealLoading, setRevealLoading] = useState(false)

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return
    refreshAll()
  }, [isHydrated, isAuthenticated])

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

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = cards.reduce((s, c) => s + (Number(c.balance) || 0), 0)
    const active = cards.filter(c => c.status === 'ACTIVE').length
    const totalSpend = cards.reduce((s, c) => s + (Number(c.totalSpent) || 0), 0)
    return { total, active, totalSpend, count: cards.length }
  }, [cards])

  // ─── Actions ──────────────────────────────────────────────────────────
  const submitIssue = async () => {
    setIssueSubmitting(true)
    try {
      await vccApi.issueCard(issueForm)
      showToast('success', 'Card issued. It may take a moment to activate.')
      setIssueOpen(false)
      setIssueForm({ label: '', alias: '' })
      await refreshSilent()
    } catch (e: any) {
      showToast('error', e.message)
    }
    setIssueSubmitting(false)
  }

  const submitDeposit = async () => {
    if (!depositCardId) return
    const amt = parseFloat(depositAmount)
    if (!amt || amt <= 0) return showToast('error', 'Enter a valid amount')
    setDepositSubmitting(true)
    try {
      await vccApi.rechargeCard(depositCardId, amt)
      showToast('success', `Deposited $${amt.toFixed(2)} to card`)
      setDepositCardId(null)
      setDepositAmount('')
      await refreshSilent()
    } catch (e: any) {
      showToast('error', e.message)
    }
    setDepositSubmitting(false)
  }

  const submitWithdraw = async () => {
    if (!withdrawCardId) return
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt <= 0) return showToast('error', 'Enter a valid amount')
    setWithdrawSubmitting(true)
    try {
      await vccApi.withdrawCard(withdrawCardId, amt)
      showToast('success', `Withdrew $${amt.toFixed(2)} to wallet`)
      setWithdrawCardId(null)
      setWithdrawAmount('')
      await refreshSilent()
    } catch (e: any) {
      showToast('error', e.message)
    }
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
    } catch (e: any) {
      showToast('error', e.message)
    }
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

  const depositCard = cards.find(c => c.id === depositCardId)
  const withdrawCard = cards.find(c => c.id === withdrawCardId)
  const walletBalance = Number(user?.walletBalance || 0)

  return (
    <DashboardLayout title="VCC Cards" subtitle="Virtual credit cards">
      {/* ─── Top Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1.5"><Wallet className="w-4 h-4" />Wallet Balance</div>
          <p className="text-2xl font-bold text-gray-900">${walletBalance.toFixed(2)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Used to recharge cards</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1.5"><CreditCard className="w-4 h-4" />Total Card Balance</div>
          <p className="text-2xl font-bold text-emerald-600">${stats.total.toFixed(2)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Across {stats.count} card{stats.count === 1 ? '' : 's'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1.5"><CheckCircle2 className="w-4 h-4" />Active Cards</div>
          <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Ready to use</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1.5"><ArrowUpFromLine className="w-4 h-4" />Total Spend</div>
          <p className="text-2xl font-bold text-gray-900">${stats.totalSpend.toFixed(2)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Lifetime card spend</p>
        </div>
      </div>

      {/* ─── Tabs + Actions ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5">
          <div className="flex">
            {([
              { id: 'cards', label: 'My Cards' },
              { id: 'transactions', label: 'Transactions' },
            ] as { id: Tab; label: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-[#52B788] text-[#52B788]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshSilent}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#52B788] hover:bg-emerald-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIssueOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#52B788] text-white text-sm font-medium hover:bg-[#47a279] transition-colors"
            >
              <Plus className="w-4 h-4" /> Issue Card
            </button>
          </div>
        </div>

        {/* ─── Tab Content ───────────────────────────────────────── */}
        <div className="p-5">
          {tab === 'cards' && (
            loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-16">
                <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-700 text-base font-medium">No cards yet</p>
                <p className="text-gray-400 text-sm mt-1 mb-4">Issue your first virtual card to start spending.</p>
                <button
                  onClick={() => setIssueOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#52B788] text-white text-sm font-medium hover:bg-[#47a279]"
                >
                  <Plus className="w-4 h-4" /> Issue Card
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map(card => (
                  <div key={card.id} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                    {/* Card visual */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-700 p-5 text-white relative overflow-hidden">
                      <div className="absolute top-3 right-3 w-10 h-10 rounded-full border border-white/20" />
                      <div className="absolute top-3 right-7 w-10 h-10 rounded-full border border-white/10" />
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-4">Virtual Card</p>
                      <p className="font-mono text-lg tracking-[0.2em] mb-3">
                        {card.cardNumber
                          ? card.cardNumber.replace(/\*/g, '•').replace(/(.{4})/g, '$1 ').trim()
                          : `•••• •••• •••• ${card.yeewallexCardId ? card.yeewallexCardId.slice(-4) : '••••'}`}
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] text-white/30 uppercase">Cardholder</p>
                          <p className="text-sm">{card.cardholder?.firstName} {card.cardholder?.lastName}</p>
                        </div>
                        <StatusBadge status={card.status} />
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[11px] text-gray-400 uppercase">Balance</p>
                          <p className="text-xl font-bold text-gray-900">${Number(card.balance || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-gray-400 uppercase">Currency</p>
                          <p className="text-sm font-semibold text-gray-700">{card.currency}</p>
                        </div>
                      </div>

                      {card.label && <p className="text-xs text-gray-500 mb-3 truncate">{card.label}</p>}

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          disabled={card.status !== 'ACTIVE' || !card.yeewallexCardId}
                          onClick={() => setDetailsCardId(card.id)}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-[11px] font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Eye className="w-4 h-4" /> Details
                        </button>
                        <button
                          disabled={card.status !== 'ACTIVE'}
                          onClick={() => { setDepositCardId(card.id); setDepositAmount('') }}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[11px] font-medium text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowDownToLine className="w-4 h-4" /> Deposit
                        </button>
                        <button
                          disabled={card.status !== 'ACTIVE' || Number(card.balance) <= 0}
                          onClick={() => { setWithdrawCardId(card.id); setWithdrawAmount('') }}
                          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[11px] font-medium text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUpFromLine className="w-4 h-4" /> Withdraw
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'transactions' && (
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
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No transactions yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Issue Card Modal ──────────────────────────────────────── */}
      <Modal isOpen={issueOpen} onClose={() => setIssueOpen(false)} title="Issue New Card">
        <div className="space-y-4 p-1">
          <p className="text-sm text-gray-500">
            A new virtual card will be issued and assigned to you.
          </p>
          <Input
            label="Label (optional)"
            value={issueForm.label}
            onChange={e => setIssueForm(p => ({ ...p, label: e.target.value }))}
            placeholder="e.g. Facebook Ads"
          />
          <Input
            label="Alias (optional)"
            value={issueForm.alias}
            onChange={e => setIssueForm(p => ({ ...p, alias: e.target.value }))}
            placeholder="Internal nickname"
          />
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIssueOpen(false)}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              disabled={issueSubmitting}
              onClick={submitIssue}
              className="flex-1 py-2.5 rounded-xl bg-[#52B788] text-white text-sm font-medium hover:bg-[#47a279] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {issueSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Issue Card
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Deposit Modal ─────────────────────────────────────────── */}
      <Modal isOpen={!!depositCardId} onClose={() => setDepositCardId(null)} title="Deposit to Card">
        <div className="space-y-4 p-1">
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Wallet Balance</p>
              <p className="text-lg font-bold text-gray-900">${walletBalance.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Card Balance</p>
              <p className="text-lg font-bold text-gray-900">${Number(depositCard?.balance || 0).toFixed(2)}</p>
            </div>
          </div>
          <Input
            label="Amount (USD)"
            type="number"
            value={depositAmount}
            onChange={e => setDepositAmount(e.target.value)}
            placeholder="100.00"
          />
          <p className="text-[11px] text-gray-400">Funds are deducted from your wallet and added to the card immediately.</p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setDepositCardId(null)}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
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
      </Modal>

      {/* ─── Withdraw Modal ────────────────────────────────────────── */}
      <Modal isOpen={!!withdrawCardId} onClose={() => setWithdrawCardId(null)} title="Withdraw to Wallet">
        <div className="space-y-4 p-1">
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Card Balance</p>
              <p className="text-lg font-bold text-gray-900">${Number(withdrawCard?.balance || 0).toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Wallet Balance</p>
              <p className="text-lg font-bold text-gray-900">${walletBalance.toFixed(2)}</p>
            </div>
          </div>
          <Input
            label="Amount (USD)"
            type="number"
            value={withdrawAmount}
            onChange={e => setWithdrawAmount(e.target.value)}
            placeholder="50.00"
          />
          <p className="text-[11px] text-gray-400">Funds move from the card back to your wallet.</p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setWithdrawCardId(null)}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
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
      </Modal>

      {/* ─── Card Details Modal ────────────────────────────────────── */}
      {detailsCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeDetails}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Card Details</h3>

            {!showSensitive ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <EyeOff className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm mb-5">Card details are hidden for security.</p>
                <button
                  onClick={doReveal}
                  disabled={revealLoading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
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
                    <button onClick={() => copyText(cardSensitive.cardNo)} className="p-1.5 hover:bg-gray-200 rounded-lg">
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
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
                      <button onClick={() => copyText(cardSensitive.cvv)} className="p-1.5 hover:bg-gray-200 rounded-lg">
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 text-[11px] text-amber-600 bg-amber-50 rounded-lg p-3">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Details will auto-hide in 30 seconds for security.
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
              </div>
            )}

            <button onClick={closeDetails} className="w-full mt-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
