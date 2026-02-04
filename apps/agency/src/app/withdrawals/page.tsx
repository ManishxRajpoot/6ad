'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { agentWithdrawalsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { TrendingUp, TrendingDown, DollarSign, Users, Wallet, Loader2, CheckCircle, X } from 'lucide-react'

interface WithdrawalStats {
  availableToWithdraw: number
  todayRevenue: number
  totalAdAccounts: number
  pendingAccounts: number
  totalEarned: number
  totalWithdrawn: number
  pendingWithdrawalAmount: number
  minimumWithdrawal: number
  canWithdraw: boolean
}

const MINIMUM_WITHDRAWAL = 200

interface Withdrawal {
  id: string
  amount: number
  approvedAmount?: number
  paymentAddress: string
  paymentMethod?: string
  description?: string
  status: string
  createdAt: string
  approvedAt?: string
  clearedAt?: string
}

export default function WithdrawalsPage() {
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const [stats, setStats] = useState<WithdrawalStats | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [submittedAmount, setSubmittedAmount] = useState(0)

  // Form state
  const [amount, setAmount] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const [statsRes, withdrawalsRes] = await Promise.all([
        agentWithdrawalsApi.getStats(),
        agentWithdrawalsApi.getAll({ limit: 50 })
      ])
      setStats(statsRes)
      setWithdrawals(withdrawalsRes.withdrawals)
      // Refresh user data to sync wallet balance from database
      await refreshUser()
    } catch (err: any) {
      console.error('Failed to fetch withdrawal data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid amount')
      return
    }


    // Check minimum withdrawal amount
    const minWithdrawal = stats?.minimumWithdrawal || MINIMUM_WITHDRAWAL
    if (stats && stats.availableToWithdraw < minWithdrawal) {
      setError(`Minimum balance of $${minWithdrawal} required to withdraw. Your balance is $${stats.availableToWithdraw.toFixed(2)}`)
      return
    }

    if (amountNum < minWithdrawal) {
      setError(`Minimum withdrawal amount is $${minWithdrawal}`)
      return
    }

    if (stats && amountNum > stats.availableToWithdraw) {
      setError(`Amount exceeds available balance ($${stats.availableToWithdraw.toFixed(2)})`)
      return
    }

    try {
      setSubmitting(true)
      await agentWithdrawalsApi.create({
        amount: amountNum,
      })
      setSubmittedAmount(amountNum)
      setShowSuccessPopup(true)
      setAmount('')
      fetchData()
    } catch (err: any) {
      setError(err.message || 'Failed to submit withdrawal request')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded text-[10px] xl:text-[11px] font-semibold"
    switch (status) {
      case 'APPROVED':
        return <span className={`${baseClasses} bg-[#52B788] text-white`}>Approved</span>
      case 'PENDING':
        return <span className={`${baseClasses} bg-[#F59E0B] text-white`}>Pending</span>
      case 'REJECTED':
        return <span className={`${baseClasses} bg-[#EF4444] text-white`}>Rejected</span>
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-600`}>{status}</span>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  return (
    <DashboardLayout title="Agent Withdrawal Profile Applications" subtitle="">
      {/* Stats Cards - Compact */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Available to Withdraw */}
          <Card className="p-3 min-h-[80px]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] xl:text-[11px] text-gray-500">Available to withdraw</span>
              <span className="text-[9px] xl:text-[10px] text-emerald-500 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>10.0%</span>
              </span>
            </div>
            <div className="text-lg xl:text-xl font-bold text-[#7C3AED] mb-0.5">
              {loading ? '...' : formatCurrency(stats?.availableToWithdraw || 0)}
            </div>
            <div className="text-[9px] xl:text-[10px] text-gray-400">
              {stats && !stats.canWithdraw ? (
                <span className="text-orange-500">Min $200 required</span>
              ) : (
                new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              )}
            </div>
          </Card>

          {/* Today Revenue */}
          <Card className="p-3 min-h-[80px]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] xl:text-[11px] text-gray-500">Today Revenue</span>
              <span className="text-[9px] xl:text-[10px] text-red-500 flex items-center gap-0.5">
                <TrendingDown className="w-2.5 h-2.5" />
                <span>3.0%</span>
              </span>
            </div>
            <div className="text-lg xl:text-xl font-bold text-[#7C3AED] mb-0.5">
              {loading ? '...' : formatCurrency(stats?.todayRevenue || 0)}
            </div>
            <div className="text-[9px] xl:text-[10px] text-gray-400">
              143 Account & <span className="text-orange-500">44 Pending</span>
            </div>
          </Card>

          {/* Total Ads Account */}
          <Card className="p-3 min-h-[80px]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] xl:text-[11px] text-gray-500">Total Ads Account</span>
              <span className="text-[9px] xl:text-[10px] text-emerald-500 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>3.2%</span>
              </span>
            </div>
            <div className="text-lg xl:text-xl font-bold text-[#7C3AED] mb-0.5">
              {loading ? '...' : (stats?.totalAdAccounts || 0).toLocaleString('en-US')}
            </div>
            <div className="text-[9px] xl:text-[10px] text-gray-400">
              Active ads Account
            </div>
          </Card>

          {/* All Earned Amount */}
          <Card className="p-3 min-h-[80px]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] xl:text-[11px] text-gray-500">All Earned Amount</span>
              <span className="text-[9px] xl:text-[10px] text-emerald-500 flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>8.3%</span>
              </span>
            </div>
            <div className="text-lg xl:text-xl font-bold text-[#7C3AED] mb-0.5">
              {loading ? '...' : formatCurrency(stats?.totalEarned || 0)}
            </div>
            <div className="text-[9px] xl:text-[10px] text-gray-400">
              Total earned amount till now
            </div>
          </Card>
        </div>

        {/* Request Withdrawal Section - Compact */}
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-[13px] font-semibold text-gray-800">Request Withdrawal</h2>
              <p className="text-[10px] text-gray-500">Enter your withdrawal amount</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            {error && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-[11px]">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-2 p-2 bg-green-50 border border-green-200 text-green-600 rounded-lg text-[11px]">
                {success}
              </div>
            )}

            <div className="flex-1 max-w-xs">
              <label className="block text-[11px] font-medium text-gray-700 mb-1">Enter Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
              </div>
              {stats && (
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[9px] text-gray-400">
                    Available: ${stats.availableToWithdraw.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-gray-400">
                    Min: ${stats.minimumWithdrawal || MINIMUM_WITHDRAWAL}
                  </p>
                </div>
              )}
            </div>

            {stats && !stats.canWithdraw && (
              <div className="p-2 bg-orange-50 border border-orange-200 text-orange-600 rounded-lg text-[10px] max-w-xs">
                Need ${stats.minimumWithdrawal || MINIMUM_WITHDRAWAL} min. Balance: ${stats.availableToWithdraw.toFixed(2)}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || loading || (stats && !stats.canWithdraw) || false}
              className={`px-4 py-2 rounded-lg font-medium text-xs ${
                stats && !stats.canWithdraw
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </form>
        </Card>

        {/* Withdrawal History - Compact */}
        <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 320px)' }}>
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-[13px] font-semibold text-gray-800">Withdrawal History</h2>
            <p className="text-[10px] text-gray-500">Here you can check your withdrawal history</p>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Create Date</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-[#7C3AED] uppercase tracking-wider bg-gray-50">Requested</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-[#166534] uppercase tracking-wider bg-gray-50">Approved</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Clearence Date</th>
                  <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-6 h-6 text-[#52B788] animate-spin mb-1" />
                        <span className="text-gray-500 text-[11px]">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 text-[11px]">
                      No withdrawal requests found
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-3 text-[11px] xl:text-[12px] text-gray-500">
                        {formatDate(withdrawal.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] font-bold text-[#7C3AED]">
                        ${withdrawal.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-[13px] font-bold text-[#166534]">
                        {withdrawal.status === 'APPROVED' && withdrawal.approvedAmount !== undefined
                          ? `$${withdrawal.approvedAmount.toLocaleString()}`
                          : withdrawal.status === 'PENDING'
                            ? <span className="text-[11px] text-gray-400">Pending</span>
                            : '---'}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] xl:text-[12px] text-gray-500">
                        {withdrawal.clearedAt ? formatDate(withdrawal.clearedAt) : '---'}
                      </td>
                      <td className="py-2.5 px-3">
                        {getStatusBadge(withdrawal.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Success Popup Modal */}
      <div
        className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 transition-all duration-300 ease-out ${
          showSuccessPopup ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setShowSuccessPopup(false)}
      >
        <div
          className={`bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center relative transition-all duration-300 ease-out ${
            showSuccessPopup ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowSuccessPopup(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className={`w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-500 delay-100 ${
            showSuccessPopup ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>

          <h3 className={`text-xl font-bold text-gray-800 mb-2 transition-all duration-300 delay-150 ${
            showSuccessPopup ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            Withdrawal Request Submitted!
          </h3>

          <p className={`text-gray-500 mb-2 transition-all duration-300 delay-200 ${
            showSuccessPopup ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            Your withdrawal request for
          </p>

          <p className={`text-2xl font-bold text-[#7C3AED] mb-4 transition-all duration-300 delay-250 ${
            showSuccessPopup ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            ${submittedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>

          <p className={`text-sm text-gray-400 mb-6 transition-all duration-300 delay-300 ${
            showSuccessPopup ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            has been submitted successfully. You will be notified once it's processed.
          </p>

          <Button
            onClick={() => setShowSuccessPopup(false)}
            className={`bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8 py-2.5 rounded-lg font-medium transition-all duration-300 delay-350 ${
              showSuccessPopup ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            Done
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
