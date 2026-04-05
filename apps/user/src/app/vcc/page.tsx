'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/contexts/ToastContext'
import { vccApi } from '@/lib/api'
import {
  CreditCard, Eye, EyeOff, Copy, DollarSign, Clock,
  CheckCircle, XCircle, ChevronDown,
} from 'lucide-react'

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
  const { isHydrated, isAuthenticated } = useAuthStore()
  const { showToast } = useToast()
  const [cards, setCards] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showTx, setShowTx] = useState(false)

  // Card details modal
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [cardSensitive, setCardSensitive] = useState<any>(null)
  const [showSensitive, setShowSensitive] = useState(false)
  const [revealLoading, setRevealLoading] = useState(false)

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return
    fetchCards()
  }, [isHydrated, isAuthenticated])

  const fetchCards = async () => {
    setLoading(true)
    try {
      const data = await vccApi.getMyCards()
      setCards(data.cards || [])
    } catch (e: any) {
      // Silently fail if no cards
    }
    setLoading(false)
  }

  const fetchTransactions = async () => {
    try {
      const data = await vccApi.getMyTransactions({ limit: 50 })
      setTransactions(data.transactions || [])
      setShowTx(true)
    } catch (e: any) {
      showToast('error', e.message)
    }
  }

  const revealDetails = async (cardId: string) => {
    setSelectedCard(cardId)
    setCardSensitive(null)
    setShowSensitive(false)
  }

  const doReveal = async () => {
    if (!selectedCard) return
    setRevealLoading(true)
    try {
      const data = await vccApi.getCardDetails(selectedCard)
      setCardSensitive(data)
      setShowSensitive(true)
      // Auto-hide after 30 seconds
      setTimeout(() => {
        setShowSensitive(false)
        setCardSensitive(null)
      }, 30000)
    } catch (e: any) {
      showToast('error', e.message)
    }
    setRevealLoading(false)
  }

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('success', 'Copied to clipboard')
  }

  const closeDetails = () => {
    setSelectedCard(null)
    setCardSensitive(null)
    setShowSensitive(false)
  }

  return (
    <DashboardLayout title="VCC Cards" subtitle="Your virtual credit cards">

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-20">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No cards assigned</p>
          <p className="text-gray-400 text-sm mt-1">Contact your administrator to get a VCC card assigned.</p>
        </div>
      ) : (
        <>
          {/* Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {cards.map(card => (
              <div key={card.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {/* Card visual header */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-5 text-white relative overflow-hidden">
                  {/* Decorative circles */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full border border-white/20" />
                  <div className="absolute top-3 right-7 w-8 h-8 rounded-full border border-white/10" />

                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-4">Virtual Card</p>
                  <p className="font-mono text-lg tracking-[0.2em] mb-3">
                    •••• •••• •••• {card.yeewallexCardId ? card.yeewallexCardId.slice(-4) : '••••'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-white/30 uppercase">Cardholder</p>
                      <p className="text-sm">{card.cardholder?.firstName} {card.cardholder?.lastName}</p>
                    </div>
                    <StatusBadge status={card.status} />
                  </div>
                </div>

                {/* Card info */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-400">Balance</p>
                      <p className="text-xl font-bold text-gray-900">${card.balance?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Currency</p>
                      <p className="text-sm font-semibold text-gray-700">{card.currency}</p>
                    </div>
                  </div>

                  {card.label && (
                    <p className="text-xs text-gray-400 mb-3">{card.label}</p>
                  )}

                  {card.status === 'ACTIVE' && card.yeewallexCardId && (
                    <button
                      onClick={() => revealDetails(card.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Card Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Transaction History Toggle */}
          <div className="mb-4">
            <button
              onClick={() => showTx ? setShowTx(false) : fetchTransactions()}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showTx ? 'rotate-180' : ''}`} />
              Transaction History
            </button>
          </div>

          {/* Transactions Table */}
          {showTx && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">TYPE</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">AMOUNT</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">STATUS</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">CARD</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">DESCRIPTION</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">DATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><StatusBadge status={tx.type} /></td>
                      <td className="px-4 py-3 font-semibold">${tx.amount?.toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                      <td className="px-4 py-3 text-gray-600">{tx.card?.label || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{tx.merchantName || tx.description || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400">No transactions yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Card Details Modal */}
      {selectedCard && (
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
                  {revealLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  Reveal Details
                </button>
                <p className="text-[10px] text-gray-400 mt-3">Details auto-hide after 30 seconds</p>
              </div>
            ) : cardSensitive ? (
              <div className="space-y-3">
                {/* Card Number */}
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
                  {/* Expiry */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Expiry Date</p>
                    <p className="font-mono text-base font-bold">{cardSensitive.expireDate}</p>
                  </div>

                  {/* CVV */}
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
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
              </div>
            )}

            <button onClick={closeDetails} className="w-full mt-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
